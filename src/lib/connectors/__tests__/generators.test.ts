import { describe, expect, it } from "vitest";
import { daysAgo, statsForDay, statsRange } from "../demo/generators";
import { profileFor } from "../demo/profiles";

describe("demo generators", () => {
  const profile = profileFor("instagram", "@aurora.collective");

  it("is deterministic: same key + date → identical stats", () => {
    const a = statsForDay("k1", profile, "2026-06-01");
    const b = statsForDay("k1", profile, "2026-06-01");
    expect(a).toEqual(b);
  });

  it("different keys diverge", () => {
    const a = statsForDay("k1", profile, "2026-06-01");
    const b = statsForDay("k2", profile, "2026-06-01");
    expect(a.impressions).not.toEqual(b.impressions);
  });

  it("statsRange covers since → today inclusive", () => {
    const rows = statsRange("k1", profile, daysAgo(30));
    expect(rows).toHaveLength(31);
    expect(rows[0].date).toBe(daysAgo(30));
    expect(rows.at(-1)!.date).toBe(daysAgo(0));
  });

  it("followers trend upward over long ranges", () => {
    const rows = statsRange("k1", profile, daysAgo(60));
    expect(rows.at(-1)!.followers!).toBeGreaterThan(rows[0].followers!);
  });
});
