/** 单条历史 K 线 */
export interface HistoryPoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

/** 行情快照 */
export interface QuoteSnapshot {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  /** 数据对应的市场时间（Unix 秒，北京时间） */
  marketTime: number;
  /** 服务端拉取时间（ISO） */
  fetchedAt: string;
  exchangeName?: string;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  history: HistoryPoint[];
}

const SINA_HEADERS = {
  Referer: "https://finance.sina.com.cn/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** 解析新浪 JSONP 中的数组 */
function parseJsonpArray(text: string): unknown[] {
  const match = text.match(/\(\[([\s\S]*)\]\)/);
  if (!match) return [];
  return JSON.parse(`[${match[1]}]`) as unknown[];
}

/** 按区间截取历史数据 */
export function filterHistoryByRange(history: HistoryPoint[], range: string): HistoryPoint[] {
  const daysMap: Record<string, number> = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5d": 5,
  };
  const days = daysMap[range];
  if (!days) return history;
  return history.slice(-days);
}

/** 构建北京时间 Unix 戳 */
function toMarketTimestamp(dateStr: string, timeStr?: string): number {
  const time = timeStr && timeStr.includes(":") ? timeStr : "15:00:00";
  return Math.floor(new Date(`${dateStr}T${time}+08:00`).getTime() / 1000);
}

/** 拉取新浪实时报价（国内 nf_ / 国际 hf_） */
async function fetchSinaQuotes(quoteSymbols: string[]): Promise<Map<string, string[]>> {
  const url = `https://hq.sinajs.cn/list=${quoteSymbols.join(",")}`;
  const response = await fetch(url, { headers: SINA_HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`新浪报价请求失败 (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const text = new TextDecoder("gbk").decode(buffer);
  const map = new Map<string, string[]>();

  for (const line of text.split("\n")) {
    const match = line.match(/var hq_str_(.+?)="(.+)"/);
    if (!match) continue;
    map.set(match[1], match[2].split(","));
  }
  return map;
}

/** 解析国内期货 nf_ 报价 */
function parseDomesticQuote(fields: string[], symbol: string): Omit<QuoteSnapshot, "history"> {
  const open = Number(fields[2]) || 0;
  const high = Number(fields[3]) || 0;
  const low = Number(fields[4]) || 0;
  const price = Number(fields[8]) || Number(fields[6]) || 0;
  const previousClose = Number(fields[10]) || price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const date = fields[17] || new Date().toISOString().slice(0, 10);

  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent,
    marketTime: toMarketTimestamp(date),
    fetchedAt: new Date().toISOString(),
    exchangeName: fields[15] ? `${fields[15]}${fields[16] ?? ""}` : undefined,
    dayHigh: high || undefined,
    dayLow: low || undefined,
    volume: Number(fields[13]) || undefined,
  };
}

/** 解析国际期货 hf_ 报价 */
function parseInternationalQuote(fields: string[], symbol: string): Omit<QuoteSnapshot, "history"> {
  const price = Number(fields[0]) || 0;
  const open = Number(fields[2]) || price;
  const high = Number(fields[4]) || Number(fields[3]) || 0;
  const low = Number(fields[5]) || 0;
  const previousClose = Number(fields[7]) || price;
  const change = price - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const date = fields[12] || new Date().toISOString().slice(0, 10);
  const time = fields[6];

  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent,
    marketTime: toMarketTimestamp(date, time),
    fetchedAt: new Date().toISOString(),
    exchangeName: fields[13] || undefined,
    dayHigh: high || undefined,
    dayLow: low || undefined,
    volume: Number(fields[9]) || undefined,
    // open 保留供调试，当前未写入 snapshot
    ...(open ? {} : {}),
  };
}

/** 拉取国内期货日 K 线 */
async function fetchDomesticHistory(klineSymbol: string): Promise<HistoryPoint[]> {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_/InnerFuturesNewService.getDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
  const response = await fetch(url, { headers: SINA_HEADERS, next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`新浪国内 K 线请求失败 (${response.status})`);
  }

  const text = await response.text();
  const rows = parseJsonpArray(text) as Array<{
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

/** 拉取国际期货日 K 线 */
async function fetchInternationalHistory(klineSymbol: string): Promise<HistoryPoint[]> {
  const url = `https://stock2.finance.sina.com.cn/futures/api/openapi.php/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=${encodeURIComponent(klineSymbol)}`;
  const response = await fetch(url, { headers: SINA_HEADERS, next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`新浪国际 K 线请求失败 (${response.status})`);
  }

  const json = (await response.json()) as {
    result?: { data?: Array<{ date: string; open: string; high: string; low: string; close: string; volume: string }> };
  };

  const rows = json.result?.data ?? [];
  return rows.map((row) => ({
    date: row.date,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume) || 0,
  }));
}

export interface FetchQuoteParams {
  quoteSymbol: string;
  klineSymbol: string;
  market: "domestic" | "international";
  range?: string;
}

/** 批量获取实时报价（看板用，一次请求、不拉 K 线） */
export async function fetchBatchLiveQuotes(
  items: Array<{ quoteSymbol: string; market: "domestic" | "international" }>,
): Promise<Map<string, Omit<QuoteSnapshot, "history">>> {
  const symbols = items.map((i) => i.quoteSymbol);
  const quoteMap = await fetchSinaQuotes(symbols);
  const result = new Map<string, Omit<QuoteSnapshot, "history">>();

  for (const item of items) {
    const fields = quoteMap.get(item.quoteSymbol);
    if (!fields || fields.length < 5) continue;

    const quote =
      item.market === "domestic"
        ? parseDomesticQuote(fields, item.quoteSymbol)
        : parseInternationalQuote(fields, item.quoteSymbol);

    result.set(item.quoteSymbol, quote);
  }

  return result;
}

/** 获取完整行情（实时 + 历史，详情页用） */
export async function fetchQuoteSnapshot(params: FetchQuoteParams): Promise<QuoteSnapshot> {
  const { quoteSymbol, klineSymbol, market, range = "1y" } = params;

  const [quoteMap, fullHistory] = await Promise.all([
    fetchSinaQuotes([quoteSymbol]),
    market === "domestic"
      ? fetchDomesticHistory(klineSymbol)
      : fetchInternationalHistory(klineSymbol),
  ]);

  const fields = quoteMap.get(quoteSymbol);
  if (!fields || fields.length < 5) {
    throw new Error(`未获取到 ${quoteSymbol} 的有效报价`);
  }

  const quote =
    market === "domestic"
      ? parseDomesticQuote(fields, quoteSymbol)
      : parseInternationalQuote(fields, quoteSymbol);

  const history = filterHistoryByRange(fullHistory, range);

  return {
    ...quote,
    history: history.length > 0 ? history : fullHistory.slice(-30),
  };
}

/** 简单线性趋势预测（仅供参考，非投资建议） */
export function generatePriceForecast(
  history: HistoryPoint[],
  days = 14,
): Array<{ date: string; price: number; isForecast: boolean }> {
  const closes = history.map((h) => h.close).filter((c) => c > 0);
  if (closes.length < 10) return [];

  const n = Math.min(60, closes.length);
  const recent = closes.slice(-n);
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (recent[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  const lastDate = new Date(history.at(-1)!.date);
  const historical = history.slice(-90).map((h) => ({
    date: h.date,
    price: h.close,
    isForecast: false,
  }));

  const forecast: Array<{ date: string; price: number; isForecast: boolean }> = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(lastDate);
    date.setDate(date.getDate() + d);
    const price = intercept + slope * (n - 1 + d);
    forecast.push({
      date: date.toISOString().slice(0, 10),
      price: Math.max(0, price),
      isForecast: true,
    });
  }

  return [...historical, ...forecast];
}
