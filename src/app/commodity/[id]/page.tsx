import { COMMODITIES } from "@/lib/commodities";
import { CommodityDetail } from "@/components/CommodityDetail";

export const preferredRegion = "hkg1";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 生成静态路径（可选，便于构建） */
export function generateStaticParams() {
  return COMMODITIES.filter((c) => c.available).map((c) => ({ id: c.id }));
}

export default async function CommodityPage({ params }: PageProps) {
  const { id } = await params;
  return <CommodityDetail commodityId={id} />;
}
