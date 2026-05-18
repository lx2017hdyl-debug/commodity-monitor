/** 市场类型 */
export type MarketType = "domestic" | "international";

/** 品种配置 */
export interface CommodityConfig {
  id: string;
  name: string;
  nameEn: string;
  market: MarketType;
  /** 新浪实时报价代码（nf_ / hf_） */
  quoteSymbol: string;
  /** 新浪 K 线代码 */
  klineSymbol: string;
  exchange: string;
  unit: string;
  /** 是否可用 */
  available: boolean;
  unavailableReason?: string;
}

/** 首批监控品种：国内 + 国际期货 */
export const COMMODITIES: CommodityConfig[] = [
  // 国内期货（上期所 / 大商所）
  {
    id: "au-domestic",
    name: "黄金",
    nameEn: "Gold",
    market: "domestic",
    quoteSymbol: "nf_AU0",
    klineSymbol: "AU0",
    exchange: "上期所",
    unit: "元/克",
    available: true,
  },
  {
    id: "ag-domestic",
    name: "白银",
    nameEn: "Silver",
    market: "domestic",
    quoteSymbol: "nf_AG0",
    klineSymbol: "AG0",
    exchange: "上期所",
    unit: "元/千克",
    available: true,
  },
  {
    id: "cu-domestic",
    name: "铜",
    nameEn: "Copper",
    market: "domestic",
    quoteSymbol: "nf_CU0",
    klineSymbol: "CU0",
    exchange: "上期所",
    unit: "元/吨",
    available: true,
  },
  {
    id: "al-domestic",
    name: "铝",
    nameEn: "Aluminum",
    market: "domestic",
    quoteSymbol: "nf_AL0",
    klineSymbol: "AL0",
    exchange: "上期所",
    unit: "元/吨",
    available: true,
  },
  {
    id: "ni-domestic",
    name: "镍",
    nameEn: "Nickel",
    market: "domestic",
    quoteSymbol: "nf_NI0",
    klineSymbol: "NI0",
    exchange: "上期所",
    unit: "元/吨",
    available: true,
  },
  {
    id: "i-domestic",
    name: "铁矿石",
    nameEn: "Iron Ore",
    market: "domestic",
    quoteSymbol: "nf_I0",
    klineSymbol: "I0",
    exchange: "大商所",
    unit: "元/吨",
    available: true,
  },
  {
    id: "co-domestic",
    name: "钴",
    nameEn: "Cobalt",
    market: "domestic",
    quoteSymbol: "",
    klineSymbol: "",
    exchange: "—",
    unit: "—",
    available: false,
    unavailableReason: "国内暂无独立钴期货合约，建议关注电解钴现货或 LME 钴（需付费数据源）",
  },
  // 国际期货
  {
    id: "au-intl",
    name: "黄金",
    nameEn: "Gold",
    market: "international",
    quoteSymbol: "hf_GC",
    klineSymbol: "GC",
    exchange: "COMEX",
    unit: "美元/盎司",
    available: true,
  },
  {
    id: "ag-intl",
    name: "白银",
    nameEn: "Silver",
    market: "international",
    quoteSymbol: "hf_SI",
    klineSymbol: "SI",
    exchange: "COMEX",
    unit: "美元/盎司",
    available: true,
  },
  {
    id: "cu-intl",
    name: "铜",
    nameEn: "Copper",
    market: "international",
    quoteSymbol: "hf_HG",
    klineSymbol: "HG",
    exchange: "COMEX",
    unit: "美分/磅",
    available: true,
  },
  {
    id: "al-intl",
    name: "铝",
    nameEn: "Aluminum",
    market: "international",
    quoteSymbol: "hf_AHD",
    klineSymbol: "AHD",
    exchange: "LME",
    unit: "美元/吨",
    available: true,
  },
  {
    id: "ni-intl",
    name: "镍",
    nameEn: "Nickel",
    market: "international",
    quoteSymbol: "hf_NID",
    klineSymbol: "NID",
    exchange: "LME",
    unit: "美元/吨",
    available: true,
  },
  {
    id: "fe-intl",
    name: "铁矿石",
    nameEn: "Iron Ore",
    market: "international",
    quoteSymbol: "hf_FEF",
    klineSymbol: "FEF",
    exchange: "SGX",
    unit: "美元/吨",
    available: true,
  },
  {
    id: "co-intl",
    name: "钴",
    nameEn: "Cobalt",
    market: "international",
    quoteSymbol: "",
    klineSymbol: "",
    exchange: "—",
    unit: "—",
    available: false,
    unavailableReason: "新浪暂无稳定钴期货连续合约，需接入 LME 或专业金属数据商",
  },
];

/** 根据 ID 查找品种 */
export function getCommodityById(id: string): CommodityConfig | undefined {
  return COMMODITIES.find((c) => c.id === id);
}

/** 格式化价格 */
export function formatPrice(price: number, unit: string): string {
  if (unit.includes("盎司") || unit.includes("元/克")) {
    return `${price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  }
  if (unit.includes("美分/磅")) {
    return `${price.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  }
  return `${price.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${unit}`;
}

/** 格式化涨跌幅 */
export function formatChangePercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
