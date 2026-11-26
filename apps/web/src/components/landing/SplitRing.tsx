/** Donut chart of the fee split. */
export function SplitRing({ pool = 50, vault = 30, ops = 20 }: { pool?: number; vault?: number; ops?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const segs = [
    { v: pool, color: "#C8F23A", label: "Kwota Pool" },
    { v: vault, color: "#7FE0B8", label: "Vault" },
    { v: ops, color: "#3a423d", label: "Operations" },
  ];
  let acc = 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#141816" strokeWidth="22" />
        {segs.map((s) => {
          const len = (s.v / 100) * c;
          const el = (
            <circle key={s.label} cx="100" cy="100" r={r} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 3)} ${c}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-4xl text-fog-100">{pool}%</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-fog">to holders</div>
      </div>
    </div>
  );
}
