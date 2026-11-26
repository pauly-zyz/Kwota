"use client";
import { useEffect, useState } from "react";

const seed = [
  { n: "research-bot", id: 12, cap: 2, used: 0.84 },
  { n: "trader-agent", id: 7, cap: 1, used: 0.31 },
  { n: "summarizer", id: 33, cap: 0.5, used: 0.41 },
];

/** Agents spending their own allocation in real time; one hits its cap, one gets stopped. */
export function AgentDeck() {
  const [agents, setAgents] = useState(seed.map((a) => ({ ...a, stopped: false })));
  useEffect(() => {
    const iv = setInterval(() => {
      setAgents((xs) =>
        xs.map((a) => {
          if (a.stopped) return a;
          const used = Math.min(a.cap, a.used + Math.random() * 0.03);
          return { ...a, used };
        }),
      );
    }, 700);
    const stop = setTimeout(() => setAgents((xs) => xs.map((a) => (a.id === 7 ? { ...a, stopped: true } : a))), 6500);
    const reset = setInterval(() => setAgents(seed.map((a) => ({ ...a, stopped: false }))), 15000);
    return () => {
      clearInterval(iv);
      clearTimeout(stop);
      clearInterval(reset);
    };
  }, []);
  return (
    <div className="space-y-3">
      {agents.map((a) => {
        const capped = a.used >= a.cap - 0.001;
        const state = a.stopped ? "stopped" : capped ? "daily cap" : "active";
        const color = a.stopped ? "bg-danger" : capped ? "bg-amber" : "bg-volt";
        return (
          <div key={a.id} className="rounded-2xl border border-white/5 bg-black/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-fog-100">
                {a.n} <span className="text-fog">#{a.id}</span>
              </span>
              <span className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${a.stopped ? "text-danger" : capped ? "text-amber" : "text-volt"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${color} ${state === "active" ? "animate-pulseGlow" : ""}`} />
                {state}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
              <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(a.used / a.cap) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-fog">
              <span className="tabular-nums">{a.used.toFixed(3)} used today</span>
              <span>cap {a.cap.toFixed(2)} · EIP-712 signed</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
