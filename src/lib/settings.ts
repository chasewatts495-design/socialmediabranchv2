import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { settings } from "./db/schema";
import { decryptSecret, encryptSecret } from "./crypto/secretbox";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!row.encrypted) return row.value;
  try {
    return decryptSecret(row.value);
  } catch {
    return null; // encryption key changed — treat as unset
  }
}

export async function setSetting(
  key: string,
  value: string,
  opts: { encrypted?: boolean } = {},
): Promise<void> {
  const db = await getDb();
  const stored = opts.encrypted ? encryptSecret(value) : value;
  await db
    .insert(settings)
    .values({ key, value: stored, encrypted: Boolean(opts.encrypted) })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: stored,
        encrypted: Boolean(opts.encrypted),
        updatedAt: new Date(),
      },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, key));
}
