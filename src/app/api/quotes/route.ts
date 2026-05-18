import { NextResponse } from "next/server";
import { loadDashboardQuotes } from "@/lib/quotes-service";

export const preferredRegion = "hkg1";
export const dynamic = "force-dynamic";

/** 批量获取所有可用品种实时行情 */
export async function GET() {
  const payload = await loadDashboardQuotes();
  const status = payload.quotes.length > 0 ? 200 : 502;
  return NextResponse.json(payload, { status });
}
