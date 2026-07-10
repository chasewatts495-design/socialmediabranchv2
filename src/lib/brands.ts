import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { accounts, brands } from "@/lib/db/schema";

export const BRAND_COOKIE = "branch.activeBrand";
/** Sentinel meaning "no brand filter — show every account". */
export const ALL_BRANDS = "all";

export type BrandRow = typeof brands.$inferSelect;

export interface BrandWithCount extends BrandRow {
  accountCount: number;
}

export async function listBrands(): Promise<BrandWithCount[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(brands)
    .orderBy(asc(brands.sortOrder), asc(brands.createdAt));
  const accountRows = await db
    .select({ brandId: accounts.brandId })
    .from(accounts);
  const counts = new Map<string, number>();
  for (const a of accountRows) {
    if (a.brandId) counts.set(a.brandId, (counts.get(a.brandId) ?? 0) + 1);
  }
  return rows.map((b) => ({ ...b, accountCount: counts.get(b.id) ?? 0 }));
}

export async function getBrand(id: string): Promise<BrandRow | null> {
  const db = await getDb();
  const rows = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * The brand every page scopes to, from the switcher cookie. Returns
 * ALL_BRANDS when no brand is selected or the cookie points at a brand
 * that no longer exists (so a deleted brand can never blank the app).
 */
export async function getActiveBrandId(): Promise<string> {
  const jar = await cookies();
  const value = jar.get(BRAND_COOKIE)?.value;
  if (!value || value === ALL_BRANDS) return ALL_BRANDS;
  return (await getBrand(value)) ? value : ALL_BRANDS;
}

export async function getActiveBrand(): Promise<BrandRow | null> {
  const id = await getActiveBrandId();
  return id === ALL_BRANDS ? null : getBrand(id);
}

/** `undefined` → no filter; a string → filter accounts to that brand. */
export function brandScope(brandId: string): string | undefined {
  return brandId === ALL_BRANDS ? undefined : brandId;
}
