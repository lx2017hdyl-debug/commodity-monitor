/**
 * 浏览器端行情拉取：在用户本地网络访问新浪
 * Vercel 域名下新浪可能拦截 script 标签，故提供多种备用加载方式
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

const SINA_QUOTE_BASE = "https://hq.sinajs.cn/list=";

/** 解析新浪返回文本 */
function parseSinaQuoteText(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    const match = line.match(/var hq_str_(.+?)="(.+?)"/);
    if (match) map.set(match[1], match[2].split(","));
  }
  return map;
}

/** 方式 1：script 标签（无 Referer，避免被 Vercel 域名拦截） */
function fetchSinaViaScript(symbols: string[]): Promise<Map<string, string[]>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.charset = "gb2312";
    script.referrerPolicy = "no-referrer";

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("script 超时"));
    }, 8000);

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
        if (map.size === 0) reject(new Error("script 未解析到数据"));
        else resolve(map);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("script onerror"));
    };

    script.src = `${SINA_QUOTE_BASE}${symbols.join(",")}`;
    document.body.appendChild(script);
  });
}

/** 方式 2：经 CORS 代理拉取文本（适配 Vercel 页面） */
async function fetchSinaViaProxy(symbols: string[]): Promise<Map<string, string[]>> {
  const target = `${SINA_QUOTE_BASE}${symbols.join(",")}`;
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?${encodeURIComponent(target)}`,
  ];

  let lastError = "代理失败";
  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl, { cache: "no-store" });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const text = await response.text();
      const map = parseSinaQuoteText(text);
      if (map.size > 0) return map;
      lastError = "代理返回空数据";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "代理异常";
    }
  }
  throw new Error(lastError);
}

/** 拉取新浪实时报价：优先 script（1 次请求最快），超时 8 秒 */
async function fetchSinaLiveQuotesBrowser(symbols: string[]): Promise<Map<string, string[]>> {
  const scriptPromise = fetchSinaViaScript(symbols);
  const timeoutPromise = new Promise<Map<string, string[]>>((_, reject) => {
    setTimeout(() => reject(new Error("新浪行情超时")), 8000);
  });

  try {
    return await Promise.race([scriptPromise, timeoutPromise]);
  } catch {
    /* 最后才尝试代理（较慢，部分网络不可用） */
    return fetchSinaViaProxy(symbols);
  }
}

/** 国内 K 线：script JSONP */
function fetchDomesticKlineViaScript(klineSymbol: string): Promise<HistoryPoint[]> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.referrerPolicy = "no-referrer";

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("K线超时"));
    }, 10000);

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
      reject(new Error("K线 script 失败"));
    };

    script.src = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_/InnerFuturesNewService.getDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
    document.body.appendChild(script);
  });
}

/** 国内 K 线：代理拉取 JSONP 文本并解析 */
async function fetchDomesticKlineViaProxy(klineSymbol: string): Promise<HistoryPoint[]> {
  const target = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_/InnerFuturesNewService.getDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`K线代理 HTTP ${response.status}`);
  const text = await response.text();
  const match = text.match(/\(\[([\s\S]*)\]\)/);
  if (!match) throw new Error("K线解析失败");
  const rows = JSON.parse(`[${match[1]}]`) as Array<{
    d: string;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
  }>;
  return rows.map((row) => ({
    date: row.d,
    open: Number(row.o),
    high: Number(row.h),
    low: Number(row.l),
    close: Number(row.c),
    volume: Number(row.v) || 0,
  }));
}

async function fetchDomesticKlineBrowser(klineSymbol: string): Promise<HistoryPoint[]> {
  try {
    return await fetchDomesticKlineViaScript(klineSymbol);
  } catch {
    return fetchDomesticKlineViaProxy(klineSymbol);
  }
}

/** 国际 K 线 */
async function fetchInternationalKlineBrowser(klineSymbol: string): Promise<HistoryPoint[]> {
  const target = `https://stock2.finance.sina.com.cn/futures/api/openapi.php/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const json = JSON.parse(await response.text()) as {
        result?: {
          data?: Array<{ date: string; open: string; high: string; low: string; close: string; volume: string }>;
        };
      };
      const rows = json.result?.data ?? [];
      if (rows.length > 0) {
        return rows.map((row) => ({
          date: row.date,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume) || 0,
        }));
      }
    }
  } catch {
    /* 尝试直连 */
  }

  const response = await fetch(target, {
    referrerPolicy: "no-referrer",
    headers: { Referer: "https://finance.sina.com.cn/" },
  });
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

/** 仅拉取 K 线（详情页切换区间时用） */
export async function loadCommodityHistoryBrowser(
  commodity: CommodityConfig,
  range: string,
): Promise<HistoryPoint[]> {
  const full =
    commodity.market === "domestic"
      ? await fetchDomesticKlineBrowser(commodity.klineSymbol)
      : await fetchInternationalKlineBrowser(commodity.klineSymbol);
  return filterHistoryByRange(full, range);
}

/** 浏览器端：单品种详情 */
export async function loadCommodityDetailBrowser(commodity: CommodityConfig, range = "3mo") {
  const [liveMap, fullHistory] = await Promise.all([
    fetchSinaLiveQuotesBrowser([commodity.quoteSymbol]),
    loadCommodityHistoryBrowser(commodity, range),
  ]);

  const fields = liveMap.get(commodity.quoteSymbol);
  if (!fields) throw new Error("未获取到有效报价");

  const quote =
    commodity.market === "domestic"
      ? parseDomesticQuote(fields, commodity.quoteSymbol)
      : parseInternationalQuote(fields, commodity.quoteSymbol);

  const snapshot: QuoteSnapshot = {
    ...quote,
    history: fullHistory.length > 0 ? fullHistory : [],
  };

  return {
    dataDisclaimer: DATA_DISCLAIMER,
    serverTime: new Date().toISOString(),
    commodity,
    snapshot,
    forecast: generatePriceForecast(snapshot.history, 14),
  };
}
