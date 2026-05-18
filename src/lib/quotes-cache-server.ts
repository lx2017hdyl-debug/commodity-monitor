/** 服务端内存缓存，减轻重复请求行情接口的压力 */

import type { QuotesPayload } from "@/lib/quotes-service";

const DASHBOARD_TTL_MS = 60_000;
const DETAIL_TTL_MS = 120_000;

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

let dashboardCache: CacheEntry<QuotesPayload> | null = null;
const detailCache = new Map<string, CacheEntry<unknown>>();

function detailKey(id: string, range: string) {
  return `${id}:${range}`;
}

/** 读取看板缓存 */
export function getDashboardCache(): QuotesPayload | null {
  if (!dashboardCache || Date.now() > dashboardCache.expiresAt) return null;
  return dashboardCache.data;
}

/** 写入看板缓存 */
export function setDashboardCache(data: QuotesPayload) {
  dashboardCache = { data, expiresAt: Date.now() + DASHBOARD_TTL_MS };
}

/** 读取详情缓存 */
export function getDetailCache<T>(id: string, range: string): T | null {
  const entry = detailCache.get(detailKey(id, range));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data as T;
}

/** 写入详情缓存 */
export function setDetailCache<T>(id: string, range: string, data: T) {
  detailCache.set(detailKey(id, range), {
    data,
    expiresAt: Date.now() + DETAIL_TTL_MS,
  });
}
