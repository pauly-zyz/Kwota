import Link from "next/link";
import { Copy } from "@/components/ui";
import { config } from "@/lib/config";
import { BigReadout, Mark, SegMeter, SegmentBar, Tag } from "@/components/b/parts";
import { LiveBoard } from "@/components/b/LiveBoard";
import { Terminal } from "@/components/landing/Terminal";
import { AgentDeck } from "@/components/landing/AgentDeck";
import { Reveal } from "@/components/landing/fx";

const steps = [
  { t: "Hold $KWOTA", d: "Your balance is tracked second by second. The longer you hold through an epoch, the larger your weight.", v: 6 },
  { t: "Trades fill the pool", d: "Every buy and sell on Pons pays a fee into the project wallet. 50% is converted to stablecoins for the Kwota Pool.", v: 11 },
  { t: "Kwota is metered out", d: "At each epoch close the pool budget is split by time-weighted balance and published with a Merkle root.", v: 16 },
  { t: "Spend it on AI", d: "Sign in with your wallet, create an API key and call any listed model. Every token is deducted from your kwota.", v: 20 },
];

const faqs = [
  { q: "What is one kwota worth?", a: "1 kwota = $1 of AI usage at the listed model price, metered per token." },
  { q: "How is my share calculated?", a: "Balance × seconds held during the epoch, divided by the same for all eligible holders. Snapshot sniping earns almost nothing." },
  { q: "Who is excluded?", a: "LP pairs, the project wallets and blacklisted addresses. They never receive kwota and never dilute holders." },
  { q: "Can I verify the numbers?", a: "Every epoch publishes its snapshot, SHA-256 and Merkle root. The open-source verifier rebuilds it from on-chain Transfer events." },
  { q: "Do I need to claim?", a: "No. Kwota lands on your address automatically every epoch." },
  { q: "Does kwota expire?", a: "After 30 epochs by default — unused kwota flows back to the pool for everyone else." },
];

const H = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`font-display text-[clamp(40px,7vw,96px)] font-semibold uppercase leading-[0.92] tracking-[-0.02em] text-fog-100 ${className}`}>{children}</h2>
);

export default function Home() {
  return (
    <div className="relative bg-[#050505]">
      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden border-b hair">
        <div className="grid-bg absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:pt-24">
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tag>AI inference credits · Robinhood Chain</Tag>
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-volt">
                <span className="h-2 w-2 bg-volt animate-pulseGlow" /> meter online
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-10 font-display text-[clamp(52px,10vw,148px)] font-semibold uppercase leading-[0.88] tracking-[-0.03em] text-fog-100">
              Your AI <Mark>kwota</Mark>,
              <br />
              funded by
              <br />
              every trade.
            </h1>
          </Reveal>
          <div className="mt-12 grid gap-10 border-t hair pt-8 md:grid-cols-[1.2fr_1fr]">
            <Reveal delay={160}>
              <p className="max-w-xl font-mono text-sm leading-7 text-fog sm:text-base">
                $KWOTA turns trading fees into metered AI usage. Hold the token, receive kwota every epoch, spend it on frontier models — yourself
                or through your own ERC-8004 agents. Every number is public and verifiable.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="flex flex-wrap items-start gap-3 md:justify-end">
                <Link href="/app/" className="group inline-flex items-center gap-3 bg-volt px-6 py-4 font-display text-sm font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-[#d8ff4f]">
                  Open app <span className="transition group-hover:translate-x-1">→</span>
                </Link>
                <Link href="/transparency/" className="inline-flex items-center gap-3 border border-white/15 px-6 py-4 font-display text-sm font-semibold uppercase tracking-[0.12em] text-fog-100 transition hover:border-volt hover:text-volt">
                  Live meter
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-14">
          <div className="flex items-end justify-between font-mono text-[11px] uppercase tracking-[0.25em] text-fog">
            <span>kwota metered · all time</span>
            <span className="hidden sm:inline">1 kwota = $1 of AI</span>
          </div>
          <div className="mt-3 overflow-hidden">
            <BigReadout />
          </div>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-fog/50">illustrative counter</p>
        </div>
      </section>

      <SegmentBar className="opacity-90" />

      {/* ───────── HOW IT WORKS ───────── */}
      <section id="how" className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <Tag>01 — Mechanism</Tag>
              <H className="mt-6">
                How it
                <br />
                <Mark>works</Mark>
              </H>
              <p className="mt-6 max-w-md font-mono text-sm leading-7 text-fog">Four steps, fully on the record. Fees in, kwota out, every hop signed and published.</p>
              <div className="mt-8 border hair bg-black/60 p-5 font-mono text-sm text-fog-100">
                <div className="text-[11px] uppercase tracking-[0.2em] text-fog">formula</div>
                <div className="mt-2 overflow-x-auto">
                  kwota<sub>i</sub> = budget × <span className="text-volt">Σ bal<sub>i</sub>·Δt</span> / Σ bal·Δt
                </div>
              </div>
            </Reveal>
          </div>
          <div className="border-t hair">
            {steps.map((s, i) => (
              <Reveal key={s.t} delay={i * 60}>
                <div className="group grid grid-cols-[auto_1fr] gap-6 border-b hair py-10 sm:gap-10">
                  <div className="font-display text-5xl font-semibold text-white/15 transition group-hover:text-volt sm:text-7xl">/{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold uppercase tracking-[-0.01em] text-fog-100 sm:text-3xl">{s.t}</h3>
                    <p className="mt-3 max-w-md font-mono text-sm leading-7 text-fog">{s.d}</p>
                    <div className="mt-6 max-w-sm">
                      <SegMeter value={s.v} />
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── THREE AUDIENCES ───────── */}
      <section className="border-y hair">
        <div className="mx-auto max-w-7xl px-4 py-24">
          <Reveal>
            <Tag>02 — Who it powers</Tag>
            <H className="mt-6">
              <Mark>Holders.</Mark> Agents.
              <br />
              Builders.
            </H>
          </Reveal>
          <div className="mt-14 grid border-l border-t hair md:grid-cols-3">
            {[
              { k: "A", t: "Holders", d: "Kwota lands on your wallet every epoch — no claim, no staking. Spend it in the playground or through an API key.", l: ["time-weighted share", "auto-credited", "30-epoch expiry → pool"] },
              { k: "B", t: "Agents", d: "Allocate kwota to agents you own in an ERC-8004 registry. Daily caps, EIP-712 signed requests, one-click stop.", l: ["ownerOf() verified", "nonce + expiry", "reclaim anytime"] },
              { k: "C", t: "Builders", d: "OpenAI-compatible endpoint. Point any SDK at KWOTA and pay per token in kwota instead of a credit card.", l: ["/v1/chat/completions", "streaming", "per-key rate limits"] },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 80}>
                <div className="group h-full border-b border-r hair p-8 transition hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">layer {c.k}</span>
                    <span className="h-2 w-2 bg-white/20 transition group-hover:bg-volt" />
                  </div>
                  <h3 className="mt-10 font-display text-4xl font-semibold uppercase text-fog-100">{c.t}</h3>
                  <p className="mt-4 font-mono text-sm leading-7 text-fog">{c.d}</p>
                  <ul className="mt-8 space-y-2 font-mono text-xs uppercase tracking-[0.12em] text-fog-100">
                    {c.l.map((x) => (
                      <li key={x} className="flex items-center gap-3">
                        <span className="text-volt">▸</span>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── AGENTS + CODE ───────── */}
      <section id="agents" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24">
        <Reveal>
          <Tag>03 — In production</Tag>
          <H className="mt-6">
            Agents that pay
            <br />
            <Mark>their own way</Mark>
          </H>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full border hair bg-black p-6">
              <div className="mb-5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-fog">
                <span>agent allocations · today</span>
                <span className="text-volt">ERC-8004</span>
              </div>
              <AgentDeck />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <Terminal />
          </Reveal>
        </div>
      </section>

      {/* ───────── LIVE BOARD ───────── */}
      <section className="border-y hair bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Reveal>
              <Tag>04 — Transparency</Tag>
              <H className="mt-6">
                Nothing <Mark>hidden</Mark>
              </H>
            </Reveal>
            <Reveal delay={80}>
              <Link href="/transparency/" className="inline-flex items-center gap-3 border border-white/15 px-6 py-4 font-display text-sm font-semibold uppercase tracking-[0.12em] text-fog-100 transition hover:border-volt hover:text-volt">
                Full transparency →
              </Link>
            </Reveal>
          </div>
          <Reveal delay={120} className="mt-12">
            <LiveBoard />
          </Reveal>
        </div>
      </section>

      {/* ───────── TOKENOMICS ───────── */}
      <section id="tokenomics" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24">
        <Reveal>
          <Tag>05 — Fee split</Tag>
          <H className="mt-6">Every fee, <Mark>allocated</Mark></H>
        </Reveal>
        <div className="mt-14 space-y-px">
          {[
            { p: 50, t: "Kwota Pool", d: "Converted to stablecoins, metered to holders as AI credits." },
            { p: 30, t: "Vault", d: "Held publicly — readable on-chain by anyone." },
            { p: 20, t: "Operations", d: "Infrastructure, provider overhead, development." },
          ].map((b, i) => (
            <Reveal key={b.t} delay={i * 80}>
              <div className="grid items-center gap-4 border hair bg-black/40 p-6 sm:grid-cols-[140px_1fr_2fr]">
                <div className="font-display text-6xl font-semibold text-fog-100">
                  {b.p}
                  <span className="text-2xl text-volt">%</span>
                </div>
                <div>
                  <div className="font-display text-xl font-semibold uppercase text-fog-100">{b.t}</div>
                  <div className="mt-1 font-mono text-xs text-fog">{b.d}</div>
                </div>
                <SegMeter value={b.p / 5} />
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="mt-6 flex flex-col gap-4 border hair p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">contract · $KWOTA</div>
              <div className="mt-2 break-all font-mono text-sm text-fog-100">{config.token ?? "Announced at launch on Pons"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.token && <Copy text={config.token} label="copy CA" />}
              {config.links.pons && <a className="border border-white/15 px-3 py-1.5 font-mono text-xs uppercase text-fog-100 hover:border-volt" href={config.links.pons} target="_blank" rel="noreferrer">Pons</a>}
              {config.links.dexscreener && <a className="border border-white/15 px-3 py-1.5 font-mono text-xs uppercase text-fog-100 hover:border-volt" href={config.links.dexscreener} target="_blank" rel="noreferrer">DexScreener</a>}
              {config.links.x && <a className="border border-white/15 px-3 py-1.5 font-mono text-xs uppercase text-fog-100 hover:border-volt" href={config.links.x} target="_blank" rel="noreferrer">X</a>}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="border-t hair">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <Tag>06 — FAQ</Tag>
            <H className="mt-6">
              Questions,
              <br />
              <Mark>metered</Mark>
            </H>
          </Reveal>
          <div className="border-t hair">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 40}>
                <details className="group border-b hair py-6 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6">
                    <span className="flex items-baseline gap-5">
                      <span className="font-mono text-xs text-fog">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-display text-xl font-semibold uppercase text-fog-100 sm:text-2xl">{f.q}</span>
                    </span>
                    <span className="font-display text-2xl text-fog transition group-open:rotate-45 group-open:text-volt">+</span>
                  </summary>
                  <p className="mt-4 max-w-xl pl-10 font-mono text-sm leading-7 text-fog">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="relative overflow-hidden border-t hair">
        <SegmentBar segments={96} className="h-2 opacity-60" />
        <div className="mx-auto max-w-7xl px-4 py-28">
          <Reveal>
            <h2 className="font-display text-[clamp(48px,9vw,140px)] font-semibold uppercase leading-[0.88] tracking-[-0.03em] text-fog-100">
              Hold the token.
              <br />
              <Mark>Run the models.</Mark>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link href="/app/" className="group inline-flex items-center gap-3 bg-volt px-8 py-5 font-display text-base font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-[#d8ff4f]">
                Open app <span className="transition group-hover:translate-x-1">→</span>
              </Link>
              <Link href="/docs/" className="inline-flex items-center gap-3 border border-white/15 px-8 py-5 font-display text-base font-semibold uppercase tracking-[0.12em] text-fog-100 transition hover:border-volt hover:text-volt">
                API docs
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
