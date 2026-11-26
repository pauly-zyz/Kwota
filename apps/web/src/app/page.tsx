import Link from "next/link";
import { Meter } from "@/components/Meter";
import { Copy } from "@/components/ui";
import { config } from "@/lib/config";

const steps = [
  { n: "01", t: "Trade", d: "Every buy and sell of $KWOTA on Pons pays a trading fee straight into the project wallet." },
  { n: "02", t: "Split", d: "Fees are booked into three buckets: the Kwota Pool, the public ANT Vault, and operations." },
  { n: "03", t: "Meter", d: "Each epoch, the pool's realized stablecoins are metered out to holders by time-weighted balance." },
  { n: "04", t: "Use", d: "Spend kwota on AI models through an OpenAI-compatible API — or hand a share to your agents." },
];

const faqs = [
  { q: "What is one kwota worth?", a: "1 kwota = $1 of AI usage at the listed model price. Requests are metered per token (input × price + output × price) and deducted from your balance." },
  { q: "How is my share calculated?", a: "Your share of an epoch's budget = your balance × time held during the epoch, divided by the same for all eligible holders. Buying right before an epoch closes earns almost nothing; holding through the whole epoch earns the full weight." },
  { q: "Who is excluded?", a: "Liquidity pool addresses, the project wallets (treasury, pool, vault, ops) and blacklisted addresses never receive kwota and do not dilute holders." },
  { q: "Can I verify the numbers?", a: "Yes. Every epoch publishes a full snapshot, its SHA-256 and a Merkle root. The open-source verify script rebuilds every allocation from on-chain Transfer events." },
  { q: "Do I need to claim?", a: "No. Kwota is credited to your wallet address automatically. Sign in with your wallet whenever you want to use it." },
  { q: "Does kwota expire?", a: "Unused kwota expires after a configurable number of epochs (30 by default) and returns to the pool for other holders." },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="glow absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-800 px-3 py-1 font-mono text-xs text-fog">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt" /> AI inference credits · Robinhood Chain
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-fog-100 sm:text-6xl">
              Your AI kwota,
              <br />
              <span className="text-volt">funded by every trade.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-fog">
              $KWOTA turns trading fees into metered AI usage. Hold the token, receive kwota every epoch, and spend it on leading models — yourself or
              through your own ERC-8004 agents.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app/" className="rounded-full bg-volt px-6 py-3 font-medium text-ink hover:bg-volt-600">
                Open app
              </Link>
              <Link href="/transparency/" className="rounded-full border border-line px-6 py-3 text-fog-100 hover:bg-ink-700">
                See the live meter
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-3xl border border-line bg-ink-800/80 p-6 shadow-2xl">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-fog">
              <span>Epoch kwota</span>
              <span className="font-mono text-volt">● live</span>
            </div>
            <div className="mt-4 flex justify-center">
              <Meter value={0.68} label="68%" sub="of your kwota left" size={280} />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
              {[
                ["Balance", "42.10"],
                ["Next epoch", "+3.84"],
                ["Agents", "2 / 5.00"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[11px] uppercase tracking-wider text-fog">{k}</div>
                  <div className="mt-1 font-mono text-lg text-fog-100">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-ink-900 p-3 font-mono text-[12px] leading-relaxed text-fog">
              <span className="text-volt">POST</span> /v1/chat/completions
              <br />→ 812 in · 344 out tokens · <span className="text-fog-100">−0.0029 kwota</span>
            </div>
            <p className="mt-3 text-center text-[11px] text-fog/70">Illustration</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">Fee → Pool → Kwota → AI</h2>
        <p className="mt-3 max-w-2xl text-fog">A simple, auditable pipeline. Every step is recorded and shown on the transparency page.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative rounded-2xl border border-line bg-ink-800 p-5">
              <div className="font-mono text-xs text-volt">{s.n}</div>
              <div className="mt-3 text-lg font-medium text-fog-100">{s.t}</div>
              <p className="mt-2 text-sm text-fog">{s.d}</p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink-600">
                <div className="h-full rounded-full bg-volt" style={{ width: `${(i + 1) * 25}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-line bg-ink-800 p-6">
          <div className="text-xs uppercase tracking-[0.14em] text-fog">The kwota formula</div>
          <div className="mt-3 overflow-x-auto font-mono text-sm text-fog-100 sm:text-base">
            kwota<sub>i</sub> = budget<sub>epoch</sub> × ( Σ balance<sub>i</sub> × seconds held ) / ( Σ<sub>all eligible</sub> balance × seconds held )
          </div>
          <p className="mt-3 text-sm text-fog">
            budget<sub>epoch</sub> = 90% of realized, undistributed pool stablecoins + rounding dust from the previous epoch. No kwota is ever created without real funds behind it.
          </p>
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.16em] text-volt">Live, not roadmap</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">Kwota for your AI agents</h2>
            <p className="mt-4 text-fog">
              Register agents you own in an ERC-8004 identity registry, allocate part of your kwota and set a daily cap. Agents pay for their own
              inference with signed requests — and you can stop them with one click.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-fog-100">
              {[
                "Ownership verified on-chain via the registry's ownerOf()",
                "EIP-712 signed requests with nonce + expiry (no replay) or agent-bound API keys",
                "Per-agent daily limit, live usage, instant stop & reclaim",
                "Holder flow untouched: agents spend only what you allocate",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-volt" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 rounded-3xl border border-line bg-ink-800 p-6">
            {[
              { n: "research-bot #12", used: 1.42, cap: 2, status: "active" },
              { n: "trader-agent #7", used: 0.31, cap: 1, status: "active" },
              { n: "summarizer #33", used: 0.5, cap: 0.5, status: "capped" },
            ].map((a) => (
              <div key={a.n} className="rounded-2xl border border-line bg-ink-900 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-fog-100">{a.n}</span>
                  <span className={a.status === "active" ? "font-mono text-xs text-volt" : "font-mono text-xs text-amber"}>{a.status}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-600">
                  <div className={a.status === "active" ? "h-full bg-volt" : "h-full bg-amber"} style={{ width: `${(a.used / a.cap) * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs text-fog">
                  <span>{a.used.toFixed(2)} used today</span>
                  <span>cap {a.cap.toFixed(2)}</span>
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] text-fog/70">Illustration</p>
          </div>
        </div>
      </section>

      {/* Tokenomics */}
      <section id="tokenomics" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">Where every fee goes</h2>
        <p className="mt-3 max-w-2xl text-fog">Default split, adjustable only by signed admin action and always shown live on the transparency page.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { pct: 50, t: "Kwota Pool", d: "Converted to stablecoins and metered out to holders as AI credits." },
            { pct: 30, t: "ANT Vault", d: "Held as ANT stock tokens in a public vault anyone can check on-chain." },
            { pct: 20, t: "Operations", d: "Infrastructure, model provider overhead and development." },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-line bg-ink-800 p-6">
              <div className="font-mono text-5xl text-fog-100">
                {b.pct}
                <span className="text-2xl text-fog">%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-600">
                <div className="h-full bg-volt" style={{ width: `${b.pct}%` }} />
              </div>
              <div className="mt-4 font-medium text-fog-100">{b.t}</div>
              <p className="mt-1 text-sm text-fog">{b.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-ink-800 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-fog">Contract address · $KWOTA</div>
            <div className="mt-1 break-all font-mono text-sm text-fog-100">{config.token ?? "Announced at launch on Pons"}</div>
            <div className="mt-1 text-xs text-fog">Pair: KWOTA / ANT (stock token)</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.token && <Copy text={config.token} label="copy CA" />}
            {config.links.pons && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.pons} target="_blank" rel="noreferrer">Pons</a>}
            {config.links.dexscreener && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.dexscreener} target="_blank" rel="noreferrer">DexScreener</a>}
            {config.links.x && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.x} target="_blank" rel="noreferrer">X</a>}
          </div>
        </div>
      </section>

      {/* Transparency teaser */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-ink-800 p-8 md:p-12">
          <div className="glow absolute inset-0" />
          <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-fog-100">Everything on the meter</h2>
              <p className="mt-3 text-fog">
                Pool balance, fee inflows, the split, the ANT vault read directly from chain, kwota distributed per epoch, Merkle roots, model prices and
                pool coverage — all public, all live.
              </p>
              <Link href="/transparency/" className="mt-6 inline-block rounded-full bg-volt px-6 py-3 font-medium text-ink hover:bg-volt-600">
                Open transparency
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-sm">
              {["Pool balance", "ANT vault", "Merkle root / epoch", "Coverage ratio"].map((t) => (
                <div key={t} className="rounded-xl border border-line bg-ink-900 p-4 text-fog">
                  <div className="text-[11px] uppercase tracking-wider">{t}</div>
                  <div className="mt-2 h-2 w-2/3 rounded bg-ink-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-fog-100">FAQ</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-ink-800">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-fog-100">
                {f.q}
                <span className="font-mono text-fog transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-fog">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
