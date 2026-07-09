"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AccountAudit,
  AdBrief,
  ContentPlan,
  PostIdeas,
  ReportType,
  WeeklyReview,
} from "@/lib/ai/contracts";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_IDS } from "@/lib/connectors/types";
import { applyPlanAction, startReportAction } from "@/server/actions/ai";
import { PLATFORM_LABELS } from "@/lib/metrics/colors";
import { Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import { relativeTime } from "@/lib/relative-time";

export interface ReportRow {
  id: string;
  type: string;
  status: string;
  generatedBy: string | null;
  model: string | null;
  error: string | null;
  createdAt: string;
  result: unknown;
}

export interface StrategistAccount {
  id: string;
  handle: string;
  platformId: PlatformId;
  mode: string;
}

/* ── Result renderers ──────────────────────────────────────────────────── */

function GradeBadge({ grade }: { grade: string }) {
  const tone =
    grade === "A" ? "success" : grade === "B" ? "info" : grade === "C" ? "warning" : "danger";
  return <Badge tone={tone}>Grade {grade}</Badge>;
}

function AuditView({ data }: { data: AccountAudit }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{data.overallSummary}</p>
      {data.perAccount.map((a) => (
        <details key={a.accountHandle} className="rounded-xl border border-border bg-surface-2 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            {a.accountHandle}
            <span className="text-[11px] text-faint">{PLATFORM_LABELS[a.platform]}</span>
            <GradeBadge grade={a.grade} />
          </summary>
          <div className="mt-3 space-y-2 text-xs">
            <p className="font-semibold text-success">Working</p>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {a.working.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="font-semibold text-danger">Not working</p>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {a.notWorking.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="font-semibold">Recommendations</p>
            <ul className="space-y-1.5">
              {a.recommendations.map((r, i) => (
                <li key={i} className="rounded-lg bg-surface p-2">
                  <span className="font-medium">{r.action}</span>
                  <span className="mt-0.5 block text-muted">{r.why}</span>
                  <span className="mt-1 flex gap-1.5">
                    <Badge tone={r.impact === "high" ? "success" : "neutral"}>
                      impact: {r.impact}
                    </Badge>
                    <Badge tone={r.effort === "low" ? "info" : "neutral"}>
                      effort: {r.effort}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
      <div>
        <p className="mb-1 text-xs font-semibold">Quick wins this week</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
          {data.quickWins.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlanView({ data, reportId }: { data: ContentPlan; reportId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{data.rationale}</p>
      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {data.items.map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-2 p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{item.date}</span>
              <span className="text-faint">{item.timeLocal}</span>
              {item.platforms.map((p) => (
                <Badge key={p}>{PLATFORM_LABELS[p]}</Badge>
              ))}
              <Badge tone="accent">{item.format}</Badge>
            </div>
            <p className="mt-1 font-medium">{item.hook}</p>
            <p className="mt-0.5 text-muted">{item.topic} — {item.mediaBrief}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await applyPlanAction(reportId);
              setMessage(res.message ?? null);
              if (res.ok) router.refresh();
            })
          }
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? <Spinner className="border-white/40 border-t-white" /> : "Apply plan → create drafts"}
        </button>
      </div>
      {message && <p className="text-xs text-success">{message}</p>}
    </div>
  );
}

function IdeasView({ data }: { data: PostIdeas }) {
  return (
    <div className="space-y-2 text-sm">
      <Badge>{PLATFORM_LABELS[data.platform]}</Badge>
      {data.ideas.map((idea, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface-2 p-3 text-xs">
          <p className="font-semibold">{idea.hook}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted">{idea.caption}</p>
          <p className="mt-1.5 text-faint">
            {idea.format} · best at {idea.bestTimeLocal} · {idea.why}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReviewView({ data }: { data: WeeklyReview }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{data.headline}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-success">Wins</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
            {data.wins.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-danger">Concerns</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
            {data.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold">Next week</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
          {data.nextWeekFocus.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdBriefView({ data }: { data: AdBrief }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="font-semibold">{data.product}</span>{" "}
        <span className="text-muted">· goal: {data.goal}</span>
      </p>
      <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs">
        <p className="font-semibold">Audience</p>
        <p className="mt-1 text-muted">{data.audiencePersona.description}</p>
        <p className="mt-1.5">
          <span className="text-danger">Pains:</span>{" "}
          <span className="text-muted">{data.audiencePersona.painPoints.join(" · ")}</span>
        </p>
        <p className="mt-0.5">
          <span className="text-success">Desires:</span>{" "}
          <span className="text-muted">{data.audiencePersona.desires.join(" · ")}</span>
        </p>
        <p className="mt-1.5 font-medium">Core angle: {data.coreAngle}</p>
      </div>
      {data.perPlatform.map((p) => (
        <details key={`${p.platform}-${p.accountHandle}`} className="rounded-xl border border-border bg-surface-2 p-3">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
            {p.accountHandle} <Badge>{PLATFORM_LABELS[p.platform]}</Badge>{" "}
            <Badge tone="accent">{p.format}</Badge>
          </summary>
          <div className="mt-2 space-y-2 text-xs">
            <p className="font-semibold">Hook: <span className="font-normal">{p.hook}</span></p>
            <div>
              <p className="font-semibold">Script</p>
              <ul className="mt-1 space-y-1">
                {p.script.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-mono text-faint">{s.step}</span>
                    <span className="text-muted">{s.direction}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p><span className="font-semibold">Caption:</span> <span className="whitespace-pre-wrap text-muted">{p.caption}</span></p>
            <p><span className="font-semibold">CTA:</span> <span className="text-muted">{p.cta}</span> · <span className="font-semibold">Cover:</span> <span className="text-muted">{p.thumbnailConcept}</span></p>
            <p><span className="font-semibold">Sound/trend:</span> <span className="text-muted">{p.soundOrTrend}</span></p>
            <div>
              <p className="font-semibold">Psychology</p>
              <ul className="mt-1 space-y-1">
                {p.psychologyNotes.map((n, i) => (
                  <li key={i} className="rounded-lg bg-surface p-2">
                    <Badge tone="accent">{n.principle}</Badge>
                    <span className="mt-1 block text-muted">
                      <span className="font-medium text-ink">{n.element}:</span> {n.why}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-faint">{p.metricRationale}</p>
          </div>
        </details>
      ))}
      <div>
        <p className="mb-1 text-xs font-semibold">Case-study patterns used</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
          {data.caseStudyReferences.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReportResult({ report }: { report: ReportRow }) {
  if (report.status === "failed") {
    return <p className="text-xs text-danger">{report.error ?? "Generation failed."}</p>;
  }
  if (report.status !== "complete" || !report.result) {
    return <Spinner />;
  }
  switch (report.type) {
    case "account_audit":
      return <AuditView data={report.result as AccountAudit} />;
    case "content_plan":
      return <PlanView data={report.result as ContentPlan} reportId={report.id} />;
    case "post_ideas":
      return <IdeasView data={report.result as PostIdeas} />;
    case "weekly_review":
      return <ReviewView data={report.result as WeeklyReview} />;
    case "ad_brief":
      return <AdBriefView data={report.result as AdBrief} />;
    default:
      return <pre className="text-xs">{JSON.stringify(report.result, null, 2)}</pre>;
  }
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

const REPORT_LABELS: Record<string, string> = {
  account_audit: "Account audit",
  content_plan: "2-week content plan",
  post_ideas: "Post ideas",
  weekly_review: "Weekly review",
  ad_brief: "Ad Builder brief",
};

export function ReportsPanel({
  reports,
  accounts,
  aiEnabled,
}: {
  reports: ReportRow[];
  accounts: StrategistAccount[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [pendingType, setPendingType] = useState<ReportType | null>(null);
  const [ideasPlatform, setIdeasPlatform] = useState<PlatformId>("instagram");
  const [adOpen, setAdOpen] = useState(false);
  const [adProduct, setAdProduct] = useState("");
  const [adGoal, setAdGoal] = useState("sales");
  const [adAccounts, setAdAccounts] = useState<string[]>([]);
  const [openReport, setOpenReport] = useState<string | null>(reports[0]?.id ?? null);

  async function run(type: ReportType, params: Record<string, unknown> = {}) {
    setPendingType(type);
    try {
      const res = await startReportAction({ type, params });
      if (res.ok && res.reportId) setOpenReport(res.reportId);
      router.refresh();
    } finally {
      setPendingType(null);
    }
  }

  return (
    <div className="space-y-4">
      {!aiEnabled && (
        <p className="rounded-xl bg-info-soft px-3 py-2.5 text-xs text-info">
          Demo analysis mode — deterministic insights computed from your real
          data. Add an Anthropic API key in Settings for the full Claude
          strategist.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["account_audit", "content_plan", "weekly_review"] as const).map((t) => (
          <button
            key={t}
            onClick={() => run(t)}
            disabled={pendingType !== null}
            className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-medium transition hover:border-accent disabled:opacity-50"
          >
            {pendingType === t ? <Spinner /> : REPORT_LABELS[t]}
          </button>
        ))}
        <span className="flex items-center gap-1">
          <button
            onClick={() => run("post_ideas", { platform: ideasPlatform })}
            disabled={pendingType !== null}
            className="rounded-l-xl border border-border bg-surface-2 px-3 py-2 text-xs font-medium transition hover:border-accent disabled:opacity-50"
          >
            {pendingType === "post_ideas" ? <Spinner /> : "Post ideas"}
          </button>
          <select
            value={ideasPlatform}
            onChange={(e) => setIdeasPlatform(e.target.value as PlatformId)}
            className="h-[34px] rounded-r-xl border border-border bg-surface-2 px-2 text-xs outline-none"
            aria-label="Platform for post ideas"
          >
            {PLATFORM_IDS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </span>
        <button
          onClick={() => setAdOpen(!adOpen)}
          className={cn(
            "rounded-xl px-3 py-2 text-xs font-semibold transition",
            adOpen ? "bg-surface-3" : "bg-accent text-white hover:bg-accent-strong",
          )}
        >
          🎯 Ad Builder
        </button>
      </div>

      {adOpen && (
        <div className="rounded-2xl border border-accent/40 bg-surface-2 p-4 fade-up">
          <p className="mb-3 text-xs text-muted">
            Describe what you're promoting — the strategist builds a
            platform-specific campaign brief with scripts, captions, CTAs, and
            the psychology behind every element.
          </p>
          <div className="space-y-3">
            <input
              value={adProduct}
              onChange={(e) => setAdProduct(e.target.value)}
              placeholder="Product / offer (e.g. 'Autumn capsule collection — 20% launch discount')"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
              data-testid="ad-product"
            />
            <div className="flex flex-wrap gap-2">
              {["sales", "reach", "followers", "signups"].map((g) => (
                <button
                  key={g}
                  onClick={() => setAdGoal(g)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs capitalize transition",
                    adGoal === g ? "bg-accent text-white" : "bg-surface-3 text-muted",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() =>
                    setAdAccounts((cur) =>
                      cur.includes(a.id)
                        ? cur.filter((id) => id !== a.id)
                        : [...cur, a.id],
                    )
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] transition",
                    adAccounts.includes(a.id)
                      ? "border-accent bg-accent-soft text-accent-strong"
                      : "border-border bg-surface text-muted",
                  )}
                >
                  {a.handle}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                run("ad_brief", {
                  product: adProduct,
                  goal: adGoal,
                  accountIds: adAccounts,
                })
              }
              disabled={!adProduct.trim() || pendingType !== null}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
              data-testid="ad-build"
            >
              {pendingType === "ad_brief" ? (
                <Spinner className="border-white/40 border-t-white" />
              ) : (
                "Build campaign brief"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {reports.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No reports yet — run one above. Everything works in demo mode.
          </p>
        )}
        {reports.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-surface">
            <button
              onClick={() => setOpenReport(openReport === r.id ? null : r.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="flex-1 text-sm font-medium">
                {REPORT_LABELS[r.type] ?? r.type}
              </span>
              <Badge tone={r.generatedBy === "claude" ? "accent" : "neutral"}>
                {r.generatedBy === "claude" ? (r.model ?? "Claude") : "Demo analysis"}
              </Badge>
              {r.status === "failed" && <Badge tone="danger">failed</Badge>}
              <span className="text-[11px] text-faint">{relativeTime(r.createdAt)}</span>
            </button>
            {openReport === r.id && (
              <div className="border-t border-border px-4 py-3">
                <ReportResult report={r} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
