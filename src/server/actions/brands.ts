"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { accounts, activityLog, brands } from "@/lib/db/schema";
import { ALL_BRANDS, BRAND_COOKIE, getBrand } from "@/lib/brands";
import type { ActionResult } from "./accounts";

const uuid = () => crypto.randomUUID();

/** Every page reads the active brand, so scope changes invalidate the app. */
function revalidateBrandScopedPages() {
  revalidatePath("/", "layout");
}

export async function switchBrandAction(brandId: string): Promise<void> {
  const target =
    brandId === ALL_BRANDS ? ALL_BRANDS : (await getBrand(brandId))?.id;
  if (!target) return;
  const jar = await cookies();
  jar.set(BRAND_COOKIE, target, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidateBrandScopedPages();
}

const brandNameSchema = z.string().trim().min(1).max(60);
const brandColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color");

export async function createBrandAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = brandNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { ok: false, message: "Give the brand a name." };
  const color = brandColorSchema.safeParse(formData.get("color") || "#b08a2e");
  if (!color.success) return { ok: false, message: color.error.issues[0].message };

  const db = await getDb();
  const id = uuid();
  const existing = await db.select({ n: brands.sortOrder }).from(brands);
  await db.insert(brands).values({
    id,
    name: name.data,
    color: color.data,
    sortOrder: existing.length,
  });
  await db.insert(activityLog).values({
    id: uuid(),
    event: "brand.created",
    detail: { brandId: id, name: name.data },
  });

  // Switch straight into the new brand so "add account" lands in it.
  const jar = await cookies();
  jar.set(BRAND_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidateBrandScopedPages();
  return { ok: true, message: `Created ${name.data}.` };
}

export async function updateBrandAction(
  brandId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = brandNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { ok: false, message: "Give the brand a name." };
  const color = brandColorSchema.safeParse(formData.get("color") || "#b08a2e");
  if (!color.success) return { ok: false, message: color.error.issues[0].message };

  const db = await getDb();
  await db
    .update(brands)
    .set({ name: name.data, color: color.data })
    .where(eq(brands.id, brandId));
  revalidateBrandScopedPages();
  return { ok: true, message: "Brand updated." };
}

/**
 * Deleting a brand keeps its accounts: they move to `reassignTo` when given,
 * otherwise they simply become brandless (visible under "All brands").
 */
export async function deleteBrandAction(
  brandId: string,
  reassignTo?: string,
): Promise<ActionResult> {
  const db = await getDb();
  const brand = await getBrand(brandId);
  if (!brand) return { ok: false, message: "Brand not found." };

  const target =
    reassignTo && reassignTo !== brandId ? await getBrand(reassignTo) : null;
  await db
    .update(accounts)
    .set({ brandId: target?.id ?? null })
    .where(eq(accounts.brandId, brandId));
  await db.delete(brands).where(eq(brands.id, brandId));
  await db.insert(activityLog).values({
    id: uuid(),
    event: "brand.deleted",
    detail: {
      brandId,
      name: brand.name,
      reassignedTo: target?.name ?? null,
    },
  });

  const jar = await cookies();
  if (jar.get(BRAND_COOKIE)?.value === brandId) {
    jar.set(BRAND_COOKIE, target?.id ?? ALL_BRANDS, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  revalidateBrandScopedPages();
  return { ok: true, message: `Deleted ${brand.name}.` };
}

export async function assignAccountBrandAction(
  accountId: string,
  brandId: string | null,
): Promise<ActionResult> {
  const db = await getDb();
  const target = brandId ? await getBrand(brandId) : null;
  if (brandId && !target) return { ok: false, message: "Brand not found." };
  await db
    .update(accounts)
    .set({ brandId: target?.id ?? null })
    .where(eq(accounts.id, accountId));
  revalidateBrandScopedPages();
  return { ok: true, message: "Account moved." };
}
