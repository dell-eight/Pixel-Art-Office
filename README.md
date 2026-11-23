# Pixel-Art Office: AI Faceless Reel Studio

A single-user web app: a top-down pixel-art office where 8 AI employees
(Producer, Scriptwriter, Art Director, Illustrator, Animator, Voice Actor,
Editor, Social Manager) turn a brief into a 20-35 s 9:16 isometric explainer reel.

> **Status: Phase 0 - scaffold + mock mode + Prisma/SQL Server.**
> The office scene, gates, panels, real providers and budget meter come in later phases (see [Roadmap](#roadmap)).

## Stack

Next.js 16 (App Router) + TypeScript, React, PixiJS (phase 3), Node worker with
ffmpeg (bundled via `ffmpeg-static`), Microsoft SQL Server 2025 via Prisma 6,
zod validation, SSE (phase 1+).

> **Why Prisma 6, not 7?** Prisma 7 runs SQL Server through the `mssql`/tedious
> driver adapter, which does not support Windows integrated authentication. Prisma
> 6's engine does (`integratedSecurity=true`), so we pin `6.19.x`.

## Setup (Windows)

Prerequisites: Node 24, npm 11, SQL Server 2025 (default instance) with an existing
`PixelOffice` database, your Windows login allowed in it.

```powershell
cd C:\Repo\Pixel-Art-Office
npm install                     # also downloads ffmpeg and generates the Prisma client
copy .env.example .env          # defaults already point at localhost:1433 / PixelOffice
npm run db:check                # proves Prisma can log in with Windows Authentication
npx prisma migrate deploy       # applies prisma/migrations/*_init
npm run db:seed                 # 8 employees, skill v1 (placeholder prompts)
```

> Use `npm.cmd` / `npx.cmd` if PowerShell blocks `npm.ps1` (execution policy).

## Mock-mode demo

```powershell
npm run mock:demo               # full pipeline offline, recorded in SQL Server
npm run dev                     # http://localhost:3000 - shows DB status + the reel
```

`mock:demo` runs every employee with fixtures, draws keyframes (K0 + one added
object per beat), crossfades kf[n] -> kf[n+1] into per-beat clips, synthesises a
placeholder voice with word timestamps, and assembles `data/jobs/<id>/out/reel.mp4`
(1080x1920, 30 fps, loudnorm -16 LUFS) plus `thumbnail.png` and `social.json`.

No database? `npm run mock:demo -- --no-db` runs the same pipeline without SQL Server.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run mock:demo` | End-to-end offline pipeline (`-- --no-db`, `-- --topic "..."`) |
| `npm run db:check` | Connection test (server, database, login, applied migrations) |
| `npm run db:migrate` | `prisma migrate dev` (needs CREATE DATABASE for the shadow DB) |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Seed employees + skill v1 |
| `npm test` | Vitest (fixtures, zod retry loop, word timings, mock pipeline with real ffmpeg) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run worker` | Worker placeholder (job runner arrives in phase 1) |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlserver://localhost:1433;database=PixelOffice;integratedSecurity=true;trustServerCertificate=true` | SQL Server, Windows Authentication |
| `MOCK_MODE` | `true` | All providers use offline mocks; ffmpeg still runs for real |
| `DATA_DIR` | `./data` | Job artifacts (gitignored) |
| `FFMPEG_PATH` | _(bundled)_ | Use your own ffmpeg.exe |
| `GEMINI_API_KEY` | | Gemini text/image + Veo (phase 1/4/6) |
| `ELEVENLABS_API_KEY` | | TTS with word timestamps (phase 5) |
| `VIDU_API_KEY` | | Vidu Q2 start-end video (phase 6) |
| `OPENAI_API_KEY`, `KLING_API_KEY` | | Stub adapters only |
| `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, `VEO_MODEL`, `VIDU_MODEL`, `ELEVENLABS_MODEL`, `ELEVENLABS_VOICE_ID` | | Model IDs live in env, never in code |
| `BUDGET_CAP_PHP` | `6000` | Monthly hard cap (warn at 80%) |
| `FX_USD_PHP` | `58` | PHP per USD for the budget meter |

Secrets go only in `.env` (gitignored). Never commit real keys.

## Project layout

```
prisma/              schema.prisma, migrations/, seed.ts
config/assets.json   tileset/character config (placeholder sprites until a pack is set)
scripts/             mock-demo.ts, db-check.ts
src/app/             Next.js pages + API routes (/api/health, /api/artifacts/[id])
src/server/          env, db, ffmpeg, providers/ (interfaces, mocks, real shells), pipeline/
src/shared/          roster + zod schemas shared by server and UI
src/worker/          background worker (phase 1)
tests/               vitest
```

## Troubleshooting

**`P1001: Can't reach database server at localhost:1433`**: SQL Server's TCP/IP
protocol is disabled (common on fresh installs, which only allow shared memory).
Prisma connects over TCP only. As an administrator:

1. Open **SQL Server Configuration Manager** -> *SQL Server Network Configuration* ->
   *Protocols for MSSQLSERVER* -> enable **TCP/IP**.
2. TCP/IP -> Properties -> *IP Addresses* -> **IPAll**: clear *TCP Dynamic Ports*, set
   *TCP Port* = `1433`.
3. Restart the **SQL Server (MSSQLSERVER)** service.
4. `npm run db:check`

**Login failed for user**: your Windows account needs a login + user in `PixelOffice`
(e.g. `db_owner` for migrations).

## Roadmap

0. Scaffold + mock mode - **done**
1. Pipeline state machine + text stages (Gemini text, versioned skills from the blueprint roster)
2. Human gates + employee panels (Skill / Output / Logs / Cost)
3. PixiJS office scene
4. Keyframe image chain (Gemini image)
5. Voice + word-level captions (ElevenLabs, ASS/SRT)
6. Video (Veo, Vidu Q2)
7. Editor + Social Manager
8. Budget meter
9. Polish
