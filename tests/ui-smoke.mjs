import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Optional QA tooling: Playwright is supplied by the caller, not by the app.
const repo = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
let chromium;
try {
  ({ chromium } = require(process.env.POCKET_PLAYWRIGHT_MODULE || 'playwright'));
} catch (cause) {
  throw new Error('Playwright is unavailable. Set POCKET_PLAYWRIGHT_MODULE to an existing Playwright package; see docs/verification.md.', { cause });
}
const assets = path.join(repo, 'app/src/main/assets');
const fonts = process.env.POCKET_FONT_DIR ? path.resolve(process.env.POCKET_FONT_DIR) : null;
const output = process.env.POCKET_SCREENSHOT_DIR ? path.resolve(process.env.POCKET_SCREENSHOT_DIR) : path.join(repo, 'docs/screenshots');
const browserArgs = process.env.POCKET_BROWSER_ARGS ? JSON.parse(process.env.POCKET_BROWSER_ARGS) : ['--disable-dev-shm-usage'];
assert.ok(Array.isArray(browserArgs) && browserArgs.every(arg => typeof arg === 'string'), 'POCKET_BROWSER_ARGS must be a JSON array of strings.');
if (fonts) for (const weight of [400, 600, 700]) await fs.access(path.join(fonts, `${weight}.css`));
await fs.mkdir(output, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const fontRequest = pathname.startsWith('/font/');
    const root = fontRequest ? fonts : assets;
    if (!root) { res.writeHead(404); res.end(); return; }
    const relative = fontRequest ? pathname.slice(6) : pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});

let browser;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    ...(process.env.POCKET_CHROMIUM_EXECUTABLE ? { executablePath: path.resolve(process.env.POCKET_CHROMIUM_EXECUTABLE) } : {}),
    headless: true, args: browserArgs,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  const checks = [];
  page.on('pageerror', error => errors.push(error.message));
  // Only the browser audio contract is stubbed: this checks routing and button
  // independence, not whether a real phone has a Korean voice installed.
  await page.addInitScript(() => {
    window.__audioCalls = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'ko-KR', name: 'QA Korean voice' }],
      cancel() {}, speak(value) { window.__audioCalls.push({ text: value.text, lang: value.lang }); },
    } });
  });

  async function fontsReady() {
    if (!fonts) return;
    await page.addStyleTag({ content: "@import url('/font/400.css'); @import url('/font/600.css'); @import url('/font/700.css'); :root{--font:system-ui,-apple-system,'Noto Sans KR',Arial,sans-serif} [lang=ko],.ko{font-family:'Noto Sans KR',sans-serif}" });
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
  }
  async function nav(area) {
    await page.getByRole('navigation').getByText(area, { exact: true }).click();
    await page.locator(`.nav-item.active[href="#${area.toLowerCase()}"]`).waitFor();
  }
  async function shot(name) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
  }
  async function checkFit(label) {
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(overflow.scroll <= overflow.width + 1, `${label} horizontally overflows: ${JSON.stringify(overflow)}`);
    checks.push(`${label} fits`);
  }

  await page.goto(base, { waitUntil: 'networkidle' });
  await fontsReady();
  await page.getByRole('heading', { name: 'Home, little adventurer.' }).waitFor();
  await checkFit('Home at 390px'); await shot('home');
  assert.equal(await page.locator('.town-face').count(), 5);
  for (const area of ['Learn', 'Write', 'Speak', 'Words', 'Translate']) {
    await nav(area); await checkFit(`${area} at 390px`); await shot(area.toLowerCase());
  }

  await nav('Words');
  await page.locator('.vocab-row').first().waitFor();
  assert.equal(await page.locator('.vocab-row').count(), 12);
  await page.locator('[data-action="word-detail"][data-id="korean"]').click();
  await page.getByRole('dialog').getByText('[한구거]', { exact: true }).waitFor();
  await shot('word-detail');
  await page.getByRole('button', { name: 'Practice this', exact: true }).click();
  await page.getByRole('button', { name: 'Type it', exact: true }).click();
  await page.locator('#practice-answer').fill('한국어');
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
  await page.getByText('That’s the word.', { exact: true }).waitFor();
  await nav('Words');
  assert.ok(await page.locator('[data-id="korean"]').evaluate(el => el.classList.contains('learning')));
  await page.reload({ waitUntil: 'networkidle' }); await fontsReady();
  assert.ok(await page.locator('[data-id="korean"]').evaluate(el => el.classList.contains('learning')));
  checks.push('typed recall persists and turns the word yellow');

  await page.getByRole('button', { name: 'Add a word', exact: true }).click();
  await page.locator('#new-ko').fill('강아지');
  await page.locator('#new-en').fill('puppy');
  await page.getByRole('button', { name: 'Add to my vocabulary', exact: true }).click();
  await page.locator('#word-search').fill('puppy');
  assert.equal(await page.locator('.vocab-row').count(), 1);
  await page.locator('.vocab-row').click();
  await page.getByRole('dialog').getByText('Listen to the Korean audio for pronunciation.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('new vocabulary can be saved, searched and opened');

  await nav('Learn');
  assert.equal(await page.locator('.quest-card').count(), 10);
  checks.push('ten quests and five recurring townspeople');
  await page.locator('[data-action="open-lesson"][data-id="first-hello"]').click();
  await page.getByRole('button', { name: 'Begin quest', exact: true }).click();
  await shot('quest-intro');
  await page.getByRole('button', { name: 'Step into the story', exact: true }).click();
  assert.equal(await page.locator('.quest-scene .character-svg').count(), 2);
  const audio = page.locator('.answer-option-row [data-action="play-korean"]').first();
  const spokenText = await audio.getAttribute('data-text');
  await audio.click();
  assert.equal(await page.locator('.answer-option.selected').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.__audioCalls.at(-1)), { text: spokenText, lang: 'ko-KR' });
  checks.push('Korean option audio leaves the answer unselected');
  await shot('quest-challenge');
  const { LESSONS } = await import(pathToFileURL(path.join(assets, 'data/curriculum.js')).href);
  const lesson = LESSONS.find(item => item.id === 'first-hello');
  async function completeChallenges() {
    for (const challenge of lesson.challenges) {
      if (challenge.type === 'choose') await page.locator(`[data-action="lesson-choice"][data-index="${challenge.options.indexOf(challenge.answer)}"]`).click();
      else for (const token of challenge.answer.split(' ')) await page.getByRole('button', { name: token, exact: true }).click();
      await page.locator('[data-action="check-lesson"]').click();
      assert.equal(await page.locator('[data-action="lesson-retry"]').count(), 0);
      await page.locator('[data-action="lesson-next"]').click();
    }
  }
  await completeChallenges();
  await shot('quest-finish');
  await page.locator('[data-action="finish-lesson"]').click();
  await page.locator('[data-id="first-hello"]').getByText('Revisit anytime', { exact: false }).waitFor();
  await nav('Home');
  assert.equal(parseInt(await page.locator('.wallet').innerText(), 10), 20);
  checks.push('first quest saves completion and awards 20 coins');
  await page.getByRole('button', { name: 'Little shop', exact: true }).click();
  const beanie = page.locator('.shop-card[data-item="hat-beanie"]');
  await beanie.getByRole('button', { name: 'Buy · 20 coins', exact: true }).click();
  await beanie.getByRole('button', { name: 'Wearing', exact: true }).waitFor();
  assert.equal(parseInt(await page.locator('.wallet').innerText(), 10), 0);
  await shot('shop');
  await page.reload({ waitUntil: 'networkidle' }); await fontsReady();
  await page.getByRole('button', { name: 'Wardrobe', exact: true }).click();
  await page.locator('.shop-card[data-item="hat-beanie"]').getByRole('button', { name: 'Wearing', exact: true }).waitFor();
  assert.equal(parseInt(await page.locator('.wallet').innerText(), 10), 0);
  await shot('wardrobe');
  checks.push('hat purchase, balance and equipment survive reopening');

  await nav('Learn');
  const playerArt = await page.locator('.quest-scene .scene-person.player .character-svg').innerHTML();
  assert.ok(playerArt.includes('#D79573'), 'the equipped beanie is visible in the quest scene');
  await page.locator('[data-action="open-lesson"][data-id="first-hello"]').click();
  await page.getByRole('button', { name: 'Revisit this quest', exact: true }).click();
  await page.getByRole('button', { name: 'Step into the story', exact: true }).click();
  await completeChallenges();
  await page.getByRole('button', { name: 'Finish this visit', exact: true }).click();
  await nav('Home');
  assert.equal(parseInt(await page.locator('.wallet').innerText(), 10), 0);
  checks.push('quest revisit preserves the outfit and awards no duplicate coins');

  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const area of ['Home', 'Learn', 'Write', 'Speak', 'Words', 'Translate']) {
      await nav(area); await checkFit(`${area} at ${width}px`);
    }
    await nav('Home');
    for (const section of ['Little shop', 'Wardrobe']) {
      await page.getByRole('button', { name: section, exact: true }).click();
      await checkFit(`${section} at ${width}px`);
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors, screenshotDirectory: output }, null, 2));
} finally {
  try { await browser?.close(); }
  finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
