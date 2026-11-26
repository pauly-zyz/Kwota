import Link from "next/link";
import { Logo } from "./Logo";
import { config } from "@/lib/config";

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/5 bg-gradient-to-b from-transparent to-black/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-fog">Your AI kwota, funded by every trade.</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-fog">
          <Link href="/app/" className="hover:text-fog-100">App</Link>
          <Link href="/transparency/" className="hover:text-fog-100">Transparency</Link>
          <Link href="/docs/" className="hover:text-fog-100">API docs</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm text-fog">
          {config.links.pons && <a href={config.links.pons} target="_blank" rel="noreferrer" className="hover:text-fog-100">Pons</a>}
          {config.links.dexscreener && <a href={config.links.dexscreener} target="_blank" rel="noreferrer" className="hover:text-fog-100">DexScreener</a>}
          {config.links.x && <a href={config.links.x} target="_blank" rel="noreferrer" className="hover:text-fog-100">X</a>}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-fog/80">
        KWOTA is an independent project. It is not affiliated with, endorsed by, or sponsored by Anthropic, PBC or Robinhood Markets, Inc.
        ANT is referenced only as the stock token used in the $KWOTA trading pair. Kwota are usage credits for AI inference, not an investment
        product, and carry no claim on any asset. Model names belong to their respective owners. Nothing here is financial advice.
      </div>
    </footer>
  );
}
