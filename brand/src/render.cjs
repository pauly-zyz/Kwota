// node render.cjs <outdir>  → logo.png, banner.png, frame sequences for GIFs
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const path = require("path"), fs = require("fs");
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const [mode, w, h, frames] of [["logo", 1000, 1000, 60], ["banner", 1500, 500, 60]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto("file://" + path.join(__dirname, "art.html") + "?mode=" + mode);
    await p.waitForFunction(() => window.ready === true);
    await p.evaluate(() => window.render(0, true));
    await p.screenshot({ path: path.join(out, `kwota-${mode}.png`), clip: { x: 0, y: 0, width: w, height: h } });
    const dir = path.join(out, `.frames-${mode}`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    for (let i = 0; i < frames; i++) {
      await p.evaluate((t) => window.render(t, false), i / frames);
      await p.screenshot({ path: path.join(dir, `f${String(i).padStart(3, "0")}.png`), clip: { x: 0, y: 0, width: w, height: h } });
    }
    await p.close();
  }
  await b.close();
})();
