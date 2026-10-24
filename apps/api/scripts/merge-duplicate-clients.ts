/**
 * Merge duplicate clients (same name in the same workspace), left behind by
 * the default-client race fixed in lib/clients.ts ensureClients.
 *
 * Keeps the oldest client of each group (the default one first) and moves
 * everything from the others onto it: ad accounts, creatives, audiences,
 * suggestions, plans, change-log entries, member access and pending invites.
 * Then deletes the duplicates. A monthly budget or currency missing on the
 * kept client is taken from a duplicate.
 *
 * Dry run by default (prints what it would do). To apply:
 *   npx tsx --env-file=.env scripts/merge-duplicate-clients.ts --apply
 */
import { prisma } from "../src/lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  const clients = await prisma.client.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], include: { workspace: { select: { name: true } }, _count: { select: { adAccounts: true, creatives: true, audiences: true, plans: true } } } });
  const groups = new Map<string, typeof clients>();
  for (const c of clients) {
    const key = `${c.workspaceId}::${c.name.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  if (!dupGroups.length) {
    console.log("No duplicate clients found.");
    return;
  }
  for (const [keep, ...dups] of dupGroups) {
    console.log(`\nWorkspace "${keep.workspace.name}": keep "${keep.name}" (${keep.id}, ${keep._count.adAccounts} ad accounts), merge ${dups.length}:`);
    for (const d of dups) console.log(`  - ${d.id}: ${d._count.adAccounts} ad accounts, ${d._count.creatives} creatives, ${d._count.audiences} audiences, ${d._count.plans} plans`);
    if (!apply) continue;
    await prisma.$transaction(async (tx) => {
      for (const d of dups) {
        const move = { where: { clientId: d.id }, data: { clientId: keep.id } };
        await tx.adAccount.updateMany(move);
        await tx.creative.updateMany(move);
        await tx.audience.updateMany(move);
        await tx.suggestion.updateMany(move);
        await tx.plan.updateMany(move);
        await tx.changeLog.updateMany(move);
        for (const a of await tx.memberClientAccess.findMany({ where: { clientId: d.id } })) {
          await tx.memberClientAccess.upsert({ where: { memberId_clientId: { memberId: a.memberId, clientId: keep.id } }, create: { memberId: a.memberId, clientId: keep.id }, update: {} });
        }
        for (const inv of await tx.invite.findMany({ where: { clientIds: { has: d.id } } })) {
          await tx.invite.update({ where: { id: inv.id }, data: { clientIds: [...new Set(inv.clientIds.map((x) => (x === d.id ? keep.id : x)))] } });
        }
        await tx.client.update({
          where: { id: keep.id },
          data: {
            ...(keep.monthlyBudget == null && d.monthlyBudget != null ? { monthlyBudget: d.monthlyBudget } : {}),
            ...(keep.currency == null && d.currency != null ? { currency: d.currency } : {}),
          },
        });
        await tx.client.delete({ where: { id: d.id } }); // cascades its MemberClientAccess rows (now copied)
      }
    });
    console.log("  merged.");
  }
  if (!apply) console.log("\nDry run: nothing changed. Run again with --apply to merge.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
