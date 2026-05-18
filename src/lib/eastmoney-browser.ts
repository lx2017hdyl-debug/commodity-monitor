/**
 * 浏览器端拉取东方财富（公司网拦截 Vercel API 时的备用方案）
 */

import { COMMODITIES, type CommodityConfig } from "@/lib/commodities";
import type { QuoteSnapshot } from "@/lib/sina-finance";
import { emRowToSnapshot } from "@/lib/eastmoney-finance";

const EM_HEADERS = {
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
  f18?: number | string;
  f124?: number;
}

async function fetchEmListBrowser(fs: string): Promise<EmRow[]> {
  const url = new URL("https://push2.eastmoney.com/api/qt/clist/get");
  url.searchParams.set("pn", "1");
  url.searchParams.set("pz", "500");
  url.searchParams.set("po", "1");
  url.searchParams.set("np", "1");
  url.searchParams.set("fltt", "2");
  url.searchParams.set("invt", "2");
  url.searchParams.set("fid", "f12");
  url.searchParams.set("fs", fs);
  url.searchParams.set("fields", "f12,f14,f2,f3,f4,f15,f16,f17,f18,f124");
  url.searchParams.set("ut", "fa5fd1943c7b033f871a2912cb9886f");

  const response = await fetch(url.toString(), { headers: EM_HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = (await response.json()) as { rc?: number; data?: { diff?: EmRow[] } };
  if (json.rc !== 0 || !json.data?.diff?.length) throw new Error("东方财富返回空列表");
  return json.data.diff;
}

const INTL_KEYWORDS: Record<string, string[]> = {
  "au-intl": ["纽约金", "COMEX黄金", "美黄金"],
  "ag-intl": ["纽约银", "COMEX白银", "美白银"],
  "cu-intl": ["美铜", "COMEX铜"],
  "al-intl": ["伦铝", "LME铝"],
  "ni-intl": ["伦镍", "LME镍"],
  "fe-intl": ["新加坡铁矿石", "SGX铁矿"],
};

/** 浏览器端看板数据 */
export async function loadDashboardQuotesEastMoneyBrowser() {
  const available = COMMODITIES.filter((c) => c.available);
  const [shfe, dce, intl] = await Promise.all([
    fetchEmListBrowser("m:113").catch(() => [] as EmRow[]),
    fetchEmListBrowser("m:114").catch(() => [] as EmRow[]),
    fetchEmListBrowser("m:122,m:220").catch(() => [] as EmRow[]),
  ]);

  const domesticRows = [...shfe, ...dce];
  const quotes: Array<{ commodity: CommodityConfig; snapshot: QuoteSnapshot }> = [];

  for (const commodity of available) {
    if (commodity.market === "domestic") {
      const row = domesticRows.find((r) => r.f12 === commodity.klineSymbol);
      if (row) {
        quotes.push({
          commodity,
          snapshot: { ...emRowToSnapshot(row, commodity.klineSymbol), history: [] },
        });
      }
    } else {
      const keywords = INTL_KEYWORDS[commodity.id] ?? [commodity.name];
      const row = intl.find((r) => keywords.some((k) => (r.f14 ?? "").includes(k)));
      if (row) {
        quotes.push({
          commodity,
          snapshot: { ...emRowToSnapshot(row, commodity.id), history: [] },
        });
      }
    }
  }

  if (quotes.length === 0) throw new Error("浏览器未能从东方财富获取数据");

  return {
    dataDisclaimer:
      "数据来源为东方财富（浏览器直连），延迟行情仅供采购参考，不构成投资或套保建议。",
    serverTime: new Date().toISOString(),
    quotes,
    unavailable: COMMODITIES.filter((c) => !c.available),
    errors: [],
  };
}
