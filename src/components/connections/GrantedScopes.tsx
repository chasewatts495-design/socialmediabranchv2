"use client";

import { useState, useTransition } from "react";
import { disconnectAccountAction } from "@/server/actions/connections";
import { Badge, Spinner } from "@/components/ui/primitives";

/**
 * What this connection is allowed to do, in plain English, with
 * reconnect-to-change and disconnect controls.
 */

const SCOPE_LABELS: Record<string, string> = {
  // Pinterest
  "pins:write": "Can create pins",
  "pins:read": "Can read pins",
  "boards:read": "Can list boards",
  "user_accounts:read": "Can read account stats",
  // Google / YouTube
  "https://www.googleapis.com/auth/youtube.readonly": "Can read channel + videos",
  "https://www.googleapis.com/auth/yt-analytics.readonly": "Can read analytics",
  "https://www.googleapis.com/auth/youtube.upload": "Can upload videos",
  // Meta
  pages_show_list: "Can list your Pages",
  pages_read_engagement: "Can read Page engagement",
  pages_manage_posts: "Can post to the Page",
  instagram_basic: "Can read the IG profile",
  instagram_content_publish: "Can post to Instagram",
  instagram_manage_insights: "Can read IG insights",
  read_insights: "Can read insights",
  business_management: "Can see business assets",
};

export function GrantedScopes({
  accountId,
  scopes,
  reconnectHref,
  isLive,
}: {
  accountId: string;
  scopes: string[];
  /** OAuth start URL with reauth param — null for password-grant (Reddit). */
  reconnectHref: string | null;
  isLive: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!isLive) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        What Branch may do with this connection
      </p>
      <div className="flex flex-wrap gap-1.5">
        {scopes.length > 0 ? (
          scopes.map((s) => (
            <Badge key={s} tone="success">
              {SCOPE_LABELS[s] ?? s}
            </Badge>
          ))
        ) : (
          <Badge tone="success">Post + read stats (script app)</Badge>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {reconnectHref && (
          <a
            href={reconnectHref}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-3"
          >
            Reconnect to change permissions
          </a>
        )}
        {confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await disconnectAccountAction(accountId);
                  setMessage(res.message ?? null);
                  setConfirming(false);
                })
              }
              className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm disconnect
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            data-testid={`disconnect-${accountId.slice(0, 4)}`}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
          >
            Disconnect
          </button>
        )}
        {pending && <Spinner />}
      </div>
      {message && <p className="mt-2 text-[11px] text-muted">{message}</p>}
    </div>
  );
}
