/** npm run db:check - verifies Prisma can reach PixelOffice with Windows Authentication. */
import { checkDb, prisma } from "@/server/db";

checkDb()
  .then(async (s) => {
    if (s.ok) {
      const migrations = await prisma
        .$queryRaw<{ n: number }[]>`SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`
        .then((r) => Number(r[0].n))
        .catch(() => 0);
      console.log(`OK  server=${s.server} database=${s.database} login=${s.login} appliedMigrations=${migrations}`);
    } else {
      console.error(`FAIL ${s.error}`);
      process.exitCode = 1;
    }
  })
  .finally(() => prisma.$disconnect());
