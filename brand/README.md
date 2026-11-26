# KWOTA brand assets (DexScreener)

| File | Size | Ratio | Notes |
|---|---|---|---|
| `kwota-logo.png` | 1000×1000 | 1:1 | the site's logo mark (favicon.svg), transparent background |
| `kwota-logo.gif` | 500×500 | 1:1 | same mark on #050505 (GIF has no smooth transparency) |
| `kwota-banner.png` | 1500×500 | 3:1 | static banner |
| `kwota-banner.gif` | 1500×500 | 3:1 | animated meter + LED bar + counter, 3 s loop |

All files are well under DexScreener's 4.5 MB limit.

Logo: `node brand/src/logo-mark.cjs brand`. Banner (requires Playwright + ffmpeg): `node brand/src/render.cjs brand` then the ffmpeg commands in the commit history / below:

```bash
ffmpeg -y -framerate 20 -i brand/.frames-logo/f%03d.png -vf "scale=500:500:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0 brand/kwota-logo.gif
```
