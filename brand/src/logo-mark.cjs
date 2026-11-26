// Render the existing KWOTA logo mark (apps/web/public/favicon.svg) to PNG.
const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
const fs = require("fs"), path = require("path");
const svg = fs.readFileSync(path.join(__dirname, "../../apps/web/public/favicon.svg"), "utf8");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  for (const [name, bg] of [["kwota-logo.png", "transparent"], ["logo-dark-bg.png", "#050505"]]) {
    await p.setContent(`<html><body style="margin:0;background:${bg}"><div style="width:1000px;height:1000px">${svg.replace("<svg ", '<svg width="1000" height="1000" ')}</div></body></html>`);
    await p.screenshot({ path: path.join(process.argv[2], name), omitBackground: bg === "transparent", clip: { x: 0, y: 0, width: 1000, height: 1000 } });
  }
  await b.close();
})();
