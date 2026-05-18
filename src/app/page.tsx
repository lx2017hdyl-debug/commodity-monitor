import { Dashboard } from "@/components/Dashboard";
import { loadDashboardQuotesCached } from "@/lib/quotes-service";

/** 首页每 60 秒在服务端重新生成，打开即可看到价格 */
export const revalidate = 60;

/** 带超时的服务端预取，避免行情 API 卡住导致整页打不开 */
async function loadInitialDashboard() {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000));
  const data = loadDashboardQuotesCached().catch(() => null);
  return Promise.race([data, timeout]);
}

/** 首页：服务端预取行情（Vercel 走东财 API，比浏览器 script 快） */
export default async function HomePage() {
  const initialData = await loadInitialDashboard();

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
