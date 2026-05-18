/** 浏览器端行情缓存（sessionStorage），加快二次打开与刷新 */

const CACHE_KEY = "commodity-monitor-quotes-v1";
const CACHE_TTL_MS = 90_000; // 90 秒

export interface CachedQuotesPayload {
  savedAt: number;
  payload: {
    dataDisclaimer: string;
    serverTime: string;
    quotes: Array<{
      commodity: { id: string };
      snapshot: unknown;
    }>;
    unavailable: unknown[];
    errors: unknown[];
  };
}

/** 读取缓存 */
export function readQuotesCache<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedQuotesPayload;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    if (!parsed.payload?.quotes?.length) return null;
    return parsed.payload as T;
  } catch {
    return null;
  }
}

/** 写入缓存 */
export function writeQuotesCache(payload: CachedQuotesPayload["payload"]) {
  if (typeof window === "undefined") return;
  try {
    const data: CachedQuotesPayload = { savedAt: Date.now(), payload };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* 存储满时忽略 */
  }
}

/** 从缓存取单个品种快照 */
export function readQuoteFromCache(commodityId: string) {
  const data = readQuotesCache<{
    quotes: Array<{ commodity: { id: string }; snapshot: unknown }>;
  }>();
  if (!data) return null;
  const item = data.quotes.find((q) => q.commodity.id === commodityId);
  return item?.snapshot ?? null;
}
