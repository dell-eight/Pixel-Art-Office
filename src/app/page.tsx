import { checkDb, prisma } from "@/server/db";
import { env } from "@/server/env";
import { ROSTER } from "@/shared/roster";

export const dynamic = "force-dynamic";

async function recentJobs() {
  try {
    return await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { artifacts: { where: { kind: { in: ["reel", "thumbnail"] } } } },
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const e = env();
  const [db, jobs] = await Promise.all([checkDb(), recentJobs()]);

  return (
    <main>
      <h1>PIXEL-ART OFFICE</h1>
      <p className="sub">AI Faceless Reel Studio - phase 0 (scaffold + mock mode). The office scene arrives in phase 3.</p>

      <section className="panel">
        <h2>System</h2>
        <div className="kv">
          <span>Mock mode</span>
          <span className={e.MOCK_MODE ? "ok" : "bad"}>{e.MOCK_MODE ? "ON (offline fixtures)" : "OFF"}</span>
          <span>Database</span>
          {db.ok ? (
            <span className="ok">
              connected: {db.server} / {db.database} as {db.login}
            </span>
          ) : (
            <span className="bad">not connected: {db.error.split("\n")[0]}</span>
          )}
          <span>Budget cap</span>
          <span>
            PHP {e.BUDGET_CAP_PHP.toLocaleString()} (est. USD {(e.BUDGET_CAP_PHP / e.FX_USD_PHP).toFixed(2)})
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>Employees</h2>
        <div className="desks">
          {ROSTER.map((r) => (
            <div className="desk" key={r.id}>
              <div className="sprite" style={{ background: r.color }} aria-hidden />
              <div>
                <div>{r.name}</div>
                <div className="sub" style={{ margin: 0 }}>
                  {r.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Recent reels</h2>
        {jobs.length === 0 ? (
          <p>
            No jobs yet. Run <code>npm run mock:demo</code> and refresh.
          </p>
        ) : (
          <div className="jobs">
            {jobs.map((j) => {
              const reel = j.artifacts.find((a) => a.kind === "reel");
              const thumb = j.artifacts.find((a) => a.kind === "thumbnail");
              return (
                <div key={j.id}>
                  {reel ? (
                    <video
                      controls
                      preload="none"
                      src={`/api/artifacts/${reel.id}`}
                      poster={thumb ? `/api/artifacts/${thumb.id}` : undefined}
                    />
                  ) : null}
                  <div>{j.title}</div>
                  <div className="sub" style={{ margin: 0 }}>
                    {j.state} - {j.createdAt.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
