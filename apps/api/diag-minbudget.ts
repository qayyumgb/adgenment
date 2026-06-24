/** TEMP read-only diagnostic — checks min daily budget. Delete after. */
import "dotenv/config";
import { prisma } from "./src/lib/prisma";
import { metaService } from "./src/services/meta.service";

async function main() {
  const acct = await prisma.adAccount.findFirst({
    where: { platform: "META", isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!acct) return console.log("No active META account.");

  console.log("── DB record ──");
  console.log("  accountId:     ", acct.accountId);
  console.log("  currency:      ", acct.currency);
  console.log("  minDailyBudget:", acct.minDailyBudget);
  console.log("  lastSyncedAt:  ", acct.lastSyncedAt?.toISOString() ?? "never");

  console.log("\n── Live from Meta (getAdAccounts) ──");
  const token = metaService.decryptToken(acct.accessToken);
  const fresh = await metaService.getAdAccounts(token);
  const match = fresh.find((f) => {
    const raw = f.id.startsWith("act_") ? f.id.slice(4) : f.id;
    return raw === acct.accountId;
  });
  if (!match) return console.log("  account not found in live list");
  console.log("  currency:      ", match.currency);
  console.log("  minDailyBudget:", match.minDailyBudget, "(null = Meta didn't return min_daily_budget)");
}

main()
  .catch((e) => { console.error("DIAG ERROR:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
