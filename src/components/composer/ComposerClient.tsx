"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlatformId, ValidationIssue } from "@/lib/connectors/types";
import { PLATFORM_DEFS } from "@/lib/connectors/registry";
import { validateAgainstCapabilities } from "@/lib/connectors/validate";
import { adaptCaption, META_FIELDS } from "@/lib/posts/variants";
import { savePostAction, type SavePostResult } from "@/server/actions/posts";
import type { LibraryAsset } from "@/components/library/AssetGrid";
import { PlatformPreview } from "./PlatformPreview";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { ModeChip, PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { BranchProgress, type BranchStep } from "@/components/branch/BranchProgress";
import { BranchTransition } from "@/components/branch/BranchTransition";
import { Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import { IconCheck, IconWarning } from "@/components/ui/icons";

export interface ComposerAccount {
  id: string;
  platformId: PlatformId;
  handle: string;
  displayName: string;
  avatarColor: string;
  mode: string;
}

export interface ComposerInitial {
  postId?: string;
  caption?: string;
  mediaIds?: string[];
  targets?: { accountId: string; caption: string; meta: Record<string, unknown> }[];
  scheduledAt?: string | null;
}

interface VariantState {
  caption: string;
  meta: Record<string, unknown>;
  touched: boolean;
}

const STEPS: BranchStep[] = [
  { key: "media", label: "Media" },
  { key: "caption", label: "Caption" },
  { key: "accounts", label: "Accounts" },
  { key: "tweak", label: "Fine-tune" },
  { key: "launch", label: "Launch" },
];

function toLocalInputValue(date: Date): string {
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function ComposerClient({
  accounts,
  assets,
  initial,
}: {
  accounts: ComposerAccount[];
  assets: LibraryAsset[];
  initial: ComposerInitial;
}) {
  const router = useRouter();
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [caption, setCaption] = useState(initial.caption ?? "");
  const [mediaIds, setMediaIds] = useState<string[]>(initial.mediaIds ?? []);
  const [variants, setVariants] = useState<Record<string, VariantState>>(() => {
    const out: Record<string, VariantState> = {};
    for (const t of initial.targets ?? []) {
      out[t.accountId] = { caption: t.caption, meta: t.meta, touched: true };
    }
    return out;
  });
  const [selected, setSelected] = useState<string[]>(
    (initial.targets ?? []).map((t) => t.accountId),
  );
  const [activeTab, setActiveTab] = useState<string | null>(selected[0] ?? null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    initial.scheduledAt
      ? toLocalInputValue(new Date(initial.scheduledAt))
      : toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [busy, setBusy] = useState<"draft" | "now" | "schedule" | null>(null);
  const [result, setResult] = useState<SavePostResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    setDirection(clamped >= step ? 1 : -1);
    setStep(clamped);
  }

  const selectedAssets = useMemo(
    () =>
      mediaIds
        .map((id) => assets.find((a) => a.id === id))
        .filter((a): a is LibraryAsset => Boolean(a)),
    [mediaIds, assets],
  );

  const publishMedia = useMemo(
    () =>
      selectedAssets.map((a) => ({
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        width: a.width,
        height: a.height,
        durationSec: a.durationSec,
      })),
    [selectedAssets],
  );

  function toggleAccount(accountId: string) {
    const account = accountById.get(accountId);
    if (!account) return;
    setResult(null);
    if (selected.includes(accountId)) {
      setSelected((s) => s.filter((id) => id !== accountId));
      if (activeTab === accountId) setActiveTab(null);
      return;
    }
    setSelected((s) => [...s, accountId]);
    setVariants((v) => {
      if (v[accountId]?.touched) return v;
      const adapted = adaptCaption(account.platformId, caption, {
        accountHandle: account.handle,
      });
      return { ...v, [accountId]: { ...adapted, touched: false } };
    });
    setActiveTab(accountId);
  }

  function onMasterCaptionChange(next: string) {
    setCaption(next);
    setResult(null);
    setVariants((v) => {
      const out = { ...v };
      for (const accountId of selected) {
        if (out[accountId]?.touched) continue;
        const account = accountById.get(accountId);
        if (!account) continue;
        out[accountId] = {
          ...adaptCaption(account.platformId, next, {
            accountHandle: account.handle,
          }),
          touched: false,
        };
      }
      return out;
    });
  }

  function updateVariant(accountId: string, patch: Partial<VariantState>) {
    setVariants((v) => ({
      ...v,
      [accountId]: {
        caption: patch.caption ?? v[accountId]?.caption ?? "",
        meta: patch.meta ?? v[accountId]?.meta ?? {},
        touched: true,
      },
    }));
  }

  const validationByAccount = useMemo(() => {
    const out = new Map<string, ValidationIssue[]>();
    for (const accountId of selected) {
      const account = accountById.get(accountId);
      const variant = variants[accountId];
      if (!account || !variant) continue;
      const def = PLATFORM_DEFS[account.platformId];
      const res = validateAgainstCapabilities(
        def.capabilities,
        { caption: variant.caption, media: publishMedia, meta: variant.meta },
        def.extraValidation,
      );
      out.set(accountId, res.issues);
    }
    return out;
  }, [selected, variants, publishMedia, accountById]);

  const blockingAccounts = selected.filter((id) =>
    (validationByAccount.get(id) ?? []).some((i) => i.level === "error"),
  );

  const strictestLimit = Math.min(
    ...selected.map(
      (id) =>
        PLATFORM_DEFS[accountById.get(id)!.platformId].capabilities.constraints
          .maxCaptionChars,
    ),
    Infinity,
  );

  async function submit(mode: "draft" | "now" | "schedule") {
    setBusy(mode);
    setError(null);
    setResult(null);
    try {
      const res = await savePostAction({
        postId: initial.postId ?? null,
        caption,
        mediaIds,
        targets: selected.map((accountId) => ({
          accountId,
          caption: variants[accountId]?.caption ?? caption,
          meta: variants[accountId]?.meta ?? {},
        })),
        mode,
        scheduledAt:
          mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
      });
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
      } else if (mode === "draft") {
        router.push("/library");
      } else if (mode === "schedule") {
        router.push("/calendar");
      } else {
        setResult(res);
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  const activeAccount = activeTab ? accountById.get(activeTab) : null;
  const activeVariant = activeTab ? variants[activeTab] : null;

  /* ── Publish results panel ── */
  if (result?.targets) {
    const okCount = result.targets.filter((t) => t.status === "published").length;
    return (
      <div className="mx-auto max-w-xl space-y-4 fade-up">
        <h2 className="text-xl font-semibold md:text-2xl">
          {okCount === result.targets.length
            ? "Published everywhere 🎉"
            : `Published to ${okCount}/${result.targets.length} accounts`}
        </h2>
        <ul className="space-y-2">
          {result.targets.map((t) => {
            const account = accountById.get(t.accountId);
            if (!account) return null;
            const tone =
              t.status === "published"
                ? "text-success"
                : t.status === "manual_required"
                  ? "text-warning"
                  : t.status === "failed"
                    ? "text-danger"
                    : "text-muted";
            return (
              <li
                key={t.accountId}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <AccountAvatar
                  name={account.displayName}
                  color={account.avatarColor}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{account.handle}</p>
                  <p className={cn("text-xs", tone)}>
                    {t.status === "published" && "Published"}
                    {t.status === "manual_required" &&
                      "Manual step — post it in the app, then mark done in the queue"}
                    {t.status === "failed" && (t.errorMessage ?? "Failed")}
                    {!["published", "manual_required", "failed"].includes(t.status) &&
                      t.status}
                  </p>
                </div>
                {t.externalUrl && t.status === "published" && (
                  <a
                    href={t.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-accent-strong hover:underline"
                  >
                    View →
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex gap-3">
          <Link
            href="/calendar?tab=queue"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Open queue
          </Link>
          <button
            onClick={() => {
              setResult(null);
              router.push("/composer");
              router.refresh();
            }}
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-surface-3"
          >
            New post
          </button>
        </div>
      </div>
    );
  }

  /* ── Step bodies ── */

  const mediaStep = (
    <section>
      <StepHeading
        title="Pick your media"
        hint="Optional for text platforms — required by Instagram, TikTok, YouTube, Pinterest."
      />
      {assets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          Library is empty —{" "}
          <Link href="/library" className="text-accent-strong hover:underline">
            upload media
          </Link>{" "}
          first, or continue text-only.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {assets.map((a) => {
            const idx = mediaIds.indexOf(a.id);
            return (
              <button
                key={a.id}
                onClick={() => {
                  setResult(null);
                  setMediaIds((ids) =>
                    ids.includes(a.id)
                      ? ids.filter((id) => id !== a.id)
                      : [...ids, a.id],
                  );
                }}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border-2 transition",
                  idx >= 0
                    ? "border-accent"
                    : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.thumbnailUrl ?? a.url}
                  alt={a.altText ?? a.filename}
                  className="h-full w-full object-cover"
                />
                {idx >= 0 && (
                  <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                )}
                {a.mimeType.startsWith("video/") && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] text-white">
                    ▶
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const captionStep = (
    <section>
      <StepHeading
        title="Write it once"
        hint="Branch adapts this per platform in the Fine-tune step. Hashtags welcome."
      />
      <div className="mb-2 flex justify-end">
        {selected.length > 0 && Number.isFinite(strictestLimit) && (
          <span
            className={cn(
              "text-xs",
              caption.length > strictestLimit ? "text-danger" : "text-faint",
            )}
          >
            {caption.length}/{strictestLimit} (strictest platform)
          </span>
        )}
      </div>
      <textarea
        value={caption}
        onChange={(e) => onMasterCaptionChange(e.target.value)}
        rows={7}
        placeholder="What are you posting today?"
        className="w-full rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-accent"
        data-testid="master-caption"
      />
    </section>
  );

  const accountsStep = (
    <section>
      <StepHeading
        title="Choose the branches"
        hint={`${selected.length} selected — the post fans out to every account you pick.`}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => {
          const def = PLATFORM_DEFS[a.platformId];
          const checked = selected.includes(a.id);
          const manual = a.mode === "manual" || !def.capabilities.canPublish;
          const issues = validationByAccount.get(a.id) ?? [];
          const hasError = checked && issues.some((i) => i.level === "error");
          return (
            <button
              key={a.id}
              onClick={() => toggleAccount(a.id)}
              data-testid={`account-toggle-${a.platformId}-${a.id.slice(0, 4)}`}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left transition",
                checked
                  ? hasError
                    ? "border-danger/60 bg-danger-soft/30"
                    : "border-accent bg-accent-soft/40"
                  : "border-border bg-surface hover:border-faint",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white",
                  checked ? "border-accent bg-accent" : "border-faint",
                )}
              >
                {checked && <IconCheck width={12} height={12} />}
              </span>
              <AccountAvatar name={a.displayName} color={a.avatarColor} size={32} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{a.handle}</span>
                  <ModeChip mode={a.mode} />
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <PlatformBadge platformId={a.platformId} />
                  {manual && (
                    <span className="text-[10px] text-warning">manual checklist</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const tweakStep = (
    <section>
      <StepHeading
        title="Fine-tune per platform"
        hint="Each account got an auto-adapted variant — edit any of them."
      />
      {selected.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          No accounts selected yet — go back one step.
        </p>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {selected.map((id) => {
              const a = accountById.get(id);
              if (!a) return null;
              const issues = validationByAccount.get(id) ?? [];
              const hasError = issues.some((i) => i.level === "error");
              const hasWarning = issues.some((i) => i.level === "warning");
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition",
                    activeTab === id
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-surface-2 text-muted hover:text-ink",
                  )}
                >
                  {a.handle}
                  {hasError && (
                    <IconWarning width={12} height={12} className="text-danger" />
                  )}
                  {!hasError && hasWarning && (
                    <IconWarning width={12} height={12} className="text-warning" />
                  )}
                </button>
              );
            })}
          </div>

          {activeAccount && activeVariant && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <PlatformBadge platformId={activeAccount.platformId} />
                <span
                  className={cn(
                    "text-xs",
                    activeVariant.caption.length >
                      PLATFORM_DEFS[activeAccount.platformId].capabilities
                        .constraints.maxCaptionChars
                      ? "text-danger"
                      : "text-faint",
                  )}
                >
                  {activeVariant.caption.length}/
                  {
                    PLATFORM_DEFS[activeAccount.platformId].capabilities.constraints
                      .maxCaptionChars
                  }
                </span>
              </div>
              <textarea
                value={activeVariant.caption}
                onChange={(e) =>
                  updateVariant(activeAccount.id, { caption: e.target.value })
                }
                rows={4}
                className="w-full rounded-xl border border-border bg-surface-2 p-3 text-sm outline-none focus:border-accent"
                data-testid="variant-caption"
              />
              {(META_FIELDS[activeAccount.platformId] ?? []).map((f) => (
                <label key={f.key} className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {f.label}
                  </span>
                  <input
                    value={String(activeVariant.meta[f.key] ?? "")}
                    onChange={(e) =>
                      updateVariant(activeAccount.id, {
                        meta: { ...activeVariant.meta, [f.key]: e.target.value },
                      })
                    }
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </label>
              ))}

              {(validationByAccount.get(activeAccount.id) ?? []).map((issue, i) => (
                <div
                  key={`${issue.code}-${i}`}
                  className={cn(
                    "mt-3 flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-xs",
                    issue.level === "error"
                      ? "bg-danger-soft text-danger"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  <span>{issue.message}</span>
                  {issue.autofix?.caption !== undefined && (
                    <button
                      onClick={() =>
                        updateVariant(activeAccount.id, {
                          caption: issue.autofix!.caption!,
                        })
                      }
                      className="shrink-0 font-semibold underline"
                    >
                      Auto-fix
                    </button>
                  )}
                </div>
              ))}

              {/* Mobile: inline preview */}
              <div className="mt-4 lg:hidden">
                <PlatformPreview
                  platformId={activeAccount.platformId}
                  handle={activeAccount.handle}
                  displayName={activeAccount.displayName}
                  avatarColor={activeAccount.avatarColor}
                  caption={activeVariant.caption}
                  title={
                    typeof activeVariant.meta.title === "string"
                      ? activeVariant.meta.title
                      : undefined
                  }
                  media={selectedAssets}
                />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );

  const launchStep = (
    <section className="space-y-4">
      <StepHeading
        title="Ready to branch out"
        hint="Publish now, schedule it, or park it as a draft."
      />
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Going to {selected.length} account{selected.length === 1 ? "" : "s"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const a = accountById.get(id);
            if (!a) return null;
            const hasError = (validationByAccount.get(id) ?? []).some(
              (i) => i.level === "error",
            );
            return (
              <Badge key={id} tone={hasError ? "danger" : "accent"}>
                {a.handle}
                {hasError ? " ⚠" : ""}
              </Badge>
            );
          })}
          {selected.length === 0 && (
            <p className="text-xs text-muted">None yet — go back to Accounts.</p>
          )}
        </div>
        {caption && (
          <p className="mt-3 line-clamp-3 border-t border-border pt-3 text-xs text-muted whitespace-pre-wrap">
            {caption}
          </p>
        )}
        <p className="mt-2 text-[11px] text-faint">
          {selectedAssets.length} media item{selectedAssets.length === 1 ? "" : "s"}
          {blockingAccounts.length > 0 &&
            ` · fix ${blockingAccounts.length} account${blockingAccounts.length === 1 ? "" : "s"} in Fine-tune before publishing`}
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Mobile publishes from the sticky bar instead (avoids overlap). */}
      <div className="hidden md:block">
        <ActionButtons
          busy={busy}
          scheduleOpen={scheduleOpen}
          setScheduleOpen={setScheduleOpen}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          submit={submit}
          blockedCount={blockingAccounts.length}
          selectedCount={selected.length}
        />
      </div>
    </section>
  );

  const stepBodies = [mediaStep, captionStep, accountsStep, tweakStep, launchStep];

  return (
    <div className="pb-40 md:pb-0">
      <BranchProgress
        steps={STEPS}
        current={step}
        direction={direction}
        onStepClick={goTo}
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <BranchTransition step={step} direction={direction}>
            {stepBodies[step]}
          </BranchTransition>

          {/* Desktop step nav */}
          <div className="mt-6 hidden items-center gap-2 md:flex">
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                data-testid="step-back"
                className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-surface-3"
              >
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button
                onClick={() => goTo(step + 1)}
                data-testid="step-next"
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                Next: {STEPS[step + 1].label} →
              </button>
            )}
          </div>
        </div>

        {/* Sticky preview column (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-8 space-y-3">
            <h2 className="text-sm font-semibold">Preview</h2>
            {activeAccount && activeVariant ? (
              <PlatformPreview
                platformId={activeAccount.platformId}
                handle={activeAccount.handle}
                displayName={activeAccount.displayName}
                avatarColor={activeAccount.avatarColor}
                caption={activeVariant.caption}
                title={
                  typeof activeVariant.meta.title === "string"
                    ? activeVariant.meta.title
                    : undefined
                }
                media={selectedAssets}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted">
                Select an account to preview how the post will look.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky nav bar */}
      <div
        className="fixed inset-x-0 bottom-14 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {step < STEPS.length - 1 ? (
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium"
              >
                ←
              </button>
            )}
            <button
              onClick={() => goTo(step + 1)}
              className="flex-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white"
            >
              Next: {STEPS[step + 1].label} →
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(step - 1)}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <ActionButtons
                busy={busy}
                scheduleOpen={scheduleOpen}
                setScheduleOpen={setScheduleOpen}
                scheduledAt={scheduledAt}
                setScheduledAt={setScheduledAt}
                submit={submit}
                blockedCount={blockingAccounts.length}
                selectedCount={selected.length}
                compact
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-tight md:text-lg">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function ActionButtons({
  busy,
  scheduleOpen,
  setScheduleOpen,
  scheduledAt,
  setScheduledAt,
  submit,
  blockedCount,
  selectedCount,
  compact,
}: {
  busy: "draft" | "now" | "schedule" | null;
  scheduleOpen: boolean;
  setScheduleOpen: (v: boolean) => void;
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  submit: (mode: "draft" | "now" | "schedule") => void;
  blockedCount: number;
  selectedCount: number;
  compact?: boolean;
}) {
  const publishDisabled = busy !== null || selectedCount === 0 || blockedCount > 0;
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2", compact && "justify-between")}>
      <button
        onClick={() => submit("draft")}
        disabled={busy !== null}
        className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition hover:bg-surface-3 disabled:opacity-50"
      >
        {busy === "draft" ? <Spinner /> : "Save draft"}
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScheduleOpen(!scheduleOpen)}
          disabled={busy !== null}
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50",
            scheduleOpen
              ? "border-accent bg-accent-soft text-accent-strong"
              : "border-border bg-surface-2 hover:bg-surface-3",
          )}
        >
          Schedule
        </button>
        {scheduleOpen && (
          <>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={() => submit("schedule")}
              disabled={publishDisabled}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
            >
              {busy === "schedule" ? (
                <Spinner className="border-white/40 border-t-white" />
              ) : (
                "Confirm"
              )}
            </button>
          </>
        )}
      </div>
      {!scheduleOpen && (
        <button
          onClick={() => submit("now")}
          disabled={publishDisabled}
          data-testid="publish-now"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
        >
          {busy === "now" ? (
            <Spinner className="border-white/40 border-t-white" />
          ) : (
            `Publish now${selectedCount ? ` (${selectedCount})` : ""}`
          )}
        </button>
      )}
      {blockedCount > 0 && (
        <Badge tone="danger">
          Fix {blockedCount} account{blockedCount === 1 ? "" : "s"} first
        </Badge>
      )}
    </div>
  );
}
