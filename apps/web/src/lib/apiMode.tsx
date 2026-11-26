"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { absoluteApiUrl, config, demoMode as currentDemo, setDemoMode } from "./config";

const Ctx = createContext(true);
const CACHE = "kwota.apiReady";

/** Probes the API once per page load; caches the last answer so returning visitors start in the right mode. */
export function ApiModeProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(true);
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    const apply = (live: boolean) => {
      const changed = currentDemo !== !live;
      setDemoMode(!live);
      if (cancelled) return;
      setDemo(!live);
      if (changed) qc.resetQueries(); // drop data fetched in the other mode
    };
    try {
      if (localStorage.getItem(CACHE) === "1") apply(true);
    } catch {
      /* ignore */
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    fetch(`${config.apiUrl}/health`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ready?: boolean } | null) => {
        const live = !!j?.ready;
        try {
          localStorage.setItem(CACHE, live ? "1" : "0");
        } catch {
          /* ignore */
        }
        apply(live);
      })
      .catch(() => apply(false))
      .finally(() => clearTimeout(t));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [qc]);
  return <Ctx.Provider value={demo}>{children}</Ctx.Provider>;
}

export const useDemo = () => useContext(Ctx);

/** Absolute API base URL, hydration-safe (resolved after mount). */
export function useApiBase() {
  const [base, setBase] = useState(`https://<your-domain>${config.apiUrl}`);
  useEffect(() => {
    setBase(absoluteApiUrl());
  }, []);
  return base;
}
