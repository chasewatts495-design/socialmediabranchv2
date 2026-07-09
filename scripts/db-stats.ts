/** Quick sanity check of database contents: `npx tsx scripts/db-stats.ts` */
import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";

async function main() {
  const db = await getDb();
  const q = async (s: string) => (await db.execute(sql.raw(s))).rows;
  console.log("platforms:", (await q("select count(*)::int c from platforms"))[0]);
  console.log("accounts:", (await q("select count(*)::int c from accounts"))[0]);
  console.log("snapshots:", (await q("select count(*)::int c from metric_snapshots"))[0]);
  console.log("posts:", (await q("select count(*)::int c from posts"))[0]);
  console.log("targets:", (await q("select count(*)::int c from post_targets"))[0]);
  console.log("assets:", (await q("select count(*)::int c from media_assets"))[0]);
  console.log("jobs:", await q("select kind, count(*)::int c from schedule_jobs group by kind"));
  console.log(
    "latest followers:",
    await q(
      "select a.handle, m.followers from metric_snapshots m join accounts a on a.id=m.account_id where m.date=(select max(date) from metric_snapshots) order by m.followers desc limit 5",
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
