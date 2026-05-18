import { COMMODITIES, type CommodityConfig } from "@/lib/commodities";
import { fetchBatchLiveQuotes, type QuoteSnapshot } from "@/lib/sina-finance";

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

const DISCLAIMER =
  "数据来源为新浪财经公开接口，通常为延迟行情（约 15 分钟或更久）。每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。";

/** 服务端拉取看板行情（供页面与 API 共用） */
export async function loadDashboardQuotes(): Promise<QuotesPayload> {
  const available = COMMODITIES.filter((c) => c.available && c.quoteSymbol);

  try {
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
        } satisfies QuoteItem;
      })
      .filter((item): item is QuoteItem => item != null);

    const errors = available
      .filter((c) => !liveMap.has(c.quoteSymbol))
      .map((c) => ({ id: c.id, error: "未获取到报价" }));

    return {
      dataDisclaimer: DISCLAIMER,
      serverTime: new Date().toISOString(),
      quotes,
      unavailable: COMMODITIES.filter((c) => !c.available),
      errors,
    };
  } catch (error) {
    return {
      dataDisclaimer: DISCLAIMER,
      serverTime: new Date().toISOString(),
      quotes: [],
      unavailable: COMMODITIES.filter((c) => !c.available),
      errors: [{ id: "all", error: error instanceof Error ? error.message : "未知错误" }],
    };
  }
}
