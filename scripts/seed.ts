/** CLI seed: `npm run db:seed`. Safe to run twice (no-op when seeded). */
import { ensureSeeded } from "../src/lib/db/ensure-seeded";

ensureSeeded()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
