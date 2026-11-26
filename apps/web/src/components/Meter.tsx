/** Semi-circular quota gauge — KWOTA's visual motif. */
export function Meter({ value, max = 1, size = 220, label, sub, ticks = 24 }: { value: number; max?: number; size?: number; label?: string; sub?: string; ticks?: number }) {
  const r = 90;
  const c = Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 220 124" width={size} height={(size * 124) / 220} aria-hidden>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const a = Math.PI - (i / ticks) * Math.PI;
          const inner = i % 4 === 0 ? 70 : 74;
          return (
            <line
              key={i}
              x1={110 + Math.cos(a) * inner}
              y1={112 - Math.sin(a) * inner}
              x2={110 + Math.cos(a) * 78}
              y2={112 - Math.sin(a) * 78}
              stroke={i / ticks <= pct ? "#C8F23A" : "#2A302C"}
              strokeWidth={i % 4 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}
        <path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="#1F2421" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M20 112 A90 90 0 0 1 200 112"
          fill="none"
          stroke="#C8F23A"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
        />
        <circle cx={110 + Math.cos(Math.PI - pct * Math.PI) * r} cy={112 - Math.sin(Math.PI - pct * Math.PI) * r} r="6" fill="#0B0D0C" stroke="#C8F23A" strokeWidth="3" />
      </svg>
      {(label || sub) && (
        <div className="-mt-8 text-center">
          {label && <div className="font-mono text-2xl tabular-nums text-fog-100 sm:text-[28px]">{label}</div>}
          {sub && <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-fog">{sub}</div>}
        </div>
      )}
    </div>
  );
}
