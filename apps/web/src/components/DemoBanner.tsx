import { demoMode } from "@/lib/config";

export function DemoBanner({ what = "Figures below are sample data" }: { what?: string }) {
  if (!demoMode) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
      <span className="font-mono uppercase tracking-wider">Preview mode</span> · {what}. Live numbers appear once the KWOTA API is connected after launch.
    </div>
  );
}
