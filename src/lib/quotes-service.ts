import { COMMODITIES, type CommodityConfig } from "@/lib/commodities";
import {
  fetchDomesticByCodes,
  fetchEmHistory,
  fetchInternationalByKeywords,
  getEmSecid,
} from "@/lib/eastmoney-finance";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { fetchBatchLiveQuotes, generatePriceForecast } from "@/lib/sina-finance";

export interface QuoteItem {
  commodity: CommodityConfig;
  snapshot: QuoteSnapshot;
}

export interface QuotesPayload {
  dataDisclaimer: string;
  serverTime: string;
  quotes: QuoteItem[];
  unavailable: CommodityConfig[];
  errors: Array<{ id: string; error: string }>;
}

const DISCLAIMER_EM =
  "数据来源为东方财富公开接口，通常为延迟行情（约 15 分钟或更久）。每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。";

const DISCLAIMER_SINA =
  "数据来源为新浪财经公开接口，通常为延迟行情（约 15 分钟或更久）。每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。";

/** 国际品种在东方财富的名称匹配规则 */
const INTL_KEYWORDS: Record<string, string[]> = {
  "au-intl": ["纽约金", "COMEX黄金", "美黄金"],
  "ag-intl": ["纽约银", "COMEX白银", "美白银"],
  "cu-intl": ["美铜", "COMEX铜"],
  "al-intl": ["伦铝", "LME铝"],
  "ni-intl": ["伦镍", "LME镍"],
  "fe-intl": ["新加坡铁矿石", "SGX铁矿", "FEF"],
};

/** 优先东方财富，失败则回退新浪 */
export async function loadDashboardQuotes(): Promise<QuotesPayload> {
  const available = COMMODITIES.filter((c) => c.available && c.quoteSymbol);
  const unavailable = COMMODITIES.filter((c) => !c.available);

  try {
    const domestic = available.filter((c) => c.market === "domestic");
    const international = available.filter((c) => c.market === "international");

    const [domMap, intlMap] = await Promise.all([
      fetchDomesticByCodes(domestic.map((c) => c.klineSymbol)),
      fetchInternationalByKeywords(
        international.map((c) => ({
          id: c.id,
          keywords: INTL_KEYWORDS[c.id] ?? [c.name],
        })),
      ),
    ]);

    const quotes = available
      .map((commodity) => {
        const live =
          commodity.market === "domestic"
            ? domMap.get(commodity.klineSymbol)
            : intlMap.get(commodity.id);
        if (!live) return null;
        return {
          commodity,
          snapshot: { ...live, history: [] as QuoteSnapshot["history"] },
        };
      })
      .filter((item): item is QuoteItem => item != null);

    const errors = available
      .filter((c) => {
        const live =
          c.market === "domestic" ? domMap.get(c.klineSymbol) : intlMap.get(c.id);
        return !live;
      })
      .map((c) => ({ id: c.id, error: "未获取到报价" }));

    if (quotes.length === 0) throw new Error("东方财富无数据");

    return {
      dataDisclaimer: DISCLAIMER_EM,
      serverTime: new Date().toISOString(),
      quotes,
      unavailable,
      errors,
    };
  } catch {
    return loadDashboardQuotesSina(available, unavailable);
  }
}

/** 新浪备用 */
async function loadDashboardQuotesSina(
  available: CommodityConfig[],
  unavailable: CommodityConfig[],
): Promise<QuotesPayload> {
  const liveMap = await fetchBatchLiveQuotes(
    available.map((c) => ({ quoteSymbol: c.quoteSymbol, market: c.market })),
  );

  const quotes = available
    .map((commodity) => {
      const live = liveMap.get(commodity.quoteSymbol);
      if (!live) return null;
      return {
        commodity,
        snapshot: { ...live, history: [] as QuoteSnapshot["history"] },
      };
    })
    .filter((item): item is QuoteItem => item != null);

  return {
    dataDisclaimer: DISCLAIMER_SINA,
    serverTime: new Date().toISOString(),
    quotes,
    unavailable,
    errors: available
      .filter((c) => !liveMap.has(c.quoteSymbol))
      .map((c) => ({ id: c.id, error: "未获取到报价" })),
  };
}

/** 单品种详情 */
export async function loadCommodityDetail(commodity: CommodityConfig, range = "1y") {
  try {
    const secid = getEmSecid(commodity.market, commodity.klineSymbol);
    const [history, domMap, intlMap] = await Promise.all([
      fetchEmHistory(secid, range),
      commodity.market === "domestic"
        ? fetchDomesticByCodes([commodity.klineSymbol])
        : Promise.resolve(new Map()),
      commodity.market === "international"
        ? fetchInternationalByKeywords([
            { id: commodity.id, keywords: INTL_KEYWORDS[commodity.id] ?? [commodity.name] },
          ])
        : Promise.resolve(new Map()),
    ]);

    const live =
      commodity.market === "domestic"
        ? domMap.get(commodity.klineSymbol)
        : intlMap.get(commodity.id);

    if (!live) throw new Error("未获取到报价");

    const snapshot: QuoteSnapshot = {
      ...live,
      history: history.length > 0 ? history : [],
    };

    return {
      dataDisclaimer: DISCLAIMER_EM,
      serverTime: new Date().toISOString(),
      commodity,
      snapshot,
      forecast: generatePriceForecast(snapshot.history, 14),
    };
  } catch {
    const { fetchQuoteSnapshot } = await import("@/lib/sina-finance");
    const snapshot = await fetchQuoteSnapshot({
      quoteSymbol: commodity.quoteSymbol,
      klineSymbol: commodity.klineSymbol,
      market: commodity.market,
      range,
    });
    return {
      dataDisclaimer: DISCLAIMER_SINA,
      serverTime: new Date().toISOString(),
      commodity,
      snapshot,
      forecast: generatePriceForecast(snapshot.history, 14),
    };
  }
}
