/**
 * npm run mock:demo [-- --no-db] [-- --topic "..."]
 * Runs the whole pipeline offline (MOCK_MODE) and writes a real MP4 reel.
 * Records the job in SQL Server when reachable; --no-db skips the database.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { checkDb, prisma } from "@/server/db";
import { dataDir, env } from "@/server/env";
import { ffmpegPath } from "@/server/ffmpeg";
import { DbRecorder } from "@/server/pipeline/dbRecorder";
import { runMockPipeline } from "@/server/pipeline/mockRun";
import { ConsoleRecorder, type Recorder } from "@/server/pipeline/recorder";
import { BriefSchema } from "@/shared/schemas";

async function main() {
  const args = process.argv.slice(2);
  const noDb = args.includes("--no-db");
  const topicIdx = args.indexOf("--topic");
  const topic = topicIdx >= 0 ? args[topicIdx + 1] : "Building the perfect home office";

  const e = env();
  if (!e.MOCK_MODE) {
    console.error("mock:demo requires MOCK_MODE=true (real providers arrive in later phases).");
    process.exit(1);
  }
  console.log(`Pixel-Art Office mock demo`);
  console.log(`  ffmpeg : ${ffmpegPath()}`);

  const brief = BriefSchema.parse({ topic, platforms: ["tiktok"] });
  let rec: Recorder;
  let jobId: string;

  if (noDb) {
    jobId = randomUUID();
    rec = new ConsoleRecorder();
    console.log("  db     : skipped (--no-db)");
  } else {
    const db = await checkDb();
    if (!db.ok) {
      console.error(`  db     : NOT reachable -> ${db.error.split("\n")[0]}`);
      console.error("  Fix the connection (see README > Troubleshooting) or rerun with: npm run mock:demo -- --no-db");
      process.exit(2);
    }
    console.log(`  db     : ${db.server} / ${db.database} as ${db.login}`);
    const job = await prisma.job.create({
      data: { title: brief.topic, briefJson: JSON.stringify(brief), mock: true },
    });
    jobId = job.id;
    rec = new DbRecorder(prisma, jobId);
  }

  const jobDir = path.join(dataDir(), "jobs", jobId);
  console.log(`  job    : ${jobId}\n`);
  const t0 = Date.now();
  const res = await runMockPipeline(brief, jobDir, rec);
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  reel      : ${res.reelPath} (${res.durationSec}s, 1080x1920 @30fps)`);
  console.log(`  thumbnail : ${res.thumbnailPath}`);
  console.log(`  keyframes : ${res.keyframes.length} for ${res.clips.length} beats`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
