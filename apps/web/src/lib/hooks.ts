"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { demoMode } from "./config";
import { demoEpochs, demoModels, demoOverview, demoSwaps } from "./demo";

export type Overview = typeof demoOverview;
export type EpochRow = (typeof demoEpochs)[number];
export type ModelRow = (typeof demoModels)[number];
export type SwapRow = (typeof demoSwaps)[number];

export const usePublic = <T,>(key: string, path: string, demo: T) =>
  useQuery<T>({ queryKey: ["public", key], queryFn: () => (demoMode ? Promise.resolve(demo) : api<T>(path, { auth: false })), refetchInterval: 30_000 });

export const useOverview = () => usePublic("overview", "/public/overview", demoOverview);
export const useEpochs = () => usePublic("epochs", "/public/epochs", demoEpochs);
export const useModels = () => usePublic("models", "/public/models", demoModels);
export const useSwaps = () => usePublic("swaps", "/public/swaps", demoSwaps);
