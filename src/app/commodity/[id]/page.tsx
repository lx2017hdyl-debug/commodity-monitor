import { COMMODITIES, getCommodityById } from "@/lib/commodities";
import { CommodityDetail } from "@/components/CommodityDetail";
import { loadCommodityDetailCached } from "@/lib/quotes-service";

export const preferredRegion = "hkg1";
export const revalidate = 120;

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 生成静态路径 */
export function generateStaticParams() {
  return COMMODITIES.filter((c) => c.available).map((c) => ({ id: c.id }));
}

/** 详情页：服务端预取报价与 K 线 */
export default async function CommodityPage({ params }: PageProps) {
  const { id } = await params;
  const commodity = getCommodityById(id);

  let initialData = null;
  if (commodity?.available) {
    try {
      initialData = await loadCommodityDetailCached(commodity, "3mo");
    } catch {
      /* 客户端会重试 */
    }
  }

  return <CommodityDetail commodityId={id} initialData={initialData} />;
}
