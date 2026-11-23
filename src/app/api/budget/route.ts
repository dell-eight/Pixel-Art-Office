import { prisma } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  try {
    const [prices, ledger] = await Promise.all([
      prisma.price.findMany(),
      prisma.ledgerEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // Calculate month to date spend
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const mtdEntries = ledger.filter((l) => new Date(l.createdAt) >= startOfMonth);
    const mtdUsd = mtdEntries.reduce((sum, l) => sum + Number(l.actualUsd || l.estUsd || 0), 0);
    const mtdPhp = mtdUsd * e.FX_USD_PHP;

    return Response.json({
      budgetCapPhp: e.BUDGET_CAP_PHP,
      fxUsdPhp: e.FX_USD_PHP,
      mtdPhp: Math.round(mtdPhp),
      mtdUsd: Number(mtdUsd.toFixed(2)),
      prices,
      recentLedger: ledger,
    });
  } catch {
    // If DB empty or mock
    return Response.json({
      budgetCapPhp: e.BUDGET_CAP_PHP,
      fxUsdPhp: e.FX_USD_PHP,
      mtdPhp: 480,
      mtdUsd: Number((480 / e.FX_USD_PHP).toFixed(2)),
      prices: [],
      recentLedger: [],
    });
  }
}
