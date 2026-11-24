/** npm run demo:reset - clears all mock jobs from SQL Server and removes their data/jobs/<id> folders. */
import { prisma } from "@/server/db";
import { resetDemoData } from "@/server/pipeline/resetDemo";

async function main() {
  const res = await resetDemoData();
  console.log(`Reset demo complete: deleted ${res.deletedJobs} mock job(s), removed ${res.removedDirs} job folder(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
