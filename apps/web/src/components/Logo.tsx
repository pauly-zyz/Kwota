export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#C8F23A" />
        <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="#0B0D0C" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M16 21 21.5 13.5" stroke="#0B0D0C" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="21" r="2.2" fill="#0B0D0C" />
      </svg>
      <span className="font-mono text-[15px] font-semibold tracking-[0.18em] text-fog-100">KWOTA</span>
    </span>
  );
}
