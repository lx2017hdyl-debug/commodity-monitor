/**
 * 统一行情加载：阿里云用服务端 API，Vercel 等用浏览器直连
 */

import { COMMODITIES, getCommodityById } from "@/lib/commodities";
import { isServerDataMode } from "@/lib/deploy-config";
import {
  loadCommodityDetailBrowser,
  loadCommodityHistoryBrowser,
  loadDashboardQuotesBrowser,
} from "@/lib/market-data-browser";
import { loadDashboardQuotesEastMoneyBrowser } from "@/lib/eastmoney-browser";
import type { QuotesPayload } from "@/lib/quotes-service";
import { generatePriceForecast } from "@/lib/sina-finance";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { readQuoteFromCache, readQuotesCache, writeQuotesCache } from "@/lib/quotes-cache";

export type DashboardQuotes = QuotesPayload;

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("接口返回为空");
  return JSON.parse(text) as T;
}

/** 从本站 API 拉看板（国内服务器上走东财/新浪，速度快） */
async function fetchDashboardFromApi(): Promise<DashboardQuotes> {
  const res = await fetch("/api/quotes", { cache: "no-store" });
  const json = await parseJsonResponse<DashboardQuotes & { error?: string }>(res);
  if (!res.ok || json.quotes.length === 0) {
    throw new Error(json.errors?.[0]?.error ?? "看板数据加载失败");
  }
  return json;
}

/** 从本站 API 拉详情 */
async function fetchDetailFromApi(commodityId: string, range: string) {
  const res = await fetch(`/api/quotes/${commodityId}?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  const json = await parseJsonResponse<
    Awaited<ReturnType<typeof loadCommodityDetailBrowser>> & { error?: string }
  >(res);
  if (!res.ok) throw new Error(json.error ?? "详情加载失败");
  return json;
}

/** 浏览器直连看板 */
export async function loadDashboardQuotesFast(): Promise<DashboardQuotes> {
  try {
    return await loadDashboardQuotesBrowser(COMMODITIES);
  } catch {
    return loadDashboardQuotesEastMoneyBrowser();
  }
}

/** 带缓存：先展示旧数据，再后台刷新 */
export async function loadDashboardWithCache(
  onCached?: (data: DashboardQuotes) => void,
): Promise<DashboardQuotes> {
  const cached = readQuotesCache<DashboardQuotes>();
  if (cached) onCached?.(cached);

  const fresh = isServerDataMode() ? await fetchDashboardFromApi() : await loadDashboardQuotesFast();
  writeQuotesCache(fresh);
  return fresh;
}

/** 详情页加载 */
export async function loadCommodityDetailFast(commodityId: string, range: string) {
  const commodity = getCommodityById(commodityId);
  if (!commodity?.available) {
    throw new Error(commodity?.unavailableReason ?? "品种不可用");
  }

  if (isServerDataMode()) {
    return fetchDetailFromApi(commodityId, range);
  }

  const cached = readQuoteFromCache(commodityId) as QuoteSnapshot | null;
  const history = await loadCommodityHistoryBrowser(commodity, range);

  if (cached?.price) {
    const snapshot: QuoteSnapshot = { ...cached, history };
    return {
      dataDisclaimer:
        "数据来源为新浪财经公开接口，通常为延迟行情（约 15 分钟或更久），仅供采购参考。",
      serverTime: new Date().toISOString(),
      commodity,
      snapshot,
      forecast: generatePriceForecast(history, 14),
    };
  }

  return loadCommodityDetailBrowser(commodity, range);
}

/** 仅刷新 K 线 */
export async function loadCommodityHistoryFast(commodityId: string, range: string) {
  if (isServerDataMode()) {
    const detail = await fetchDetailFromApi(commodityId, range);
    return detail.snapshot.history;
  }
  const commodity = getCommodityById(commodityId);
  if (!commodity) throw new Error("品种不存在");
  return loadCommodityHistoryBrowser(commodity, range);
}
