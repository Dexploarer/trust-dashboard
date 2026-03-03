"use client";

import { useCallback, useEffect, useState } from "react";
import { getTrustDataSnapshot, normalizeTrustData, type TrustDataSnapshot } from "./data-loader";
import { withBasePath } from "./base-path";

const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_SECONDS = REFRESH_INTERVAL_MS / 1000;
const LIVE_SCORES_URL =
  process.env.NEXT_PUBLIC_LIVE_SCORES_URL ??
  "https://raw.githubusercontent.com/milady-ai/trust-dashboard/main/src/data/trust-scores.json";
const RESOLVED_LIVE_SCORES_URL = LIVE_SCORES_URL.startsWith("/") ? withBasePath(LIVE_SCORES_URL) : LIVE_SCORES_URL;

const INITIAL_SNAPSHOT = getTrustDataSnapshot();

export interface LiveTrustData extends TrustDataSnapshot {
  isLoading: boolean;
  isRefreshing: boolean;
  refreshError: string | null;
  nextRefreshIn: number;
  lastUpdatedAt: string;
}

export function useLiveTrustData(): LiveTrustData {
  const [snapshot, setSnapshot] = useState<TrustDataSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_SECONDS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(INITIAL_SNAPSHOT.generatedAt);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(RESOLVED_LIVE_SCORES_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Live ranking fetch failed (${response.status})`);
      }

      const remoteData = await response.json();
      const normalized = normalizeTrustData(remoteData);

      setSnapshot(normalized);
      setLastUpdatedAt(normalized.generatedAt);
      setRefreshError(null);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh live rankings");
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
