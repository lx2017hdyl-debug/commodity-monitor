"use client";

import Link from "next/link";
import type { CommodityConfig } from "@/lib/commodities";
import { formatChangePercent, formatPrice } from "@/lib/commodities";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { DataTimestamp } from "./DataTimestamp";

interface PriceCardProps {
  commodity: CommodityConfig;
  snapshot: QuoteSnapshot;
}

/** 品种价格卡片 */
export function PriceCard({ commodity, snapshot }: PriceCardProps) {
  const isUp = snapshot.change >= 0;

  return (
    <Link
      href={`/commodity/${commodity.id}`}
      prefetch
      className="group flex flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4 transition hover:border-slate-500 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{commodity.name}</h3>
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                commodity.market === "domestic"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {commodity.market === "domestic" ? "国内" : "国际"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {commodity.exchange} · {commodity.quoteSymbol}
          </p>
        </div>
        <span className="text-slate-500 transition group-hover:text-slate-300">→</span>
      </div>

      <div>
        <p className="text-2xl font-bold tabular-nums text-white">
          {formatPrice(snapshot.price, commodity.unit)}
        </p>
        <p className={`mt-1 text-sm font-medium tabular-nums ${isUp ? "text-red-400" : "text-green-400"}`}>
          {isUp ? "▲" : "▼"} {formatChangePercent(snapshot.changePercent)} (
          {isUp ? "+" : ""}
          {snapshot.change.toLocaleString("zh-CN", { maximumFractionDigits: 4 })})
        </p>
      </div>

      <DataTimestamp marketTime={snapshot.marketTime} fetchedAt={snapshot.fetchedAt} compact />
    </Link>
  );
}
