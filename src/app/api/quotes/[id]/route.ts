import { NextResponse } from "next/server";
import { getCommodityById } from "@/lib/commodities";
import { fetchQuoteSnapshot, generatePriceForecast } from "@/lib/sina-finance";

export const preferredRegion = "hkg1";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 获取单个品种详情：历史 + 简单预测 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const commodity = getCommodityById(id);

  if (!commodity) {
    return NextResponse.json({ error: "品种不存在" }, { status: 404 });
  }

  if (!commodity.available || !commodity.quoteSymbol) {
    return NextResponse.json(
      {
        commodity,
        error: commodity.unavailableReason ?? "该品种暂不可用",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "1y";

  try {
    const snapshot = await fetchQuoteSnapshot({
      quoteSymbol: commodity.quoteSymbol,
      klineSymbol: commodity.klineSymbol,
      market: commodity.market,
      range,
    });
    const forecast = generatePriceForecast(snapshot.history, 14);

    return NextResponse.json({
      dataDisclaimer:
        "数据来源为新浪财经公开接口，通常为延迟行情（约 15 分钟或更久）。预测基于历史线性趋势，仅供参考，不构成投资或套保建议。",
      serverTime: new Date().toISOString(),
      commodity,
      snapshot,
      forecast,
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
