"use client";

interface RangeOption {
  value: string;
  label: string;
}

interface RangeSelectorProps {
  options: RangeOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** 时间区间选择（带滑块过渡动画） */
export function RangeSelector({ options, value, onChange, disabled }: RangeSelectorProps) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      className={`relative inline-flex rounded-xl bg-slate-800/90 p-1 ${disabled ? "pointer-events-none opacity-60" : ""}`}
      role="tablist"
      aria-label="历史区间"
    >
      {/* 滑动高亮块 */}
      <span
        className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-amber-500 shadow-md shadow-amber-500/25 transition-[left,width] duration-300 ease-out"
        style={{
          left: `calc(${activeIndex} * (100% / ${options.length}) + 4px)`,
          width: `calc(100% / ${options.length} - 8px)`,
        }}
      />
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 min-w-[4.5rem] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-300 ${
              active ? "text-slate-950" : "text-slate-300 hover:text-white"
            } ${active ? "range-pill-active" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
