import { NextResponse } from "next/server";
import { getCommodityById } from "@/lib/commodities";
import { loadCommodityDetailCached } from "@/lib/quotes-service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 获取单个品种详情 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const commodity = getCommodityById(id);

  if (!commodity) {
    return NextResponse.json({ error: "品种不存在" }, { status: 404 });
  }

  if (!commodity.available || !commodity.quoteSymbol) {
    return NextResponse.json(
      { commodity, error: commodity.unavailableReason ?? "该品种暂不可用" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "3mo";

  try {
    const payload = await loadCommodityDetailCached(commodity, range);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=180" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        commodity,
        error: error instanceof Error ? error.message : "获取数据失败",
      },
      { status: 502 },
    );
  }
}
