"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        set(true);
        io.disconnect();
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** Highlighter that fills like a meter when scrolled into view. */
export function Mark({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  return (
    <span ref={ref} className={`mark ${inView ? "in" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </span>
  );
}

/** Full-width LED bar: segments light up in a travelling wave. */
export function SegmentBar({ segments = 64, className = "" }: { segments?: number; className?: string }) {
  return (
    <div className={`flex h-3 w-full gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="h-full flex-1 bg-volt animate-seg" style={{ animationDelay: `${(i / segments) * 2.4}s` }} />
      ))}
    </div>
  );
}

/** Static meter bar with N filled segments. */
export function SegMeter({ value, total = 20 }: { value: number; total?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  return (
    <div ref={ref} className="flex h-2 gap-[2px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`flex-1 transition-colors duration-300 ${inView && i < value ? "bg-volt" : "bg-white/10"}`}
          style={{ transitionDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

/** Giant digital readout: kwota metered, counting live. */
export function BigReadout() {
  const [v, setV] = useState(12841.3071);
  useEffect(() => {
    const iv = setInterval(() => setV((x) => x + Math.random() * 0.019), 120);
    return () => clearInterval(iv);
  }, []);
  const txt = v.toFixed(4).padStart(12, "0");
  return (
    <div className="relative select-none font-display leading-none tracking-[-0.02em]">
      <div className="ghost-digits text-[clamp(56px,13vw,200px)] font-semibold">8888888.8888</div>
      <div className="absolute inset-0 text-[clamp(56px,13vw,200px)] font-semibold text-volt [text-shadow:0_0_40px_rgba(200,242,58,0.35)]">
        {txt.split("").map((c, i) => (
          <span key={i} className={i < txt.search(/[1-9]/) ? "text-volt/15" : ""}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mono label like "[ 01 ]". */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">[ {children} ]</span>;
}
