/**
 * 浏览器端行情拉取：在用户本地网络访问新浪，避免 Vercel 服务器 IP 被 403 拦截
 */

import type { CommodityConfig } from "@/lib/commodities";
import type { HistoryPoint, QuoteSnapshot } from "@/lib/sina-finance";
import {
  filterHistoryByRange,
  generatePriceForecast,
  parseDomesticQuote,
  parseInternationalQuote,
} from "@/lib/sina-finance";

const DATA_DISCLAIMER =
  "数据来源为新浪财经公开接口，通常为延迟行情（约 15 分钟或更久）。每条价格均标注市场时间与拉取时间，仅供采购参考，不构成投资或套保建议。";

/** 通过 script 标签拉取新浪实时报价 */
function fetchSinaLiveQuotesBrowser(symbols: string[]): Promise<Map<string, string[]>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.charset = "gb2312";

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("新浪行情加载超时"));
    }, 25000);

    const cleanup = () => {
      clearTimeout(timeout);
      script.remove();
    };

    script.onload = () => {
      try {
        const map = new Map<string, string[]>();
        const win = window as unknown as Record<string, unknown>;
        for (const sym of symbols) {
          const raw = win[`hq_str_${sym}`];
          if (typeof raw === "string" && raw.length > 0) {
            map.set(sym, raw.split(","));
          }
        }
        cleanup();
        if (map.size === 0) reject(new Error("未解析到有效行情"));
        else resolve(map);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("新浪脚本加载失败，请检查网络"));
    };

    script.src = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
    document.body.appendChild(script);
  });
}

/** 国内 K 线 JSONP */
function fetchDomesticKlineBrowser(klineSymbol: string): Promise<HistoryPoint[]> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("K 线加载超时"));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      script.remove();
      try {
        delete (window as unknown as { _?: unknown })._;
      } catch {
        /* ignore */
      }
    };

    (window as unknown as {
      _?: (rows: Array<{ d: string; o: string; h: string; l: string; c: string; v: string }>) => void;
    })._ = (rows) => {
      cleanup();
      resolve(
        rows.map((row) => ({
          date: row.d,
          open: Number(row.o),
          high: Number(row.h),
          low: Number(row.l),
          close: Number(row.c),
          volume: Number(row.v) || 0,
        })),
      );
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("国内 K 线加载失败"));
    };

    script.src = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_/InnerFuturesNewService.getDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
    document.body.appendChild(script);
  });
}

/** 国际 K 线（浏览器直接请求） */
async function fetchInternationalKlineBrowser(klineSymbol: string): Promise<HistoryPoint[]> {
  const url = `https://stock2.finance.sina.com.cn/futures/api/openapi.php/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
  const response = await fetch(url, { referrer: "https://finance.sina.com.cn/" });
  if (!response.ok) throw new Error(`国际 K 线请求失败 (${response.status})`);
  const json = (await response.json()) as {
    result?: {
      data?: Array<{ date: string; open: string; high: string; low: string; close: string; volume: string }>;
    };
  };
  return (json.result?.data ?? []).map((row) => ({
    date: row.date,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume) || 0,
  }));
}

/** 浏览器端：看板行情 */
export async function loadDashboardQuotesBrowser(commodities: CommodityConfig[]) {
  const available = commodities.filter((c) => c.available && c.quoteSymbol);
  const liveMap = await fetchSinaLiveQuotesBrowser(available.map((c) => c.quoteSymbol));

  const quotes = available
    .map((commodity) => {
      const fields = liveMap.get(commodity.quoteSymbol);
      if (!fields) return null;
      const live =
        commodity.market === "domestic"
          ? parseDomesticQuote(fields, commodity.quoteSymbol)
          : parseInternationalQuote(fields, commodity.quoteSymbol);
      return {
        commodity,
        snapshot: { ...live, history: [] as QuoteSnapshot["history"] },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return {
    dataDisclaimer: DATA_DISCLAIMER,
    serverTime: new Date().toISOString(),
    quotes,
    unavailable: commodities.filter((c) => !c.available),
    errors: available
      .filter((c) => !liveMap.has(c.quoteSymbol))
      .map((c) => ({ id: c.id, error: "未获取到报价" })),
  };
}

/** 浏览器端：单品种详情（报价 + 历史 + 预测） */
export async function loadCommodityDetailBrowser(
  commodity: CommodityConfig,
  range = "1y",
) {
  const [liveMap, fullHistory] = await Promise.all([
    fetchSinaLiveQuotesBrowser([commodity.quoteSymbol]),
    commodity.market === "domestic"
      ? fetchDomesticKlineBrowser(commodity.klineSymbol)
      : fetchInternationalKlineBrowser(commodity.klineSymbol),
  ]);

  const fields = liveMap.get(commodity.quoteSymbol);
  if (!fields) throw new Error("未获取到有效报价");

  const quote =
    commodity.market === "domestic"
      ? parseDomesticQuote(fields, commodity.quoteSymbol)
      : parseInternationalQuote(fields, commodity.quoteSymbol);

  const history = filterHistoryByRange(fullHistory, range);
  const snapshot: QuoteSnapshot = {
    ...quote,
    history: history.length > 0 ? history : fullHistory.slice(-30),
  };

  return {
    dataDisclaimer: DATA_DISCLAIMER,
    serverTime: new Date().toISOString(),
    commodity,
    snapshot,
    forecast: generatePriceForecast(snapshot.history, 14),
  };
}
