import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "大宗原材价格监控 | 采购看板",
  description: "金、银、铜、铁、铝、镍等国内与国际期货延迟行情、历史走势与趋势参考",
  referrer: "no-referrer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <a href="/" className="text-lg font-semibold text-amber-400">
              大宗原材监控
            </a>
            <span className="text-xs text-slate-500">延迟行情 · 标注数据时间</span>
          </div>
        </nav>
        {children}
        <footer className="mt-auto border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          数据来源于公开接口，延迟行情仅供采购参考，不构成投资或套保建议。
        </footer>
      </body>
    </html>
  );
}
