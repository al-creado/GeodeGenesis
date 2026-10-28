/**
 * Generates the launcher icons, splash images, Play Store icon, feature graphic and
 * phone screenshots from the game's own SVG art. No image assets are checked in as sources.
 *
 * Usage (after `npm run build`):
 *   node tools/generate-store-assets.js
 * Needs Playwright with Chromium installed (not a project dependency).
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist/geode-genesis/browser');
const RES = path.join(ROOT, 'android/app/src/main/res');
const STORE = path.join(ROOT, 'store');
const PORT = 4611;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(PORT, () => resolve(server));
  });
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const BG = '#2A1C14';
const STAL = '#1C120C';

const star = (cx, cy, r, fill = '#F2B84B') =>
  `<path transform="translate(${cx} ${cy}) scale(${r / 7})" fill="${fill}" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"/>`;

/** Stalactite strip across the top of a 100-unit-wide box. */
const stalactites = (w, h) => {
  const spikes = [[0, 12, 9], [10, 11, 15], [20, 9, 8], [29, 12, 12], [41, 9, 7], [50, 11, 16], [61, 10, 9], [71, 12, 13], [83, 9, 8], [92, 10, 12]];
  const d = spikes.map(([x, wd, hh]) => `M${(x / 100) * w} 0 L${((x + wd) / 100) * w} 0 L${((x + wd / 2) / 100) * w} ${(hh / 100) * h} Z`).join(' ');
  return `<path d="${d}" fill="${STAL}"/>`;
};

/** Full-bleed square icon artwork: cave background, stalactites, glow, gem. */
const iconArt = (gem, size, { background = true, stalac = true, gemScale = 0.82 } = {}) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="glow" cx="50%" cy="52%" r="48%"><stop offset="0" stop-color="#8a5a8f" stop-opacity="0.75"/><stop offset="0.6" stop-color="#5C402D" stop-opacity="0.35"/><stop offset="1" stop-color="#5C402D" stop-opacity="0"/></radialGradient></defs>
  ${background ? `<rect width="100" height="100" fill="${BG}"/>` : ''}
  ${stalac ? stalactites(100, 100) : ''}
  <circle cx="50" cy="52" r="46" fill="url(#glow)"/>
  <g transform="translate(${50 - 50 * gemScale} ${54 - 50 * gemScale}) scale(${gemScale})">${star(14, 22, 6)}${star(87, 30, 4.5)}${star(80, 82, 5, '#ffffff')}
    <svg x="0" y="0" width="100" height="100" viewBox="0 0 120 120">${gem}</svg>
  </g>
</svg>`;

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('Run `npm run build` first (dist/ is missing).');
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`http://localhost:${PORT}/preview`);
  await page.waitForSelector('app-gem-art');

  // Pull the game's own gem SVGs (unframed) from the gallery.
  const grab = (name, framed) =>
    page.evaluate(([n, f]) => {
      const art = [...document.querySelectorAll('article')].find((a) => a.querySelector('h3')?.textContent?.trim() === n).querySelector('svg').cloneNode(true);
      if (!f) art.querySelector('.frame')?.remove();
      art.removeAttribute('class');
      return { defs: art.querySelector('defs').outerHTML, body: [...art.children].filter((c) => c.tagName !== 'defs').map((c) => c.outerHTML).join('') };
    }, [name, framed]);
  const inner = (g) => g.defs + g.body;

  const render = async (html, w, h, file, { transparent = false } = {}) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(([markup, bg]) => {
      document.documentElement.style.background = bg;
      document.body.style.cssText = `margin:0;overflow:hidden;background:${bg}`;
      document.body.innerHTML = markup;
    }, [html, transparent ? 'transparent' : BG]);
    await page.waitForTimeout(100);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: transparent, animations: 'disabled' });
  };

  // Grab everything from the gallery before the page body is replaced by compositions.
  const gemSvg = inner(await grab('Halo', false));
  const names = ['Pebble', 'Plum', 'Fern', 'Ember', 'Halo'];
  const gems = [];
  for (const n of names) gems.push(inner(await grab(n, true)));

  // ---- Launcher icons ----
  for (const [name, scale] of Object.entries(DENSITIES)) {
    const legacy = Math.round(48 * scale);
    const adaptive = Math.round(108 * scale);
    const dir = path.join(RES, `mipmap-${name}`);
    await render(iconArt(gemSvg, legacy), legacy, legacy, path.join(dir, 'ic_launcher.png'));
    await render(`<div style="width:${legacy}px;height:${legacy}px;border-radius:50%;overflow:hidden">${iconArt(gemSvg, legacy)}</div>`, legacy, legacy, path.join(dir, 'ic_launcher_round.png'), { transparent: true });
    // Adaptive foreground: transparent, gem kept inside the 66% safe zone.
    await render(iconArt(gemSvg, adaptive, { background: false, stalac: false, gemScale: 0.6 }), adaptive, adaptive, path.join(dir, 'ic_launcher_foreground.png'), { transparent: true });
  }
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);

  // ---- Splash (cave color with the gem) ----
  const splash = (w, h) => `<div style="width:${w}px;height:${h}px;display:grid;place-items:center;background:${BG}">${iconArt(gemSvg, Math.round(Math.min(w, h) * 0.5), { background: false, stalac: false, gemScale: 0.95 })}</div>`;
  const port = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [name, [w, h]] of Object.entries(port)) {
    await render(splash(w, h), w, h, path.join(RES, `drawable-port-${name}/splash.png`));
    await render(splash(h, w), h, w, path.join(RES, `drawable-land-${name}/splash.png`));
  }
  await render(splash(480, 320), 480, 320, path.join(RES, 'drawable/splash.png'));

  // ---- Play Store assets ----
  await render(iconArt(gemSvg, 512), 512, 512, path.join(STORE, 'play-icon-512.png'));

  const feature = `
  <div style="position:relative;width:1024px;height:500px;background:radial-gradient(ellipse at 50% 70%, #5C402D 0%, ${BG} 70%);font-family:Nunito,sans-serif;color:#F6E7D0">
    <svg style="position:absolute;left:0;top:0" width="1024" height="500" viewBox="0 0 1024 500">${stalactites(1024, 330)}</svg>
    <div style="position:absolute;left:0;right:0;top:92px;text-align:center">
      <div style="font-weight:800;font-size:92px;color:#F2B84B;letter-spacing:1px;text-shadow:0 5px 0 #24160F">Geode Genesis</div>
      <div style="font-weight:700;font-size:34px;margin-top:6px">Crack geodes. Collect cute gems.</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:34px;display:flex;justify-content:center;gap:22px">
      ${gems.map((g) => `<svg width="150" height="150" viewBox="0 0 120 120" style="overflow:visible">${g}</svg>`).join('')}
    </div>
  </div>`;
  await render(feature, 1024, 500, path.join(STORE, 'feature-graphic-1024x500.png'));

  // ---- Phone screenshots from the live app ----
  const shotPage = await browser.newPage({ viewport: { width: 360, height: 720 }, deviceScaleFactor: 3 });
  await shotPage.goto(`http://localhost:${PORT}/camp`);
  await shotPage.evaluate(() => {
    const dayNum = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const lv = { pebble: 3, frost: 2, honey: 1, mochi: 1, pip: 2, biscuit: 1, plum: 4, bluebell: 2, lilac: 1, wisp: 1, fern: 2, clover: 1, ember: 1, cherry: 1, halo: 1 };
    const collection = Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, { level: v }]));
    localStorage.setItem('geode-genesis-save', JSON.stringify({
      version: 2, coins: 1840, shards: 24, collection, pity: { sinceEmerald: 6, sinceRuby: 21 },
      crew: ['halo', 'ember', 'fern'], crewSlots: 3, lastIdleCollect: Date.now() - 5.5 * 3600000,
      daily: { claimedDay: 3, lastClaimDay: dayNum - 1 }, totalCracks: 61, settings: { adsEnabled: true }, savedAt: Date.now(),
    }));
  });
  const shot = async (url, name, act) => {
    await shotPage.goto(`http://localhost:${PORT}${url}`);
    await shotPage.waitForTimeout(700);
    if (act) await act();
    await shotPage.screenshot({ path: path.join(STORE, 'screenshots', name) });
  };
  await shot('/camp', '1-camp.png');
  await shot('/mine', '2-mine.png');
  await shot('/mine', '3-mine-x10.png', async () => {
    await shotPage.getByRole('button', { name: /Mine x10/ }).click();
    await shotPage.waitForSelector('.revealed', { timeout: 5000 });
    await shotPage.waitForTimeout(900);
  });
  await shot('/vault', '4-vault.png');
  await shot('/crew', '5-crew.png');

  await browser.close();
  server.close();
  console.log('Assets written to android/app/src/main/res and store/');
}

main().catch((e) => { console.error(e); process.exit(1); });
