/** Fee → Pool → Kwota → AI as an animated circuit with flowing particles. */
const nodes = [
  { x: 70, label: "Trade", sub: "fees on Pons", icon: "M-7 4 L-2 -2 L2 2 L7 -5" },
  { x: 290, label: "Pool", sub: "50% → stables", icon: "M-7 -3 H7 V5 H-7 Z M-4 -3 V-6 H4 V-3" },
  { x: 510, label: "Kwota", sub: "time-weighted", icon: "M-7 4 A7 7 0 0 1 7 4 M0 4 L4 -2" },
  { x: 730, label: "AI", sub: "any model", icon: "M-6 -6 H6 V6 H-6 Z M-3 -3 H3 V3 H-3 Z" },
];

export function Pipeline() {
  return (
    <div className="glass overflow-hidden p-4 sm:p-8">
      <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label="Fee to Pool to Kwota to AI">
        <defs>
          <linearGradient id="pl-line" x1="0" x2="1">
            <stop offset="0" stopColor="#7FE0B8" stopOpacity="0.6" />
            <stop offset="1" stopColor="#C8F23A" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="pl-node">
            <stop offset="0" stopColor="#C8F23A" stopOpacity="0.35" />
            <stop offset="1" stopColor="#C8F23A" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* branches: vault + ops split off the pool */}
        <path d="M 290 110 C 320 110 320 196 350 196 L 378 196" fill="none" stroke="#2A302C" strokeWidth="2" />
        <path d="M 290 110 C 320 110 320 30 350 30 L 378 30" fill="none" stroke="#2A302C" strokeWidth="2" />
        <text x="386" y="34" fontSize="11" fill="#9BA39E" fontFamily="var(--font-geist-mono)">30% vault</text>
        <text x="386" y="200" fontSize="11" fill="#9BA39E" fontFamily="var(--font-geist-mono)">20% ops</text>
        <path d="M 70 110 H 730" fill="none" stroke="#1F2421" strokeWidth="6" strokeLinecap="round" />
        <path d="M 70 110 H 730" fill="none" stroke="url(#pl-line)" strokeWidth="2" strokeDasharray="6 18" className="animate-flow" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} r="3.5" fill="#F4FFD0">
            <animateMotion dur="4.5s" begin={`${i * 0.9}s`} repeatCount="indefinite" path="M 70 110 H 730" />
            <animate attributeName="opacity" values="0;1;1;0" dur="4.5s" begin={`${i * 0.9}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {nodes.map((n) => (
          <g key={n.label} transform={`translate(${n.x} 110)`}>
            <circle r="46" fill="url(#pl-node)" />
            <circle r="28" fill="#0b0d0c" stroke="#C8F23A" strokeOpacity="0.8" strokeWidth="1.5" />
            <path d={n.icon} fill="none" stroke="#C8F23A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text y="54" textAnchor="middle" fontSize="15" fill="#E7EBE8" fontWeight="600">{n.label}</text>
            <text y="72" textAnchor="middle" fontSize="11" fill="#9BA39E" fontFamily="var(--font-geist-mono)">{n.sub}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
