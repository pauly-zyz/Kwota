"use client";
import { useEffect, useState } from "react";

/**
 * The hero instrument: a large 240° gauge with a sweeping needle, live digital
 * readout and a requests ticker — the "kwota meter" brand moment.
 */
export function HeroMeter() {
  const [pct, setPct] = useState(0);
  const [kw, setKw] = useState(0);
  const [log, setLog] = useState<{ id: number; model: string; tok: number; cost: number }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setPct(0.72), 250);
    let n = 0;
    const models = ["gpt-oss-120b", "deepseek-v4-flash", "qwen3-235b", "mistral-small-3.2", "kimi-k2", "glm-4.7"];
    const iv = setInterval(() => {
      n++;
      const tok = 200 + Math.floor(Math.random() * 1400);
      const cost = tok * (0.0000003 + Math.random() * 0.0000012);
      setLog((l) => [{ id: n, model: models[n % models.length]!, tok, cost }, ...l].slice(0, 4));
      setPct((p) => Math.max(0.18, p - cost * 6));
      setKw((k) => k + cost);
    }, 1700);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);

  // geometry: 240° arc from -210° to 30° (SVG angles), center 160,160, r 128
  const R = 128;
  const C = 160;
  const start = 150; // degrees, clockwise from +x (left-bottom)
  const sweep = 240;
  const polar = (deg: number, r = R) => {
    const a = (deg * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number, r = R) => {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const len = (Math.PI * 2 * R * sweep) / 360;
  const needleDeg = start + sweep * pct;
  const ticks = Array.from({ length: 49 }, (_, i) => i);
  const balance = 42.1 * pct + 8;

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-10 rounded-full bg-volt/10 blur-3xl animate-pulseGlow" />
      <div className="glass relative p-6 sm:p-8">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-fog">
          <span>kwota meter · epoch #22</span>
          <span className="flex items-center gap-1.5 text-volt">
            <span className="h-1.5 w-1.5 rounded-full bg-volt animate-pulseGlow" /> live
          </span>
        </div>
        <svg viewBox="0 0 320 250" className="mt-2 w-full" aria-hidden>
          <defs>
            <linearGradient id="hm-g" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#7FE0B8" />
              <stop offset="60%" stopColor="#C8F23A" />
              <stop offset="100%" stopColor="#F4FFD0" />
            </linearGradient>
            <filter id="hm-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {ticks.map((i) => {
            const d = start + (sweep * i) / 48;
            const major = i % 8 === 0;
            const [x1, y1] = polar(d, major ? 104 : 110);
            const [x2, y2] = polar(d, 116);
            const on = i / 48 <= pct;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? "#C8F23A" : "#2A302C"} strokeOpacity={on ? 0.9 : 1} strokeWidth={major ? 2.4 : 1.2} strokeLinecap="round" style={{ transition: "stroke 0.6s" }} />;
          })}
          {[0, 25, 50, 75, 100].map((v) => {
            const [x, y] = polar(start + (sweep * v) / 100, 88);
            return (
              <text key={v} x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="#6b736e" fontFamily="var(--font-geist-mono)">
                {v}
              </text>
            );
          })}
          <path d={arc(start, start + sweep)} fill="none" stroke="#161a18" strokeWidth="14" strokeLinecap="round" />
          <path
            d={arc(start, start + sweep)}
            fill="none"
            stroke="url(#hm-g)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - pct)}
            filter="url(#hm-glow)"
            style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }}
          />
          <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: `${C}px ${C}px`, transition: "transform 1.6s cubic-bezier(.2,.9,.25,1.15)" }}>
            <line x1={C} y1={C} x2={C + 96} y2={C} stroke="#F4FFD0" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={C + 96} cy={C} r="3" fill="#C8F23A" filter="url(#hm-glow)" />
          </g>
          <circle cx={C} cy={C} r="11" fill="#0b0d0c" stroke="#C8F23A" strokeWidth="3" />
          <text x={C} y={C + 52} textAnchor="middle" fontSize="38" fill="#E7EBE8" fontFamily="var(--font-geist-mono)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {balance.toFixed(2)}
          </text>
          <text x={C} y={C + 70} textAnchor="middle" fontSize="9" letterSpacing="2.5" fill="#9BA39E" fontFamily="var(--font-geist-mono)">
            KWOTA AVAILABLE
          </text>
        </svg>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          {[
            ["next epoch", "+3.84"],
            ["metered", kw.toFixed(4)],
            ["agents", "2 live"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/5 bg-black/30 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-fog">{k}</div>
              <div className="mt-0.5 font-mono text-sm text-fog-100 tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 h-[104px] overflow-hidden rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-6">
          {log.length === 0 && <div className="text-fog">waiting for requests…</div>}
          {log.map((r, i) => (
            <div key={r.id} className="flex justify-between gap-2 transition-opacity" style={{ opacity: 1 - i * 0.22 }}>
              <span className="truncate text-fog">
                <span className="text-volt">POST</span> /v1/chat · {r.model}
              </span>
              <span className="shrink-0 text-fog-100">
                {r.tok} tok · <span className="text-volt">−{r.cost.toFixed(5)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-fog/60">Live illustration</p>
    </div>
  );
}
