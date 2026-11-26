// Subtle refreshes of the existing KWOTA mark (32×32 grid, same arc + needle geometry).
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const path = require("path");
const out = process.argv[2];

// ticks along the arc (center 16,21 r 9 → ticks at r 6.2..7.4), 180° → 0°
const ticks = (color, op = 1) =>
  [180, 150, 120, 90, 60, 30, 0].map((d) => {
    const a = (d * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const r1 = 5.9, r2 = d % 90 === 0 ? 7.3 : 6.9;
    return `<line x1="${16 + r1 * c}" y1="${21 - r1 * s}" x2="${16 + r2 * c}" y2="${21 - r2 * s}" stroke="${color}" stroke-opacity="${op}" stroke-width="${d % 90 === 0 ? 1.1 : 0.8}" stroke-linecap="round"/>`;
  }).join("");

const V = {
  // A: same lime tile, refined — soft gradient, inner highlight, ticks, hollow hub
  "a-refined": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9FF52"/><stop offset="1" stop-color="#B9E52A"/></linearGradient></defs>
    <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#t)"/>
    <rect x="1.4" y="1.4" width="29.2" height="29.2" rx="8.6" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width=".5"/>
    <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="#0B0D0C" stroke-width="2.4" stroke-linecap="round"/>
    ${ticks("#0B0D0C", 0.55)}
    <path d="M16 21 21.5 13.5" stroke="#0B0D0C" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="16" cy="21" r="2.3" fill="#C8F23A" stroke="#0B0D0C" stroke-width="1.6"/>
  </svg>`,
  // B: full-bleed lime (DexScreener crops to a circle itself), mark centred for the circle
  "b-fullbleed": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><radialGradient id="t" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#DFFF66"/><stop offset="1" stop-color="#B7E22A"/></radialGradient></defs>
    <rect width="32" height="32" fill="url(#t)"/>
    <g transform="translate(16 18.2) scale(1.08) translate(-16 -18.2)">
      <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="#0B0D0C" stroke-width="2.4" stroke-linecap="round"/>
      ${ticks("#0B0D0C", 0.55)}
      <path d="M16 21 21.5 13.5" stroke="#0B0D0C" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="16" cy="21" r="2.3" fill="#C8F23A" stroke="#0B0D0C" stroke-width="1.6"/>
    </g>
  </svg>`,
  // C: inverted — black tile, glowing lime mark (matches the new dark site)
  "c-dark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs>
      <linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7FE0B8"/><stop offset=".6" stop-color="#C8F23A"/><stop offset="1" stop-color="#F4FFD0"/></linearGradient>
      <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="1" y="1" width="30" height="30" rx="9" fill="#0B0D0C"/>
    <rect x="1.3" y="1.3" width="29.4" height="29.4" rx="8.7" fill="none" stroke="#C8F23A" stroke-opacity=".35" stroke-width=".5"/>
    <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round" filter="url(#f)"/>
    ${ticks("#C8F23A", 0.6)}
    <path d="M16 21 21.5 13.5" stroke="#F4FFD0" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="16" cy="21" r="2.3" fill="#0B0D0C" stroke="#C8F23A" stroke-width="1.6"/>
  </svg>`,
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  for (const [k, svg] of Object.entries(V)) {
    require("fs").writeFileSync(path.join(out, `logo-${k}.svg`), svg);
    await p.setContent(`<body style="margin:0;background:transparent">${svg.replace("<svg ", '<svg width="1000" height="1000" ')}</body>`);
    await p.screenshot({ path: path.join(out, `logo-${k}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 1000, height: 1000 } });
  }
  // contact sheet: each variant as square + as DexScreener-style circle crop, on dark bg
  const cells = Object.entries(V).map(([k, svg]) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:18px">
      <div style="display:flex;gap:22px;align-items:center">
        <div style="width:220px;height:220px">${svg.replace("<svg ", '<svg width="220" height="220" ')}</div>
        <div style="width:110px;height:110px;border-radius:50%;overflow:hidden">${svg.replace("<svg ", '<svg width="110" height="110" ')}</div>
        <div style="width:40px;height:40px;border-radius:50%;overflow:hidden">${svg.replace("<svg ", '<svg width="40" height="40" ')}</div>
      </div>
      <div style="font:600 22px system-ui;color:#E7EBE8;letter-spacing:.08em">${k.split("-")[0].toUpperCase()} · ${k.split("-")[1]}</div>
    </div>`).join("");
  const orig = require("fs").readFileSync(path.join(__dirname, "../../apps/web/public/favicon.svg"), "utf8");
  await p.setViewportSize({ width: 1700, height: 820 });
  await p.setContent(`<body style="margin:0;background:#050505;font-family:system-ui">
    <div style="padding:40px 50px">
      <div style="display:flex;align-items:center;gap:16px;color:#9BA39E;font:15px monospace;letter-spacing:.2em">
        <div style="width:48px;height:48px">${orig.replace("<svg ", '<svg width="48" height="48" ')}</div> CURRENT LOGO → 3 SUBTLE REFRESHES (square · circle crop · small)
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:60px">${cells}</div>
    </div></body>`);
  await p.screenshot({ path: path.join(out, "logo-variants-sheet.png"), clip: { x: 0, y: 0, width: 1700, height: 820 } });
  await b.close();
})();
