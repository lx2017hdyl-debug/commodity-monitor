"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCommodityById, type CommodityConfig } from "@/lib/commodities";
import { formatChangePercent, formatPrice } from "@/lib/commodities";
import { loadCommodityDetailBrowser } from "@/lib/market-data-browser";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { formatFetchedAt } from "@/lib/format-time";
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
}

/** 品种详情页 */
export function CommodityDetail({ commodityId }: CommodityDetailProps) {
  const [range, setRange] = useState("1y");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const commodity = getCommodityById(commodityId);
    if (!commodity?.available) {
      setError(commodity?.unavailableReason ?? "该品种暂不可用");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const json = await loadCommodityDetailBrowser(commodity, range);
      setData(json as DetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [commodityId, range]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-800/60" />
      </div>
    );
  }

  if (error || !data) {
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

      {/* 数据声明 */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
        <p>{data.dataDisclaimer}</p>
        <p className="mt-2 text-xs text-amber-200/80">
          页面更新时间：{formatFetchedAt(data.serverTime)}
        </p>
      </div>

      {/* 当前价格 */}
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

      {/* 历史区间选择 */}
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRange(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              range === opt.value
                ? "bg-amber-500 text-slate-950 font-medium"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 历史走势 */}
      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="mb-4 text-lg font-semibold text-white">历史价格走势</h2>
        <PriceChart
          data={snapshot.history.map((h) => ({ date: h.date, price: h.close }))}
          unit={commodity.unit}
        />
      </section>

      {/* 趋势预测 */}
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
