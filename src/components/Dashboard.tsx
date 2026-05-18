"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatFetchedAt } from "@/lib/format-time";
import { isServerDataMode } from "@/lib/deploy-config";
import { loadDashboardWithCache, type DashboardQuotes } from "@/lib/quotes-client";
import { readQuotesCache, writeQuotesCache } from "@/lib/quotes-cache";
import { PriceCard } from "./PriceCard";

type MarketFilter = "all" | "domestic" | "international";

interface DashboardProps {
  initialData?: DashboardQuotes | null;
}

/** 主看板 */
export function Dashboard({ initialData = null }: DashboardProps) {
  const [data, setData] = useState<DashboardQuotes | null>(initialData);
  const [loading, setLoading] = useState(!initialData?.quotes?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const abortRef = useRef<AbortController | null>(null);

  const loadQuotes = useCallback(async (soft = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!soft) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const json = await loadDashboardWithCache((cached) => {
        setData(cached);
        setLoading(false);
      });
      if (!abortRef.current.signal.aborted) setData(json);
    } catch (e) {
      if (!abortRef.current.signal.aborted) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    } finally {
      if (!abortRef.current.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialData?.quotes?.length) {
      writeQuotesCache(initialData);
      // 已有服务端数据，延迟 45 秒再后台刷新，避免打开瞬间重复请求
      const delayed = setTimeout(() => void loadQuotes(true), 45_000);
      const intervalMs = 2 * 60 * 1000;
      const timer = setInterval(() => void loadQuotes(true), intervalMs);
      return () => {
        clearTimeout(delayed);
        clearInterval(timer);
        abortRef.current?.abort();
      };
    }

    const cached = readQuotesCache<DashboardQuotes>();
    if (cached) {
      setData(cached);
      setLoading(false);
      void loadQuotes(true);
    } else {
      void loadQuotes(false);
    }

    const intervalMs = isServerDataMode() ? 2 * 60 * 1000 : 5 * 60 * 1000;
    const timer = setInterval(() => void loadQuotes(true), intervalMs);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [loadQuotes, initialData]);

  const filtered =
    data?.quotes.filter((q) => filter === "all" || q.commodity.market === filter) ?? [];

  const showSkeleton = loading && !data?.quotes?.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p className="font-semibold text-amber-300">数据说明</p>
        <p className="mt-1 leading-relaxed">
          {data?.dataDisclaimer ??
            "本网站展示延迟行情，每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。"}
        </p>
        {data?.serverTime && (
          <p className="mt-2 text-xs text-amber-200/80">
            页面数据更新时间：{formatFetchedAt(data.serverTime)}
            {refreshing
              ? " · 正在后台更新…"
              : isServerDataMode()
                ? " · 每 2 分钟自动刷新"
                : " · 每 5 分钟自动刷新"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(
            [
              ["all", "全部"],
              ["domestic", "国内期货"],
              ["international", "国际期货"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                filter === key
                  ? "bg-amber-500 text-slate-950 font-medium"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void loadQuotes(true)}
          disabled={loading || refreshing}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading || refreshing ? "刷新中…" : "手动刷新"}
        </button>
      </div>

      {error && !data?.quotes?.length && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
          加载失败：{error}。请检查网络后点击「手动刷新」。
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {showSkeleton
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-800/60" />
            ))
          : filtered.map((item) => (
              <PriceCard key={item.commodity.id} commodity={item.commodity} snapshot={item.snapshot} />
            ))}
      </div>

      {data && data.unavailable.length > 0 && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">暂不可用品种</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {data.unavailable.map((c) => (
              <li key={c.id}>
                <span className="text-slate-200">{c.name}</span>
                <span className="mx-2 text-slate-600">·</span>
                {c.market === "domestic" ? "国内" : "国际"}
                <span className="mx-2 text-slate-600">—</span>
                {c.unavailableReason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
