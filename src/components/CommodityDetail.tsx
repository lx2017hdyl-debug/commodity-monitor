"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommodityConfig } from "@/lib/commodities";
import { getCommodityById } from "@/lib/commodities";
import { formatChangePercent, formatPrice } from "@/lib/commodities";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { generatePriceForecast } from "@/lib/sina-finance";
import { formatFetchedAt } from "@/lib/format-time";
import {
  loadCommodityDetailFast,
  loadCommodityHistoryFast,
} from "@/lib/quotes-client";
import { readQuoteFromCache } from "@/lib/quotes-cache";
import { DataTimestamp } from "./DataTimestamp";
import { PriceChart } from "./PriceChart";

interface ForecastPoint {
  date: string;
  price: number;
  isForecast: boolean;
}

interface DetailResponse {
  dataDisclaimer: string;
  serverTime: string;
  commodity: CommodityConfig;
  snapshot: QuoteSnapshot;
  forecast: ForecastPoint[];
  error?: string;
}

const RANGE_OPTIONS = [
  { value: "1mo", label: "1 个月" },
  { value: "3mo", label: "3 个月" },
  { value: "6mo", label: "6 个月" },
  { value: "1y", label: "1 年" },
  { value: "2y", label: "2 年" },
];

interface CommodityDetailProps {
  commodityId: string;
  initialData?: DetailResponse | null;
}

/** 品种详情页 */
export function CommodityDetail({ commodityId, initialData = null }: CommodityDetailProps) {
  const [range, setRange] = useState("3mo");
  const [data, setData] = useState<DetailResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipRangeEffect = useRef(true);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const loadDetail = useCallback(
    async (soft = false) => {
      if (!soft) {
        setLoading(true);
        setError(null);
      }

      const commodity = getCommodityById(commodityId);
      const cached = readQuoteFromCache(commodityId) as QuoteSnapshot | null;
      if (!soft && cached?.price && commodity && !initialData) {
        setData({
          dataDisclaimer:
            "数据来源为东方财富/新浪财经公开接口，延迟行情仅供采购参考。",
          serverTime: new Date().toISOString(),
          commodity,
          snapshot: { ...cached, history: [] },
          forecast: [],
        });
        setLoading(false);
      }

      try {
        const json = await loadCommodityDetailFast(commodityId, rangeRef.current);
        setData(json);
      } catch (e) {
        if (!soft) setError(e instanceof Error ? e.message : "未知错误");
      } finally {
        setLoading(false);
      }
    },
    [commodityId, initialData],
  );

  const loadHistoryOnly = useCallback(
    async (nextRange: string) => {
      setChartLoading(true);
      setError(null);
      try {
        const history = await loadCommodityHistoryFast(commodityId, nextRange);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            snapshot: { ...prev.snapshot, history },
            forecast: generatePriceForecast(history, 14),
          };
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "K 线加载失败");
      } finally {
        setChartLoading(false);
      }
    },
    [commodityId],
  );

  useEffect(() => {
    skipRangeEffect.current = true;
    if (initialData) return;
    void loadDetail(false);
  }, [commodityId, initialData, loadDetail]);

  useEffect(() => {
    if (skipRangeEffect.current) {
      skipRangeEffect.current = false;
      return;
    }
    void loadHistoryOnly(range);
  }, [range, loadHistoryOnly]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-800/60" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-6 text-red-200">
        <p className="font-medium">无法加载该品种</p>
        <p className="mt-2 text-sm">{error}</p>
        <Link href="/" className="mt-4 inline-block text-amber-400 hover:underline">
          ← 返回看板
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { commodity, snapshot, forecast } = data;
  const isUp = snapshot.change >= 0;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-amber-400">
        ← 返回看板
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">{commodity.name}</h1>
            <span
              className={`rounded px-2 py-0.5 text-sm ${
                commodity.market === "domestic"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {commodity.market === "domestic" ? "国内期货" : "国际期货"}
            </span>
          </div>
          <p className="mt-1 text-slate-400">
            {commodity.exchange} · {commodity.quoteSymbol} · {commodity.unit}
          </p>
        </div>
        <DataTimestamp marketTime={snapshot.marketTime} fetchedAt={snapshot.fetchedAt} />
      </header>

      <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p>{data.dataDisclaimer}</p>
        <p className="mt-2 text-xs text-amber-200/80">
          页面更新时间：{formatFetchedAt(data.serverTime)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="最新价" value={formatPrice(snapshot.price, commodity.unit)} highlight />
        <StatBox
          label="涨跌幅"
          value={formatChangePercent(snapshot.changePercent)}
          valueClass={isUp ? "text-red-400" : "text-green-400"}
        />
        <StatBox label="昨收" value={formatPrice(snapshot.previousClose, commodity.unit)} />
        {snapshot.dayHigh != null && snapshot.dayLow != null && (
          <StatBox
            label="日内区间"
            value={`${snapshot.dayLow.toLocaleString("zh-CN")} – ${snapshot.dayHigh.toLocaleString("zh-CN")}`}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRange(opt.value)}
            disabled={chartLoading}
            className={`rounded-lg px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              range === opt.value
                ? "bg-amber-500 text-slate-950 font-medium"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="relative rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">历史价格走势</h2>
        {chartLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/70 text-sm text-slate-300">
            图表加载中…
          </div>
        )}
        {snapshot.history.length > 0 ? (
          <PriceChart
            data={snapshot.history.map((h) => ({ date: h.date, price: h.close }))}
            unit={commodity.unit}
          />
        ) : (
          <div className="flex h-80 items-center justify-center text-slate-400">正在加载历史数据…</div>
        )}
      </section>

      {forecast.length > 0 && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-1 text-lg font-semibold text-white">趋势预测（参考）</h2>
          <p className="mb-4 text-xs text-slate-400">
            基于近 60 日收盘价的线性回归外推，虚线为未来 14 日预测区间，不代表实际走势。
          </p>
          <PriceChart data={forecast} unit={commodity.unit} showForecast />
        </section>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
  valueClass,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 tabular-nums ${highlight ? "text-2xl font-bold text-white" : "text-lg text-slate-200"} ${valueClass ?? ""}`}
      >
        {value}
      </p>
    </div>
  );
}
