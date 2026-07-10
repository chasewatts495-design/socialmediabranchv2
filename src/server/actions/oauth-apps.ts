"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import { providerFor } from "@/lib/oauth";
import {
  deleteOAuthAppCreds,
  saveOAuthAppCreds,
} from "@/lib/oauth/app-credentials";
import { linkDiscoveredAccount } from "@/lib/oauth/link-account";
import type { DiscoveredAccount } from "@/lib/oauth/types";
import { deleteSetting, getSetting } from "@/lib/settings";
import type { ActionResult } from "./accounts";

const uuid = () => crypto.randomUUID();

const credsSchema = z.object({
  clientId: z.string().trim().min(3).max(300),
  clientSecret: z.string().trim().min(3).max(500),
});

export async function saveOAuthAppAction(
  provider: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!providerFor(provider)) {
    return { ok: false, message: "Unknown provider." };
  }
  const parsed = credsSchema.safeParse({
    clientId: formData.get("clientId"),
    clientSecret: formData.get("clientSecret"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Paste both the Client ID and the Secret." };
  }
  await saveOAuthAppCreds(provider, parsed.data);
  const db = await getDb();
  await db.insert(activityLog).values({
    id: uuid(),
    event: "oauth_app.saved",
    detail: { provider },
  });
  revalidatePath("/connections", "layout");
  return {
    ok: true,
    message: "App keys stored (encrypted). Now hit Connect below.",
  };
}

export async function deleteOAuthAppAction(
  provider: string,
): Promise<ActionResult> {
  await deleteOAuthAppCreds(provider);
  revalidatePath("/connections", "layout");
  return { ok: true, message: "App keys removed." };
}

interface PendingSelection {
  provider: string;
  brandId: string | null;
  createdAt: number;
  accounts: DiscoveredAccount[];
}

export async function loadPendingSelection(
  nonce: string,
): Promise<PendingSelection | null> {
  if (!/^[a-z0-9-]{10,60}$/i.test(nonce)) return null;
  const raw = await getSetting(`oauth.pending.${nonce}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingSelection;
    // Stale stashes (>30 min) are dead — the tokens may still be short-lived.
    if (Date.now() - parsed.createdAt > 30 * 60_000) {
      await deleteSetting(`oauth.pending.${nonce}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Finalizes the Meta picker: links each chosen Page/IG profile. */
export async function linkSelectedAccountsAction(
  nonce: string,
  externalIds: string[],
): Promise<ActionResult> {
  const pending = await loadPendingSelection(nonce);
  if (!pending) {
    return {
      ok: false,
      message: "This connection expired — hit Connect again.",
    };
  }
  const chosen = pending.accounts.filter((a) =>
    externalIds.includes(`${a.platformId}:${a.externalId}`),
  );
  if (chosen.length === 0) {
    return { ok: false, message: "Pick at least one account." };
  }
  const db = await getDb();
  for (const account of chosen) {
    await linkDiscoveredAccount(db, account, { brandId: pending.brandId });
  }
  await deleteSetting(`oauth.pending.${nonce}`);
  revalidatePath("/connections", "layout");
  return {
    ok: true,
    message: `Connected ${chosen.length} account${chosen.length === 1 ? "" : "s"}.`,
  };
}
