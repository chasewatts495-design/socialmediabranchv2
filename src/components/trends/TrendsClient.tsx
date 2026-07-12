"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  pinKeywordAction,
  runTrendScanAction,
  unpinKeywordAction,
} from "@/server/actions/trends";
import type { TrendReport, TrendSignal } from "@/lib/trends/types";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_CHART_COLORS } from "@/lib/metrics/colors";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { TrendRadar } from "./TrendRadar";
import { Card, CardHeader, Badge, Spinner } from "@/components/ui/primitives";
import { Tilt } from "@/components/ui/Tilt";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/components/ui/cn";

export interface ScanRow {
  id: string;
  keyword: string;
  status: string;
  createdAt: string;
  error: string | null;
  signals: TrendSignal[];
  analysis: TrendReport | null;
}

export interface SourceAvailability {
  platformId: PlatformId;
  label: string;
  available: boolean;
  hint: string;
}

function compact(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TrendsClient({
  current,
  history,
  availability,
  pinned,
}: {
  current: ScanRow | null;
  history: { id: string; keyword: string; status: string; createdAt: string }[];
  availability: SourceAvailability[];
  pinned: string[];
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [picked, setPicked] = useState<PlatformId[]>([]);
  const [scanning, startScan] = useTransition();
  const [pinBusy, startPin] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const runScan = (kw: string) => {
    const q = kw.trim();
    if (q.length < 2 || scanning) return;
    setMessage(null);
    startScan(async () => {
      const res = await runTrendScanAction({
        keyword: q,
        platformIds: picked,
      });
      if (!res.ok) {
        setMessage(res.message ?? "Scan failed.");
        return;
      }
      router.push(`/trends?scan=${res.scanId}`);
      router.refresh();
    });
  };

  const report = current?.analysis ?? null;
  const signals = current?.signals ?? [];
  const blips = signals.map((s) => ({
    heat: s.heat,
    color: PLATFORM_CHART_COLORS[s.platformId] ?? "#b08a2e",
  }));
  const isDemo = signals.length > 0 && signals.every((s) => s.source === "demo");

  return (
    <div className="space-y-6">
      {/* Radar console — only the canvas half floats; controls stay still. */}
      <Card className="relative overflow-hidden">
        <div className="grid items-stretch md:grid-cols-[minmax(300px,420px)_1fr]">
          <div className="hud-float relative h-56 md:h-auto md:min-h-72">
            <TrendRadar blips={blips} scanning={scanning} />
            {scanning && (
              <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong boot-text">
                Sweeping the network…
              </p>
            )}
          </div>
          <div className="space-y-4 p-5 md:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                Niche scanner
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runScan(keyword)}
                  placeholder="Your niche — e.g. streetwear, sourdough, drone photography"
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-faint focus:border-accent"
                  data-testid="trend-keyword"
                />
                <button
                  onClick={() => runScan(keyword)}
                  disabled={scanning || keyword.trim().length < 2}
                  data-testid="trend-scan-button"
                  className="shrink-0 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {scanning ? <Spinner /> : "Scan"}
                </button>
              </div>
              {message && <p className="mt-2 text-xs text-danger">{message}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-faint">Sources:</span>
              {availability.map((s) => {
                const active =
                  picked.length === 0 || picked.includes(s.platformId);
                return (
                  <button
                    key={s.platformId}
                    disabled={!s.available}
                    title={s.available ? s.label : s.hint}
                    onClick={() =>
                      setPicked((prev) =>
                        prev.includes(s.platformId)
                          ? prev.filter((p) => p !== s.platformId)
                          : [...prev, s.platformId],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      s.available
                        ? active
                          ? "border-accent/50 bg-accent-soft text-accent-strong"
                          : "border-border text-muted hover:border-accent/40"
                        : "border-border text-faint opacity-60",
                    )}
                  >
                    {s.label}
                    {!s.available && " · connect first"}
                  </button>
                );
              })}
              {availability.length === 0 && (
                <Badge tone="warning">Demo mode — deterministic signals</Badge>
              )}
            </div>

            {(pinned.length > 0 || history.length > 0) && (
              <div className="space-y-2 border-t border-border pt-3">
                {pinned.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-faint">
                      Pinned (rescanned daily):
                    </span>
                    {pinned.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-strong"
                      >
                        <button onClick={() => runScan(k)}>{k}</button>
                        <button
                          aria-label={`Unpin ${k}`}
                          onClick={() =>
                            startPin(async () => {
                              await unpinKeywordAction(k);
                              router.refresh();
                            })
                          }
                          className="text-accent-strong/70 hover:text-danger"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {history.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-faint">Recent:</span>
                    {history.slice(0, 6).map((h) => (
                      <Link
                        key={h.id}
                        href={`/trends?scan=${h.id}`}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] transition",
                          current?.id === h.id
                            ? "border-accent/50 bg-accent-soft text-accent-strong"
                            : "border-border text-muted hover:border-accent/40",
                        )}
                      >
                        {h.keyword} · {relativeTime(new Date(h.createdAt))}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {current?.status === "failed" && (
        <Card className="p-4">
          <p className="text-sm text-danger">
            Scan failed: {current.error ?? "unknown error"} — try again in a
            minute.
          </p>
        </Card>
      )}

      {report && current && (
        <>
          {/* Niche pulse */}
          <Card className="scan-sweep p-5" data-testid="trend-report">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                Niche pulse — “{current.keyword}”
              </p>
              <Badge tone={report.generatedBy === "claude" ? "success" : "warning"}>
                {report.generatedBy === "claude" ? "Claude analysis" : "Demo analysis"}
              </Badge>
              {isDemo && <Badge tone="warning">demo signals</Badge>}
              {!pinned.includes(current.keyword) && (
                <button
                  disabled={pinBusy}
                  data-testid="trend-pin"
                  onClick={() =>
                    startPin(async () => {
                      const r = await pinKeywordAction(current.keyword);
                      if (!r.ok) setMessage(r.message ?? null);
                      router.refresh();
                    })
                  }
                  className="ml-auto rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted transition hover:border-accent/50 hover:text-accent-strong"
                >
                  📌 Pin — rescan daily
                </button>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed">{report.summary}</p>
          </Card>

          {/* Patterns + briefs */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="What's working"
                subtitle="Patterns pulled from the hottest posts"
              />
              <ul className="divide-y divide-border">
                {report.patterns.map((p) => (
                  <li key={p.name} className="px-4 py-3.5 md:px-5">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{p.why}</p>
                    <p className="mt-1.5 text-xs">
                      <span className="font-medium text-accent-strong">
                        Play it:
                      </span>{" "}
                      {p.playbook}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader
                title="Creative briefs for you"
                subtitle="Tap one to draft it in the composer"
              />
              <ul className="divide-y divide-border">
                {report.briefs.map((b, i) => (
                  <li key={i} className="px-4 py-3.5 md:px-5">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platformId={b.platformId} />
                      {b.bestHourUtc !== undefined && (
                        <span className="text-[11px] text-faint">
                          best slot {b.bestHourUtc}:00 UTC
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold">{b.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Hook: {b.hook}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {b.caption}
                    </p>
                    <Link
                      href={`/composer?brief=${encodeURIComponent(
                        `${b.title}. ${b.hook}`,
                      )}`}
                      data-testid={`trend-brief-${i}`}
                      className="mt-2 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-strong"
                    >
                      Send to Composer →
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Viral signals */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold md:text-base">
                Hottest signals
              </h2>
              <span className="text-[11px] text-faint">
                heat-ranked across platforms · {relativeTime(new Date(current.createdAt))}
              </span>
            </div>
            <div
              className="reveal-group grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              data-testid="trend-signals"
            >
              {signals.slice(0, 12).map((s) => (
                <Tilt key={s.url} max={4}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <Card className="h-full p-4 transition hover:border-accent/50">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platformId={s.platformId} />
                        <span className="text-[11px] text-faint">
                          {s.mediaType} · {relativeTime(new Date(s.postedAt))}
                        </span>
                        <span
                          className="ml-auto inline-block h-2 rounded-full"
                          style={{
                            width: `${Math.max(12, s.heat * 44)}px`,
                            background: PLATFORM_CHART_COLORS[s.platformId],
                            opacity: 0.4 + s.heat * 0.6,
                          }}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium">
                        {s.title}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted">
                        {s.author} · {compact(s.engagement.score)} engagements
                        {s.engagement.views
                          ? ` · ${compact(s.engagement.views)} views`
                          : ""}
                        {s.engagement.comments
                          ? ` · ${compact(s.engagement.comments)} comments`
                          : ""}
                      </p>
                    </Card>
                  </a>
                </Tilt>
              ))}
            </div>
          </section>
        </>
      )}

      {!current && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            Type your niche above and hit <strong>Scan</strong> — the radar
            pulls the hottest posts of the week and turns them into briefs for
            your accounts.
          </p>
        </Card>
      )}
    </div>
  );
}
