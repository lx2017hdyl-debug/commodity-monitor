"use client";

import { formatBeijingTime, formatFetchedAt } from "@/lib/format-time";

interface DataTimestampProps {
  /** 市场数据时间（Unix 秒） */
  marketTime?: number;
  /** 服务端拉取时间（ISO） */
  fetchedAt?: string;
  /** 是否紧凑显示 */
  compact?: boolean;
}

/** 显著标注数据时间 */
export function DataTimestamp({ marketTime, fetchedAt, compact }: DataTimestampProps) {
  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-100 ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-amber-300">⏱ 延迟行情</span>
        {marketTime != null && (
          <span>
            市场时间（北京）：<time>{formatBeijingTime(marketTime)}</time>
          </span>
        )}
        {fetchedAt && (
          <span>
            拉取时间：<time>{formatFetchedAt(fetchedAt)}</time>
          </span>
        )}
      </div>
    </div>
  );
}
