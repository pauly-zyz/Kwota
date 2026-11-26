"use client";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn("relative border border-white/10 bg-black/60 p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-fog">[ {title} ]</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, hint, accent }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.14em] text-fog">{label}</div>
      <div className={cn("mt-1 truncate font-display text-3xl font-semibold tabular-nums sm:text-4xl", accent ? "text-volt" : "text-fog-100")}>
        {value}
        {unit && <span className="ml-1.5 text-sm text-fog">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-fog">{hint}</div>}
    </div>
  );
}

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-volt text-ink hover:bg-[#d8ff4f]",
        variant === "ghost" && "border border-white/15 text-fog-100 hover:border-volt hover:text-volt",
        variant === "danger" && "border border-danger/50 text-danger hover:bg-danger/10",
        className,
      )}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "volt" | "amber" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        tone === "neutral" && "border-line text-fog",
        tone === "volt" && "border-volt/40 bg-volt/10 text-volt",
        tone === "amber" && "border-amber/40 bg-amber/10 text-amber",
        tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
      )}
    >
      {children}
    </span>
  );
}

export function Copy({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="border border-white/15 px-2 py-1 font-mono text-xs uppercase text-fog hover:border-volt hover:text-volt"
    >
      {done ? "copied" : (label ?? "copy")}
    </button>
  );
}

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn("w-full border border-white/10 bg-black px-3 py-2 text-sm text-fog-100 outline-none placeholder:text-fog/60 focus:border-volt/60", p.className)} />;
}

export function Bar({ value, max, tone = "volt" }: { value: number; max: number; tone?: "volt" | "amber" | "danger" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden bg-white/10">
      <div className={cn("h-full transition-all", tone === "volt" ? "bg-volt" : tone === "amber" ? "bg-amber" : "bg-danger")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-white/10 px-4 py-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-fog">{children}</div>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{(error as Error).message}</div>;
}
