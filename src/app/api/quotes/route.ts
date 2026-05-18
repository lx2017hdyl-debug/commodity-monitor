import { NextResponse } from "next/server";
import { COMMODITIES } from "@/lib/commodities";
import { loadDashboardQuotesCached } from "@/lib/quotes-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** 批量获取所有可用品种实时行情 */
export async function GET() {
  try {
    const payload = await loadDashboardQuotesCached();
    const status = payload.quotes.length > 0 ? 200 : 502;
    return NextResponse.json(payload, {
      status,
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        dataDisclaimer: "数据加载失败",
        serverTime: new Date().toISOString(),
        quotes: [],
        unavailable: COMMODITIES.filter((c) => !c.available),
        errors: [
          {
            id: "all",
            error: error instanceof Error ? error.message : "未知错误",
          },
        ],
      },
      { status: 502 },
    );
  }
}
