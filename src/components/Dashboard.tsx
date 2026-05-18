"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommodityConfig } from "@/lib/commodities";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { formatFetchedAt } from "@/lib/format-time";
import { PriceCard } from "./PriceCard";

interface QuoteItem {
  commodity: CommodityConfig;
  snapshot: QuoteSnapshot;
}

interface QuotesResponse {
  dataDisclaimer: string;
  serverTime: string;
  quotes: QuoteItem[];
  unavailable: CommodityConfig[];
  errors: Array<{ id: string; error: string } | null>;
}

type MarketFilter = "all" | "domestic" | "international";

interface DashboardProps {
  /** 服务端预加载的数据（内网分享时必需） */
  initialData?: QuotesResponse;
}

/** 主看板 */
export function Dashboard({ initialData }: DashboardProps) {
  const [data, setData] = useState<QuotesResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData?.quotes?.length);
  const [error, setError] = useState<string | null>(
    initialData && !initialData.quotes?.length
      ? (initialData.errors?.[0]?.error ?? "暂无行情数据")
      : null,
  );
  const [filter, setFilter] = useState<MarketFilter>("all");

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/quotes", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`加载失败 (${res.status})`);
      const json = (await res.json()) as QuotesResponse;
      if (!json.quotes?.length) {
        throw new Error(json.errors?.[0]?.error ?? "暂无行情数据，请稍后重试");
      }
      setData(json);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("加载超时（30 秒），请检查网络后点击「手动刷新」");
      } else {
        setError(e instanceof Error ? e.message : "未知错误");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let delayed: ReturnType<typeof setTimeout> | undefined;
    if (initialData?.quotes?.length) {
      delayed = setTimeout(() => void loadQuotes(), 2000);
    } else {
      void loadQuotes();
    }
    const timer = setInterval(() => void loadQuotes(), 5 * 60 * 1000);
    return () => {
      if (delayed) clearTimeout(delayed);
      clearInterval(timer);
    };
  }, [loadQuotes, initialData?.quotes?.length]);

  const filtered =
    data?.quotes.filter((q) => filter === "all" || q.commodity.market === filter) ?? [];

  return (
    <div className="space-y-6">
      {/* 数据声明 */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p className="font-semibold text-amber-300">数据说明</p>
        <p className="mt-1 leading-relaxed">
          {data?.dataDisclaimer ??
            "本网站展示延迟行情，每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。"}
        </p>
        {data?.serverTime && (
          <p className="mt-2 text-xs text-amber-200/80">
            页面数据更新时间：{formatFetchedAt(data.serverTime)} · 每 5 分钟自动刷新
          </p>
        )}
      </div>

      {/* 筛选与刷新 */}
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
          onClick={() => void loadQuotes()}
          disabled={loading}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "刷新中…" : "手动刷新"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-red-200">
          加载失败：{error}。请检查网络后重试。
        </div>
      )}

      {/* 价格卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-800/60" />
            ))
          : filtered.map((item) => (
              <PriceCard key={item.commodity.id} commodity={item.commodity} snapshot={item.snapshot} />
            ))}
      </div>

      {/* 暂不可用品种 */}
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

      {data && data.errors.length > 0 && (
        <section className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4 text-sm text-orange-200">
          <p className="font-medium">部分品种拉取失败</p>
          <ul className="mt-2 list-inside list-disc">
            {data.errors.map((e) =>
              e ? (
                <li key={e.id}>
                  {e.id}: {e.error}
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
