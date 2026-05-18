import { Dashboard } from "@/components/Dashboard";
import { loadDashboardQuotes } from "@/lib/quotes-service";

export const preferredRegion = "hkg1";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initialData;
  try {
    initialData = await loadDashboardQuotes();
  } catch {
    initialData = undefined;
  }

  return (
    <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          大宗原材价格监控
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          实时关注金、银、铜、铁、铝、镍等国内与国际期货价格，查看历史波动与趋势参考。
          所有报价均标注数据时间，延迟行情仅供采购决策参考。
        </p>
      </header>
      <Dashboard initialData={initialData} />
    </main>
  );
}
