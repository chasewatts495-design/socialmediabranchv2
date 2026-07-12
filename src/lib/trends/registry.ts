import type { PlatformId } from "@/lib/connectors/types";
import type { TrendSource } from "./types";

/**
 * Pluggable source registry, mirroring the live-connector pattern: server
 * call sites import "./sources/register" (a side-effect module) so no
 * platform SDK code leaks into client bundles.
 */

const sources = new Map<PlatformId, TrendSource>();

export function registerTrendSource(source: TrendSource): void {
  sources.set(source.platformId, source);
}

export function listTrendSources(): TrendSource[] {
  return [...sources.values()];
}

export function trendSourceFor(platformId: PlatformId): TrendSource | null {
  return sources.get(platformId) ?? null;
}

/** Test hook: wipe registrations so suites can install fakes. */
export function __resetTrendSources(): void {
  sources.clear();
}
