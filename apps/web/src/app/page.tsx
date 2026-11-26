import Link from "next/link";
import { Copy } from "@/components/ui";
import { config } from "@/lib/config";
import { HeroMeter } from "@/components/landing/HeroMeter";
import { Ticker } from "@/components/landing/Ticker";
import { Pipeline } from "@/components/landing/Pipeline";
import { Terminal } from "@/components/landing/Terminal";
import { AgentDeck } from "@/components/landing/AgentDeck";
import { SplitRing } from "@/components/landing/SplitRing";
import { CountUp, Reveal, SpotlightCard } from "@/components/landing/fx";

const faqs = [
  { q: "What is one kwota worth?", a: "1 kwota = $1 of AI usage at the listed model price. Every request is metered per token (input × price + output × price) and deducted from your balance." },
  { q: "How is my share calculated?", a: "Your share of an epoch's budget = your balance × the seconds you held it, divided by the same for all eligible holders. Buying right before an epoch closes earns almost nothing; holding through the whole epoch earns full weight." },
  { q: "Who is excluded?", a: "Liquidity pool addresses, the project wallets (treasury, pool, vault, ops) and blacklisted addresses never receive kwota and never dilute holders." },
  { q: "Can I verify the numbers?", a: "Yes. Every epoch publishes a full snapshot, its SHA-256 and a Merkle root. The open-source verifier rebuilds every allocation from on-chain Transfer events." },
  { q: "Do I need to claim?", a: "No. Kwota lands on your wallet address automatically. Sign in with your wallet whenever you want to spend it." },
  { q: "Does kwota expire?", a: "Unused kwota expires after a configurable number of epochs (30 by default) and flows back to the pool for everyone else." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-volt">
      <span className="h-px w-6 bg-volt/60" />
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-fog-100 sm:text-5xl">{children}</h2>;
}

export default function Home() {
  return (
    <div className="relative">
      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden">
        <div className="aurora absolute inset-0" />
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_60%_30%,black,transparent_70%)]" />
        <svg className="pointer-events-none absolute -right-40 -top-40 h-[760px] w-[760px] animate-spinSlow opacity-[0.07]" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="none" stroke="#C8F23A" strokeWidth="0.15" strokeDasharray="0.6 1.4" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#C8F23A" strokeWidth="0.1" />
        </svg>
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-24">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-fog backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-volt" />
                </span>
                AI inference credits · live on Robinhood Chain
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-7 text-[44px] font-semibold leading-[0.98] tracking-[-0.045em] text-fog-100 sm:text-7xl lg:text-[84px]">
                Your AI kwota,
                <br />
                <span className="text-gradient">funded by every trade.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-fog sm:text-xl">
                Every $KWOTA trade fills a pool of AI inference credits. Hold the token, receive kwota each epoch, and spend it on frontier
                models — yourself, or through your own ERC-8004 agents.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/app/"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-volt px-7 py-3.5 font-medium text-ink shadow-[0_0_40px_-8px_rgba(200,242,58,0.7)] transition hover:shadow-[0_0_60px_-6px_rgba(200,242,58,0.9)]"
                >
                  Open app
                  <span className="transition group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/transparency/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-fog-100 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06]">
                  See the live meter
                </Link>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-fog/80">
                {["OpenAI-compatible API", "ERC-8004 agents", "Merkle-verified epochs", "Per-token metering"].map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <span className="text-volt">✓</span>
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <div className="animate-float">
              <HeroMeter />
            </div>
          </Reveal>
        </div>
      </section>

      <Ticker />

      {/* ───────── NUMBERS ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 md:grid-cols-4">
          {[
            { v: 1, d: 0, pre: "$", suf: "", k: "of AI per kwota", s: "1 kwota = $1 usage" },
            { v: 50, d: 0, pre: "", suf: "%", k: "of fees to holders", s: "metered every epoch" },
            { v: 24, d: 0, pre: "", suf: "h", k: "epoch length", s: "time-weighted balances" },
            { v: 100, d: 0, pre: "", suf: "%", k: "verifiable", s: "Merkle root per epoch" },
          ].map((x) => (
            <div key={x.k} className="bg-ink px-6 py-8">
              <div className="font-mono text-4xl text-fog-100 sm:text-5xl">
                <CountUp to={x.v} decimals={x.d} prefix={x.pre} suffix={x.suf} />
              </div>
              <div className="mt-2 text-sm text-fog-100">{x.k}</div>
              <div className="mt-0.5 text-xs text-fog">{x.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <H2>
            Fee <span className="text-fog">→</span> Pool <span className="text-fog">→</span> Kwota <span className="text-fog">→</span> AI
          </H2>
          <p className="mt-5 max-w-2xl text-lg text-fog">A simple, auditable pipeline. Every hop is recorded, signed and shown live on the transparency page.</p>
        </Reveal>
        <Reveal delay={100} className="mt-12">
          <Pipeline />
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { n: "01", t: "Trade", d: "Every buy and sell of $KWOTA on Pons pays a trading fee straight into the project wallet." },
            { n: "02", t: "Split", d: "Fees are booked into three buckets: the Kwota Pool, the public vault, and operations." },
            { n: "03", t: "Meter", d: "Each epoch, realized pool stablecoins are metered to holders by time-weighted balance." },
            { n: "04", t: "Use", d: "Spend kwota on AI through an OpenAI-compatible API — or hand a share to your agents." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <SpotlightCard className="h-full p-6">
                <div className="font-mono text-xs text-volt">{s.n}</div>
                <div className="mt-4 text-xl font-medium text-fog-100">{s.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-fog">{s.d}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120} className="mt-6">
          <SpotlightCard className="p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-fog">The kwota formula</div>
                <div className="mt-3 overflow-x-auto font-mono text-base text-fog-100 sm:text-lg">
                  kwota<sub>i</sub> = budget × <span className="text-volt">Σ balance<sub>i</sub>·Δt</span> / Σ<sub>eligible</sub> balance·Δt
                </div>
              </div>
              <p className="max-w-sm text-sm text-fog">budget = 90% of realized, undistributed pool stablecoins + last epoch’s rounding dust. No kwota is created without real funds behind it.</p>
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* ───────── BENTO ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <Eyebrow>Why KWOTA</Eyebrow>
          <H2>Built like infrastructure, not a promise.</H2>
        </Reveal>
        <div className="mt-12 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4 md:row-span-2">
            <SpotlightCard className="h-full p-7">
              <div className="flex h-full flex-col">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-volt">Live, not roadmap</div>
                <h3 className="mt-3 text-2xl font-semibold text-fog-100">Kwota for your AI agents</h3>
                <p className="mt-2 max-w-lg text-sm text-fog">Allocate part of your kwota to agents you own in an ERC-8004 registry, set daily caps, and stop any of them in one click.</p>
                <div className="mt-6 flex-1">
                  <AgentDeck />
                </div>
              </div>
            </SpotlightCard>
          </Reveal>
          {[
            { t: "Transparent by default", d: "Pool, fees, split, vault balance, Merkle roots and model prices — all public and live.", k: "/transparency" },
            { t: "Time-weighted", d: "Holding longer earns more. Snapshot sniping earns almost nothing.", k: "Σ balance·Δt" },
          ].map((b, i) => (
            <Reveal key={b.t} delay={80 + i * 80} className="md:col-span-2">
              <SpotlightCard className="h-full p-6">
                <div className="font-mono text-xs text-volt">{b.k}</div>
                <h3 className="mt-3 text-lg font-medium text-fog-100">{b.t}</h3>
                <p className="mt-2 text-sm text-fog">{b.d}</p>
              </SpotlightCard>
            </Reveal>
          ))}
          {[
            { t: "No claiming", d: "Kwota lands on your address automatically every epoch.", k: "auto-credit" },
            { t: "Never undercharged", d: "Max cost is reserved up front; you pay only tokens actually used.", k: "reserve → settle" },
            { t: "Recycled, not lost", d: "Unused kwota expires back to the pool for every other holder.", k: "30-epoch expiry" },
          ].map((b, i) => (
            <Reveal key={b.t} delay={80 + i * 80} className="md:col-span-2">
              <SpotlightCard className="h-full p-6">
                <div className="font-mono text-xs text-volt">{b.k}</div>
                <h3 className="mt-3 text-lg font-medium text-fog-100">{b.t}</h3>
                <p className="mt-2 text-sm text-fog">{b.d}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── DEVELOPERS ───────── */}
      <section id="agents" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_1.15fr]">
          <Reveal>
            <Eyebrow>For builders</Eyebrow>
            <H2>One base URL. Every model.</H2>
            <p className="mt-5 text-lg text-fog">Point any OpenAI SDK at KWOTA and pay with kwota instead of a credit card. Agents sign each request with EIP-712 — nonce, expiry and body hash — so nothing can be replayed.</p>
            <ul className="mt-7 space-y-3 text-sm text-fog-100">
              {["Streaming + non-streaming chat completions", "Per-key and per-wallet rate limits", "Agent keys bound to one allocation and its daily cap", "Usage log for every request"].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-volt" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <Link href="/docs/" className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-fog-100 hover:bg-white/5">Read the docs</Link>
              <Link href="/app/keys/" className="rounded-full bg-white/10 px-5 py-2.5 text-sm text-fog-100 hover:bg-white/15">Get an API key</Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <Terminal />
          </Reveal>
        </div>
      </section>

      {/* ───────── TOKENOMICS ───────── */}
      <section id="tokenomics" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <Reveal>
          <Eyebrow>Tokenomics</Eyebrow>
          <H2>Where every fee goes.</H2>
        </Reveal>
        <div className="mt-12 grid items-center gap-8 md:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <SplitRing />
          </Reveal>
          <div className="space-y-4">
            {[
              { pct: 50, t: "Kwota Pool", d: "Converted to stablecoins and metered out to holders as AI credits.", c: "bg-volt" },
              { pct: 30, t: "Vault", d: "Held in a public vault anyone can check on-chain.", c: "bg-[#7FE0B8]" },
              { pct: 20, t: "Operations", d: "Infrastructure, provider overhead and development.", c: "bg-[#3a423d]" },
            ].map((b, i) => (
              <Reveal key={b.t} delay={i * 80}>
                <SpotlightCard className="p-5">
                  <div className="flex items-center gap-5">
                    <div className="w-20 font-mono text-3xl text-fog-100">{b.pct}%</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium text-fog-100">
                        <span className={`h-2.5 w-2.5 rounded-full ${b.c}`} />
                        {b.t}
                      </div>
                      <p className="mt-1 text-sm text-fog">{b.d}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
            <Reveal delay={260}>
              <div className="glass flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-fog">Contract · $KWOTA</div>
                  <div className="mt-1 break-all font-mono text-sm text-fog-100">{config.token ?? "Announced at launch on Pons"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.token && <Copy text={config.token} label="copy CA" />}
                  {config.links.pons && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.pons} target="_blank" rel="noreferrer">Pons</a>}
                  {config.links.dexscreener && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.dexscreener} target="_blank" rel="noreferrer">DexScreener</a>}
                  {config.links.x && <a className="rounded-md border border-line px-3 py-1 text-xs text-fog-100 hover:bg-ink-700" href={config.links.x} target="_blank" rel="noreferrer">X</a>}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <H2>Questions, metered.</H2>
          </div>
        </Reveal>
        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 50}>
              <details className="glass group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fog-100">
                  {f.q}
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-white/10 font-mono text-fog transition group-open:rotate-45 group-open:border-volt/50 group-open:text-volt">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-fog">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 px-6 py-16 text-center sm:px-16 sm:py-24">
            <div className="aurora absolute inset-0 opacity-90" />
            <div className="dot-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-fog-100 sm:text-6xl">
                Hold the token.
                <br />
                <span className="text-gradient">Run the models.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-fog">Sign in with your wallet and watch your kwota fill up every epoch.</p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/app/" className="rounded-full bg-volt px-8 py-4 font-medium text-ink shadow-[0_0_50px_-8px_rgba(200,242,58,0.8)] transition hover:shadow-[0_0_70px_-6px_rgba(200,242,58,1)]">
                  Open app →
                </Link>
                <Link href="/docs/" className="rounded-full border border-white/15 bg-black/30 px-8 py-4 text-fog-100 backdrop-blur hover:bg-black/50">
                  API docs
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
