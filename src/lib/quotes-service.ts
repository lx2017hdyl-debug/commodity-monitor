import { COMMODITIES, type CommodityConfig } from "@/lib/commodities";
import {
  fetchDomesticByCodes,
  fetchEmHistory,
  fetchInternationalByKeywords,
  getEmSecid,
} from "@/lib/eastmoney-finance";
import {
  getDashboardCache,
  getDetailCache,
  setDashboardCache,
  setDetailCache,
} from "@/lib/quotes-cache-server";
import type { HistoryPoint, QuoteSnapshot } from "@/lib/sina-finance";
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

const INTL_KEYWORDS: Record<string, string[]> = {
  "au-intl": ["纽约金", "COMEX黄金", "美黄金", "CMX黄金"],
  "ag-intl": ["纽约银", "COMEX白银", "美白银", "CMX白银"],
  "cu-intl": ["美铜", "COMEX铜", "CMX铜"],
  "al-intl": ["伦铝", "LME铝"],
  "ni-intl": ["伦镍", "LME镍"],
  "fe-intl": ["新加坡铁矿石", "SGX铁矿", "FEF"],
};

function emptyPayload(error: string): QuotesPayload {
  return {
    dataDisclaimer: "数据加载失败",
    serverTime: new Date().toISOString(),
    quotes: [],
    unavailable: COMMODITIES.filter((c) => !c.available),
    errors: [{ id: "all", error }],
  };
}

/** 东方财富加载（国内失败也尽量返回国际，反之亦然） */
async function loadFromEastMoney(
  available: CommodityConfig[],
  unavailable: CommodityConfig[],
): Promise<QuotesPayload> {
  const domestic = available.filter((c) => c.market === "domestic");
  const international = available.filter((c) => c.market === "international");

  let domMap = new Map<string, Omit<QuoteSnapshot, "history">>();
  let intlMap = new Map<string, Omit<QuoteSnapshot, "history">>();
  const partialErrors: Array<{ id: string; error: string }> = [];

  const [domResult, intlResult] = await Promise.allSettled([
    fetchDomesticByCodes(domestic.map((c) => c.klineSymbol)),
    fetchInternationalByKeywords(
      international.map((c) => ({
        id: c.id,
        keywords: INTL_KEYWORDS[c.id] ?? [c.name],
      })),
    ),
  ]);

  if (domResult.status === "fulfilled") domMap = domResult.value;
  else {
    partialErrors.push({
      id: "domestic",
      error: domResult.reason instanceof Error ? domResult.reason.message : "国内期货加载失败",
    });
  }

  if (intlResult.status === "fulfilled") intlMap = intlResult.value;
  else {
    partialErrors.push({
      id: "international",
      error: intlResult.reason instanceof Error ? intlResult.reason.message : "国际期货加载失败",
    });
  }

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

  const errors = [
    ...partialErrors,
    ...available
      .filter((c) => {
        const live =
          c.market === "domestic" ? domMap.get(c.klineSymbol) : intlMap.get(c.id);
        return !live;
      })
      .map((c) => ({ id: c.id, error: "未获取到报价" })),
  ];

  if (quotes.length === 0) {
    throw new Error(errors.map((e) => e.error).join("；") || "东方财富无数据");
  }

  return {
    dataDisclaimer: DISCLAIMER_EM,
    serverTime: new Date().toISOString(),
    quotes,
    unavailable,
    errors,
  };
}

/** 优先东方财富，失败回退新浪；保证不抛异常 */
export async function loadDashboardQuotes(): Promise<QuotesPayload> {
  const available = COMMODITIES.filter((c) => c.available && c.quoteSymbol);
  const unavailable = COMMODITIES.filter((c) => !c.available);

  try {
    return await loadFromEastMoney(available, unavailable);
  } catch (emErr) {
    try {
      return await loadDashboardQuotesSina(available, unavailable);
    } catch (sinaErr) {
      const emMsg = emErr instanceof Error ? emErr.message : "东方财富失败";
      const sinaMsg = sinaErr instanceof Error ? sinaErr.message : "新浪失败";
      return emptyPayload(`${emMsg}；${sinaMsg}`);
    }
  }
}

/** 带服务端缓存的看板数据（阿里云部署用） */
export async function loadDashboardQuotesCached(): Promise<QuotesPayload> {
  const hit = getDashboardCache();
  if (hit) return hit;
  const fresh = await loadDashboardQuotes();
  if (fresh.quotes.length > 0) setDashboardCache(fresh);
  return fresh;
}

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

  if (quotes.length === 0) throw new Error("新浪无数据");

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

export async function loadCommodityDetail(commodity: CommodityConfig, range = "3mo") {
  try {
    const secid = getEmSecid(commodity.market, commodity.klineSymbol);
    const [history, domMap, intlMap] = await Promise.all([
      fetchEmHistory(secid, range).catch(() => [] as HistoryPoint[]),
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

/** 带服务端缓存的详情（阿里云部署用） */
export async function loadCommodityDetailCached(commodity: CommodityConfig, range = "3mo") {
  const hit = getDetailCache<Awaited<ReturnType<typeof loadCommodityDetail>>>(
    commodity.id,
    range,
  );
  if (hit) return hit;
  const fresh = await loadCommodityDetail(commodity, range);
  if (fresh.snapshot?.price) setDetailCache(commodity.id, range, fresh);
  return fresh;
}
