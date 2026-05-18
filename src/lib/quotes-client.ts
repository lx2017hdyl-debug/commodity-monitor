/**
 * 浏览器端快速加载（绕过 Vercel API，优先新浪 script）
 */

import { COMMODITIES, getCommodityById } from "@/lib/commodities";
import {
  loadCommodityDetailBrowser,
  loadCommodityHistoryBrowser,
  loadDashboardQuotesBrowser,
} from "@/lib/market-data-browser";
import { loadDashboardQuotesEastMoneyBrowser } from "@/lib/eastmoney-browser";
import { generatePriceForecast } from "@/lib/sina-finance";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { readQuoteFromCache, readQuotesCache, writeQuotesCache } from "@/lib/quotes-cache";

export type DashboardQuotes = Awaited<ReturnType<typeof loadDashboardQuotesBrowser>>;

/** 看板行情 */
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

  const fresh = await loadDashboardQuotesFast();
  writeQuotesCache(fresh);
  return fresh;
}

/** 详情页快速加载 */
export async function loadCommodityDetailFast(commodityId: string, range: string) {
  const commodity = getCommodityById(commodityId);
  if (!commodity?.available) {
    throw new Error(commodity?.unavailableReason ?? "品种不可用");
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
  const commodity = getCommodityById(commodityId);
  if (!commodity) throw new Error("品种不存在");
  return loadCommodityHistoryBrowser(commodity, range);
}
