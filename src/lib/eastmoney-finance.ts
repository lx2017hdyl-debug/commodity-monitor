/**
 * 东方财富行情接口（Vercel 服务器可访问，替代被拦截的新浪）
 */

import type { HistoryPoint, QuoteSnapshot } from "@/lib/sina-finance";

const EM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
};

interface EmRow {
  f2?: number | string;
  f3?: number | string;
  f4?: number | string;
  f12?: string;
  f14?: string;
  f15?: number | string;
  f16?: number | string;
  f17?: number | string;
  f18?: number | string;
  f124?: number;
}

interface EmListResponse {
  rc?: number;
  data?: { diff?: EmRow[] };
}

/** 拉取期货列表 */
async function fetchEmList(fs: string, pageSize = 500): Promise<EmRow[]> {
  const url = new URL("https://push2.eastmoney.com/api/qt/clist/get");
  url.searchParams.set("pn", "1");
  url.searchParams.set("pz", String(pageSize));
  url.searchParams.set("po", "1");
  url.searchParams.set("np", "1");
  url.searchParams.set("fltt", "2");
  url.searchParams.set("invt", "2");
  url.searchParams.set("fid", "f12");
  url.searchParams.set("fs", fs);
  url.searchParams.set("fields", "f12,f14,f2,f3,f4,f15,f16,f17,f18,f124");

  const response = await fetch(url.toString(), {
    headers: EM_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`东方财富列表请求失败 (${response.status})`);
  }

  const json = (await response.json()) as EmListResponse;
  if (json.rc !== 0 || !json.data?.diff) {
    throw new Error("东方财富返回数据为空");
  }
  return json.data.diff;
}

function num(value: number | string | undefined): number {
  if (value == null || value === "-") return 0;
  return Number(value) || 0;
}

/** 将东方财富行转为行情快照 */
export function emRowToSnapshot(row: EmRow, symbol: string): Omit<QuoteSnapshot, "history"> {
  const price = num(row.f2);
  const previousClose = num(row.f18) || price;
  const change = num(row.f4) || price - previousClose;
  const changePercent = num(row.f3) || (previousClose !== 0 ? (change / previousClose) * 100 : 0);
  const marketTime = row.f124 ? row.f124 : Math.floor(Date.now() / 1000);

  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent,
    marketTime,
    fetchedAt: new Date().toISOString(),
    exchangeName: row.f14,
    dayHigh: num(row.f15) || undefined,
    dayLow: num(row.f16) || undefined,
  };
}

/** 按合约代码查找（如 AU0、I0） */
export async function fetchDomesticByCodes(
  codes: string[],
): Promise<Map<string, Omit<QuoteSnapshot, "history">>> {
  const [shfe, dce] = await Promise.all([fetchEmList("m:113"), fetchEmList("m:114")]);
  const all = [...shfe, ...dce];
  const map = new Map<string, Omit<QuoteSnapshot, "history">>();

  for (const code of codes) {
    const row = all.find((r) => r.f12 === code);
    if (row) map.set(code, emRowToSnapshot(row, code));
  }
  return map;
}

/** 按名称关键词匹配国际品种 */
export async function fetchInternationalByKeywords(
  rules: Array<{ id: string; keywords: string[] }>,
): Promise<Map<string, Omit<QuoteSnapshot, "history">>> {
  const rows = await fetchEmList("m:122", 800);
  const map = new Map<string, Omit<QuoteSnapshot, "history">>();

  for (const rule of rules) {
    const row = rows.find((r) => {
      const name = r.f14 ?? "";
      return rule.keywords.some((k) => name.includes(k));
    });
    if (row) map.set(rule.id, emRowToSnapshot(row, rule.id));
  }
  return map;
}

/** 东方财富 K 线 secid：上期所 113. / 大商所 114. */
export function getEmSecid(market: "domestic" | "international", klineSymbol: string): string {
  if (market === "domestic") {
    const dceCodes = ["I0", "J0", "JM0", "A0", "B0", "M0", "Y0", "P0"];
    const prefix = dceCodes.includes(klineSymbol) ? "114" : "113";
    return `${prefix}.${klineSymbol}`;
  }
  return `122.${klineSymbol}`;
}

/** 拉取 K 线历史 */
export async function fetchEmHistory(secid: string, range: string): Promise<HistoryPoint[]> {
  const daysMap: Record<string, number> = {
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5d": 5,
  };
  const limit = daysMap[range] ?? 365;

  const url = new URL("https://push2his.eastmoney.com/api/qt/stock/kline/get");
  url.searchParams.set("secid", secid);
  url.searchParams.set("klt", "101");
  url.searchParams.set("fqt", "0");
  url.searchParams.set("lmt", String(limit));
  url.searchParams.set("end", "20500101");
  url.searchParams.set("fields1", "f1,f2,f3,f4,f5,f6");
  url.searchParams.set("fields2", "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61");

  const response = await fetch(url.toString(), { headers: EM_HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`东方财富 K 线失败 (${response.status})`);

  const json = (await response.json()) as { data?: { klines?: string[] } };
  const klines = json.data?.klines ?? [];

  return klines
    .map((line) => {
      const [date, open, close, high, low, volume] = line.split(",");
      return {
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume) || 0,
      };
    })
    .filter((p) => p.close > 0);
}
