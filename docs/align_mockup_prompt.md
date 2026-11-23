# Align the Stitch mockup with the Pixel-Art Office blueprint

Save the 5 Stitch HTML files in `docs/mockup/` as `stitch-office.html` (Office Floor), `stitch-kanban.html` (Pipeline Kanban), `stitch-roster.html` (Staff Roster), `stitch-ledger.html` (Analytics Ledger), and `stitch-design-system.html` (design tokens and motion). Then paste everything below into Antigravity (after phase 1 is finished).

---

docs/mockup/ holds my 4 APPROVED tab designs from Google Stitch: stitch-office.html (Office Floor), stitch-kanban.html (Pipeline Kanban), stitch-roster.html (Staff Roster), and stitch-ledger.html (Analytics Ledger, which becomes Budget & Costs). Rebuild the app UI from it, following these rules.

## 1. Keep exactly as is (approved, do not redesign)
- The full color palette and Tailwind tokens (surface #11131e family, primary amber #ffc174 / #f59e0b, secondary green #4edea3, tertiary #d5c3ff, error #ffb4ab), dark theme.
- Fonts: Space Grotesk (headlines), Chivo (body), Space Mono (labels and numbers). Material Symbols icons.
- All animations: CRT scanlines and flicker, station pulse glows (green, amber, red, cyan), LED breathe, pixel bob for working and idle, paper plane, glowing reel folder, courier walk cycle with stepping legs, speech bubble pulse, sound-wave bars. Keep the prefers-reduced-motion block.
- The pixel SVG character style (crispEdges, image-rendering: pixelated), the parquet floor, the sunlit window header, and the 16-bit chat sound effects with the SFX toggle.
- The layout: top header, left sidebar, office floor with a station grid, docked inspector on the right, and the command console at the bottom.

Port the CSS and Tailwind config into the Next.js app as real theme config and CSS modules or globals (no Tailwind CDN script). Convert the static HTML into React components. Use PixiJS only if needed for the walking courier; CSS animations are fine.

## 2. Change the content to match the blueprint
- **8 employees, blueprint roles (docs/employee_skills.md):** Producer, Scriptwriter, Art Director, Illustrator, Animator, Voice Actor, Editor, Social Manager. The mockup has an "Artist" and a "QA Reviewer" instead. Split Art into Art Director (style bible and shot plan) and Illustrator (keyframes). Remove QA as an employee: QA becomes the human approval gates (see below). Keep the mockup's desk props per role: whiteboard for Producer, CRT for Scriptwriter, easel for Art Director, drawing tablet for Illustrator, monitors for Animator, padded booth for Voice Actor, dual monitors for Editor, POST button and window for Social Manager.
- **Station order follows the pipeline state machine:** Producer, Scriptwriter, (Gate 1: Script Review), Art Director, Illustrator, (Gate 2: Keyframe Review), Voice Actor runs in parallel with art, Animator, Editor, Social Manager, Ready to Post.
- **Live data, not hardcoded text:** every station card reads its status from the API over SSE. Show the 5 sprite states from the blueprint (idle, thinking, working, done, error) plus "waiting at gate". Remove the fake names, quotes, and numbers ("Marco Rossi", "Episode #84 Top 5 AI Hacks", "PRORES 4K", "60fps", "-14 LUFS"). Use the employee role as the name, or a name field from the employees table if one exists.
- **Header:** keep the logo and title, but rename it to the app name "Pixel-Art Office". Replace the fake "₱142,850" coin counter with the real **budget meter**: month-to-date spend vs. BUDGET_CAP_PHP (₱6,000), shown like the coin counter, turning amber at 80% and red at 100%. Label estimates "est.". Keep the queue counter (real count of jobs in flight). Replace 1x/2x/PAUSE with real controls: Pause pipeline / Resume.
- **Pipeline progress bar:** keep the 8-segment gauge, mapped to the real stages of the current job.
- **Glowing reel folder and courier:** keep them, but drive them from the real job: show the job title and the actual from-desk and to-desk handoff. Remove "RUSH / SPRINT DELIVERY". Keep TRACK ROUTE only if it scrolls to the active desk.
- **Right inspector (employee panel):** keep the window style, portrait, and current task box, but make the panel tabs the blueprint's: **Skill** (system prompt, provider and model, params, version history, Save as new version), **Output** (latest output: script JSON, keyframe images, audio player, or video preview with the existing CRT preview frame), **Logs** (the existing activity log style, real stage_run logs), and **Cost** (this employee's spend per job and per month).
- **Approval gates:** add gate doors on the floor between stations. When a job waits at a gate, show the existing red "!" alert badge on that door, and in the inspector show Approve / Request changes (with a comment) / Reject buttons that call the approve API.
- **Sidebar tabs:** keep the style. Tabs: Office Floor, Pipeline Kanban (columns: Idea, Script, Script Review, Art, Keyframe Review, Voice, Animation, Editing, Ready to Post, Posted, plus Error and Paused-Budget), Staff Roster (the 8 employees with their skill versions), Budget & Costs (replaces "Analytics Ledger": cost_events table, per-job and per-month totals in PHP and USD, prices table with verified flags), and Settings (API keys status without showing values, MOCK_MODE toggle, FX rate, budget cap).
- **Social Manager:** the POST button must NOT auto-post (blueprint MVP rule). It becomes "Mark as Posted" after I post manually, and it shows the per-platform caption, 3 to 5 hashtags, and the AI-disclosure line, with a Copy button for each. Block DONE if the disclosure is missing. Keep the paper plane animation when I mark it posted.
- **Boss command console and team chat:** keep the look. The input becomes "New reel brief": I type a topic or idea and it creates a new job for the Producer. The chat shows real pipeline events (stage started, finished, failed, waiting for approval) as messages from each employee. Remove the fake automatic replies.
- **Bottom metric cards:** replace with real ones: reels this month, average cost per reel (est.), and average production time.

## 2b. Pipeline Kanban tab (docs/mockup/stitch-kanban.html)
Keep: the title strip, search box, pill filters, column style with numbered badges and WIP counts, card style (ID chip, title, short summary, thumbnail, progress bar, footer), the bottleneck red ring, the amber ring and alert-pulse for cards awaiting approval, the bottom inspection tray, and the "New reel" modal look.

Change:
- **Columns = real job states:** Idea (Briefed), Script, Script Review (gate), Art (art direction and keyframes), Keyframe Review (gate), Voice, Animation, Editing, Ready to Post, Posted, plus collapsible Error and Paused-Budget columns. Each column header shows the responsible employee ROLE (not a fake person) and the real count of jobs.
- **Cards = real jobs from the API:** job ID, topic title, current stage, progress from stage_runs, thumbnail from the latest keyframe if any, and **cost so far (est.) in PHP** from cost_events. Remove fake payouts and earnings ("₱28,000", "Earned", "+₱28,000 added to vault", "In-flight value ₱285.4k").
- **Gate cards:** "STAMP OK" becomes **Approve**, "RETRY" becomes **Request changes** (asks for a comment), and add **Reject**. These call the approve API. Approval is only possible on cards in Script Review or Keyframe Review.
- **Error and stuck cards:** show the real error message from the failed stage_run, with **Retry stage** and **Cancel job** buttons. Replace "Nudge" with Retry stage.
- **Metrics ribbon:** replace with real numbers: jobs in flight, reels finished this month, average cost per reel (est.), and budget used this month vs. ₱6,000.
- **Filters:** All, Waiting for my approval, Errors, In progress, Posted. Replace the Sprint dropdown with a month picker.
- **View switch:** keep only "Kanban Columns". Remove "Sprint Timeline" and "Bottleneck Matrix" for now.
- **New reel modal:** fields are Topic or idea (optional; empty means the Producer picks one), Target length (20 to 35 s), Platforms (checkboxes), and Voice. Remove "Estimated payout" and "Lead writer". The submit button "Create reel" creates a job in Briefed and starts the Producer.
- **Bottom tray:** shows the selected job: title, stage, duration, cost so far, script hook (from the real script), and buttons Open in office (jumps to the Office Floor and highlights the desk), Approve or Request changes (only at a gate), and Cancel job.
- **Posted cards:** show the platforms I marked as posted and the posted date. No fake view counts.
- Drag and drop between columns is NOT allowed (the state machine moves jobs). Clicking a card selects it.

Remove from this tab: "Coffee run", "Bump priority (+₱500)", "Staff sprint morale", "BOOSTED", "RUSH", velocity and dwell stats that aren't computed from real data, fake names, and the Google-hosted placeholder images.

## 2c. Staff Roster tab (docs/mockup/stitch-roster.html)
Keep: the header strip, stat ribbon, filter chips, search, the 2-column staff card grid with the pixel sprite, status chip, and trait tags, the sticky right inspector, and the "SELECTED" ring.

Change:
- **Cards = the 8 blueprint employees** (from the employees table, seeded from docs/employee_skills.md): role name, desk, live status (idle, thinking, working, done, error, waiting at gate), and the active skill version (v1, v2, ...).
- Replace MORALE / FOCUS bars with real stats: **success rate** (stage runs passed without reroll) and **average cost per run (est.)**. Replace the footer speed stat with **runs this month**.
- Replace trait tags with: provider and model (e.g. "Gemini text", "Veo"), and the reroll cap.
- Filters: All, Text (Producer, Scriptwriter, Art Director, Social Manager), Visual (Illustrator, Animator), Audio and Edit (Voice Actor, Editor). Sort by desk, cost, or success rate.
- Stat ribbon: Employees (8), Runs this month, Month spend (est.) vs. ₱6,000, Errors this month.
- **Inspector becomes the employee Skill editor:** "Skill tree nodes" becomes the **Skill** panel: system prompt (editable textarea), provider and model dropdowns, params (temperature etc.), output schema (read only), reroll cap, and a version history list with "Save as new version" and "Restore". Then the **Recent runs** list (job, stage, status, cost, time) and **Cost this month**.
- Inspector buttons: **Save as new version**, **Test with mock input**, **Restore previous version**, **Pause this employee**.

Remove: hire freelancer, coffee run, workshop, payroll, hourly rates, levels, unspent points, skill upgrades, equipped desk hardware, bonus, break, promote, raise salary, morale and caffeine stats.

## 2d. Analytics Ledger tab -> rename to "Budget & Costs" (docs/mockup/stitch-ledger.html)
This app spends money on AI APIs; it does not earn or pay anyone. Keep the look (4 KPI cards with the pixel sparkline, weekly/monthly toggle, the platform card row, the stepped chart panel, the filterable table, and the right-column panels with the segmented bar), but change every number to real spend data.

- **KPI cards:** (1) **Month spend (est.)** in PHP with USD under it, vs. BUDGET_CAP_PHP ₱6,000, with the weekly sparkline of spend; (2) **Average cost per reel (est.)**; (3) **Budget left** this month, with a warning chip at 80% and a red "HARD STOP" chip at 100%; (4) **Reels finished this month**.
- **Platform row becomes "Spend by provider":** one card each for Gemini text and images, Veo video, Vidu video, and ElevenLabs voice: month spend, number of calls, and price source with its checked_at date and verified flag.
- **Chart panel:** "Retention decay" becomes **Daily spend this month** (stepped line) with a dashed line at the budget pace (₱6,000 / days in month). Milestone boxes: today, this week, month to date, projected month end.
- **Table becomes "Cost per reel":** job ID and title, status, number of rerolls, cost by stage (text, images, video, voice), total (est.), and an Inspect button that opens the job's cost_events. Filters: All, Over ₱X, Has rerolls, Errors, This week.
- **Right column panel 1, "Creator shares", becomes "Spend by employee":** the 8 roles with their month spend.
- **Right column panel 2, "Treasury allocation", becomes "Budget split":** the segmented bar shows spend by category (video, images, text, voice) as a share of the ₱6,000 cap, plus the remaining amount.
- **Settings box at the bottom of the right column:** budget cap (PHP), FX rate (PHP per USD), warn threshold (80%), and a "Pause all jobs when budget is reached" toggle (on by default). Keep EXPORT CSV (export cost_events).
- Show "est." next to every estimated amount and link the prices table.

Remove: revenue, views, hook rate, retention, RPM, dividend pool, payout runs, Reel-Pay, staff cuts, royalties, bonuses, "Boost algorithm", "Claim", "Equipment shop fund", and all fake platform earnings. (Views and retention could come later as a manual-entry "Performance" section, but not now.)

## 2e. Shared header, sidebar and footer (all tabs)
- App name "Pixel-Art Office" instead of "REELCRAFT 16-BIT STUDIOS / OBSIDIAN SIMULATION PIPELINE V2.4".
- Replace "MORNING SPRINT - 10:15 AM" with the real local time and day.
- Remove the "Studio morale" box at the bottom of the sidebar; put a small budget meter there instead.
- Sidebar tabs: Office Floor, Pipeline Kanban, Staff Roster, Budget & Costs, Settings.
- The footer "Small Boss Chat Box" is the New reel brief input on every tab.
- Remove "FPS: 60 | SPRITES: 128"; show "MOCK MODE" or "LIVE" there instead.

## 3. Remove (not in the blueprint)
- Equipped studio gear, inventory slots, and any shop or equipment.
- Morale, energy, coffee, caffeine, "+COFFEE", "CRUNCH", "Coffee Run", "Team Standup", "+₱3,200/hr", "Studio Morale", level badges (LVL 4), speed stats (FPS/HR), "Goal: Viral Reel".
- Fake retention, turnaround, and "Top 5% Studio Tier" stats.
- The floor decor info strips (espresso bar, plants, water cooler) as labeled widgets. Keep them only as small decorative pixel props with no text.
- "FPS: 60 | SPRITES: 128" and other fake counters.

## 4. Process
Before coding, reply with a short table: what you keep, what you change, and what you remove, and which components and files you will create. Wait for my OK. Then build it in mock mode so the office animates from the mock pipeline, run the tests and the build, and commit.

---

## §5 Design system (source of truth for tokens)
A 5th file is saved as `docs/mockup/stitch-design-system.html`. Treat it as the single source for design tokens. Port its `tailwind.config` (colors, borderRadius, spacing, fontFamily, fontSize) into `tailwind.config.ts` verbatim, and expose the same values as CSS variables in `globals.css`.

Key tokens (must match exactly):
- Primary amber `#f59e0b` (hover `#fbbf24`, pressed `#d97706`); surface `#11131e`; container-low `#191b27`; container-lowest `#0b0d19`; container-high `#272936`; borders `#272a3b`.
- Success `#4edea3`, error `#ffb4ab`, boost/info `#d5c3ff`, text `#e1e1f2`, muted `#94a3b8`, outline `#64748b`.
- Fonts: Space Grotesk 600/700 for headlines, Space Mono 400/700 for body, labels and numbers, Material Symbols Outlined for icons. Self-host them with `next/font` (no Google Fonts CDN at runtime).
- Type scale: headline-xl 40/48, headline-lg 28/36, headline-md 20/26, headline-sm 16/22, body-md 14/20, body-sm 12/16, label-lg 13/16, label-md 11/14, label-sm 9/12, stat-counter 22/26.
- Spacing: space-xs 4px, space-sm 8px, space-md 16px, space-lg 24px, space-xl 40px, gutter 16px, margin 24px. 8px root grid, 4px sub-grid.

Motion tokens (put in one `motion.ts` file and reuse everywhere):
- `step_pixel: steps(4, jump-end)` for sprite walks, meters and blinking diodes (150–300ms).
- `tactile_overshoot: cubic-bezier(0.34, 1.56, 0.64, 1)` for buttons, badges, drawers (150–240ms).
- `phosphor_decay: cubic-bezier(0.16, 1, 0.3, 1)` for modal dismiss and column reflow (350–500ms).
- `linear_cron: linear` for ambient loops (1200–3000ms).
- Timing: instant 80ms, micro 200ms, macro 420ms, ambient 1600ms.
- Rules: integer pixel translations only (no sub-pixel blur), and honor `prefers-reduced-motion` by stopping continuous loops and collapsing durations to 0ms.

Reusable components to build from this page: the mechanical button (2px press with shadow collapse), square status chips with a diode dot, the 10-step segmented bar (use it for the budget meter and employee success rate), the recessed input, the card with a stepped header bar, the toast notifier, and the CRT scanline overlay.

Do NOT build the design-system page itself as an app tab. Drop its demo copy (payouts, viral tiers, burnout, morale, "Figma Spec Sync"). It is a reference for the palette and tokens only: do not create any page, route, or component for it.

