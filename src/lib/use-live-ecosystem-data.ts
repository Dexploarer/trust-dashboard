"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "./base-path";
import {
  getCombinedLeaderboardSnapshot,
  normalizeCombinedData,
} from "./ecosystem-data-loader";
import type { CombinedLeaderboardData } from "./ecosystem-types";

const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_SECONDS = REFRESH_INTERVAL_MS / 1000;
const LIVE_ECOSYSTEM_URL =
  process.env.NEXT_PUBLIC_LIVE_ECOSYSTEM_URL ??
  "https://raw.githubusercontent.com/milady-ai/trust-dashboard/main/src/data/combined-leaderboard.json";
const RESOLVED_LIVE_ECOSYSTEM_URL = LIVE_ECOSYSTEM_URL.startsWith("/")
  ? withBasePath(LIVE_ECOSYSTEM_URL)
  : LIVE_ECOSYSTEM_URL;

const INITIAL_DATA = getCombinedLeaderboardSnapshot();

export interface LiveEcosystemData extends CombinedLeaderboardData {
  isLoading: boolean;
  isRefreshing: boolean;
  refreshError: string | null;
  nextRefreshIn: number;
  lastUpdatedAt: string;
}

export function useLiveEcosystemData(): LiveEcosystemData {
  const [snapshot, setSnapshot] = useState<CombinedLeaderboardData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_SECONDS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(INITIAL_DATA.generatedAt);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(RESOLVED_LIVE_ECOSYSTEM_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Live ecosystem fetch failed (${response.status})`);
      }

      const remote = await response.json();
      const normalized = normalizeCombinedData(remote);

      setSnapshot(normalized);
      setLastUpdatedAt(normalized.generatedAt);
      setRefreshError(null);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh ecosystem data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setNextRefreshIn(REFRESH_INTERVAL_SECONDS);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNextRefreshIn((value) => (value <= 1 ? REFRESH_INTERVAL_SECONDS : value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return {
    ...snapshot,
    isLoading,
    isRefreshing,
    refreshError,
    nextRefreshIn,
    lastUpdatedAt,
  };
}
