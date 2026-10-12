#!/usr/bin/env node
// Real installed-APK check. Run on a freshly booted Android emulator with Node 22+.
// Usage: node tests/android-smoke.mjs path/Pocket-Korean.apk output-directory
// This requires a debug APK; release WebViews intentionally do not expose DevTools.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const packageName = 'net.pocketlab.korean';
const appUrl = 'https://appassets.androidplatform.net/assets/index.html';
const apkPath = resolve(process.argv[2] || 'deliverables/Pocket-Korean.apk');
const output = resolve(process.argv[3] || 'android-smoke');
const report = {
  status: 'running',
  scope: 'Installed debug APK startup and physical/renderer presentation diagnostics',
  sourceRunId: process.env.SOURCE_RUN_ID || null,
  sourceHeadSha: process.env.SOURCE_HEAD_SHA || null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  startedAt: new Date().toISOString(),
  presentation: { status: 'pending_review' },
  checkpoints: [],
  images: {},
  diagnosticsErrors: [],
};
let cdp;
let forwardedPort;
let liveLogProcess;
let liveLogPromise;

async function checkpoint(name, action) {
  const started = Date.now();
  const point = { name, startedAt: new Date(started).toISOString() };
  report.checkpoints.push(point);
  try {
    const result = await action();
    point.status = 'completed';
    return result;
  } catch (error) {
    point.status = 'failed';
    point.error = error.message;
    throw error;
  } finally {
    point.finishedAt = new Date().toISOString();
    point.durationMs = Date.now() - started;
  }
}

function adb(args, options = {}) {
  return execute('adb', ['-e', ...args], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024, ...options,
  });
}

async function until(description, check, milliseconds = 30000) {
  const deadline = Date.now() + milliseconds;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error; }
    await delay(500);
  }
  throw new Error(description + ' timed out' + (lastError ? ': ' + lastError.message : ''));
}

async function openCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const exceptions = [];
  let serial = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error)));
    else task.resolve(message.result);
  });
  const rejectPending = () => {
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(new Error('The Android WebView DevTools connection closed'));
    }
    pending.clear();
  };
  socket.addEventListener('close', rejectPending);
  socket.addEventListener('error', rejectPending);
  await new Promise((resolveConnection, rejectConnection) => {
    const timer = setTimeout(() => {
      socket.close();
      rejectConnection(new Error('WebView DevTools connection timed out'));
    }, 10000);
    socket.addEventListener('open', () => {
      clearTimeout(timer); resolveConnection();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer); rejectConnection(new Error('Cannot connect to WebView DevTools'));
    }, { once: true });
    socket.addEventListener('close', () => {
      clearTimeout(timer); rejectConnection(new Error('WebView closed before DevTools connected'));
    }, { once: true });
  });
  return {
    exceptions,
    close: () => socket.close(),
    send(method, params = {}, milliseconds = 10000) {
      return new Promise((resolveResult, rejectResult) => {
        const id = ++serial;
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectResult(new Error(method + ' timed out'));
        }, milliseconds);
        pending.set(id, { resolve: resolveResult, reject: rejectResult, timer });
        try { socket.send(JSON.stringify({ id, method, params })); }
        catch (error) {
          pending.delete(id); clearTimeout(timer); rejectResult(error);
        }
      });
    },
  };
}

async function evaluate(fn, milliseconds = 10000) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: '(' + fn.toString() + ')()',
    returnByValue: true, awaitPromise: true,
  }, milliseconds);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

function uiSnapshot() {
  const heading = document.querySelector('#main h1');
  const topbar = document.querySelector('.topbar');
  const bounds = heading?.getBoundingClientRect();
  return {
    url: location.href,
    title: document.title,
    heading: heading?.textContent?.trim() || '',
    navigation: [...document.querySelectorAll('#nav a')].map(node => node.textContent.trim()),
    activeNavigation: document.querySelector('#nav a[aria-current="page"]')?.textContent.trim() || '',
    documentReadyState: document.readyState,
    rootFrame: window === window.top,
    roots: Object.fromEntries(['app', 'main', 'nav'].map(id =>
      [id, document.querySelectorAll('#' + id).length])),
    loadingNodes: document.querySelectorAll('.loading-screen').length,
    viewport: {
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      visual: visualViewport ? {
        width: visualViewport.width, height: visualViewport.height,
        offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
        scale: visualViewport.scale,
      } : null,
    },
    headingBounds: bounds ? {
      left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
    } : null,
    visible: Boolean(bounds && bounds.width > 0 && bounds.height > 0
      && bounds.top >= 0 && bounds.top < innerHeight
      && document.visibilityState === 'visible'
      && getComputedStyle(heading).visibility === 'visible'),
    cssLoaded: Boolean(topbar && getComputedStyle(topbar).display === 'flex'),
    bridgePresent: typeof window.PocketNative?.request === 'function',
    appStarted: typeof window.pocketBack === 'function',
  };
}

async function nativeSnapshot() {
  // Import the existing application module. No fake bridge or replacement callback is installed.
  const services = await import('https://appassets.androidplatform.net/assets/native.js');
  if (!services.isAndroid) throw new Error('The app selected its browser fallback');
  return services.native('capabilities');
}

async function nativeDispatchProbe() {
  const services = await import('https://appassets.androidplatform.net/assets/native.js');
  try {
    await services.native('__smokeUnknownAction');
    throw new Error('Unknown native action unexpectedly succeeded');
  } catch (error) {
    if (error.code !== 'UNKNOWN_ACTION') throw error;
    return { code: error.code, message: error.message };
  }
}

function wordsTargetSnapshot() {
  const links = [...document.querySelectorAll('#nav a[href="#words"]')];
  const link = links[0];
  const rect = link?.getBoundingClientRect();
  const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  return {
    linkCount: links.length, rootFrame: window === window.top,
    appRoots: document.querySelectorAll('#app').length,
    loadingNodes: document.querySelectorAll('.loading-screen').length,
    href: location.href,
    rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
    center,
    hitTest: Boolean(center && document.elementFromPoint(center.x, center.y)?.closest('a') === link),
    viewport: {
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      visual: visualViewport ? {
        width: visualViewport.width, height: visualViewport.height,
        offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
        scale: visualViewport.scale,
      } : null,
    },
  };
}

function startLiveLogcat() {
  report.logCaptureStartedAt = new Date().toISOString();
  liveLogPromise = new Promise(resolveLog => {
    liveLogProcess = execFile('adb', ['-e', 'logcat', '-b', 'main', '-b', 'system',
      '-b', 'crash', '-v', 'threadtime'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    (error, stdout, stderr) => resolveLog({ error, stdout, stderr }));
  });
}

async function finishLiveLogcat() {
  if (!liveLogProcess) return;
  liveLogProcess.kill('SIGTERM');
  let logs = await Promise.race([liveLogPromise, delay(5000, null, { ref: false })]);
  if (!logs) {
    liveLogProcess.kill('SIGKILL');
    logs = await Promise.race([liveLogPromise, delay(5000, null, { ref: false })]);
  }
  if (!logs) {
    report.diagnosticsErrors.push({ step: 'live-logcat', message: 'Logcat did not stop cleanly' });
    return;
  }
  await writeFile(join(output, 'logcat-live.txt'), logs.stdout);
  await writeFile(join(output, 'logcat-stderr.txt'), logs.stderr);
  if (report.pid) {
    const appLines = logs.stdout.split('\n').filter(line => line.trim().split(/\s+/)[2] === report.pid);
    await writeFile(join(output, 'app-logcat.txt'), appLines.join('\n') + '\n');
  }
  if (logs.error && !['SIGTERM', 'SIGKILL'].includes(logs.error.signal)) {
    report.diagnosticsErrors.push({ step: 'live-logcat', message: logs.error.message });
  }
  report.logCaptureFinishedAt = new Date().toISOString();
}

async function savePng(name, bytes) {
  assert.ok(bytes.length >= 24 && bytes.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG: ' + name);
  await writeFile(join(output, name), bytes);
  report.images[name] = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function capture(name, args, binary = false) {
  try {
    return await checkpoint('adb:' + name, async () => {
      const result = await adb(args, { encoding: binary ? null : 'utf8', timeout: 20000 });
      if (binary) await savePng(name, result.stdout);
      else await writeFile(join(output, name), result.stdout);
      return result.stdout;
    });
  } catch (error) {
    report.diagnosticsErrors.push({ file: name, message: error.message });
    return null;
  }
}

async function physicalScreenshot(name) {
  const bytes = await capture(name, ['exec-out', 'screencap', '-p'], true);
  assert.ok(bytes, 'Physical screenshot could not be captured: ' + name);
  return bytes;
}

async function passivePhysicalSample(phase, domReadyAt, offsetMs) {
  const label = phase + '-' + offsetMs / 1000 + 's';
  const sample = {
    phase, requestedOffsetMs: offsetMs,
    domReadyAt: new Date(domReadyAt).toISOString(),
    requestedAt: new Date(domReadyAt + offsetMs).toISOString(),
  };
  (report.presentation.passiveSamples ||= []).push(sample);
  // A bounded observation window, not a readiness gate or a redraw request.
  // If an earlier capture runs long, record the actual time instead of adding delay.
  await checkpoint('passive-wait:' + label,
    () => delay(Math.max(0, domReadyAt + offsetMs - Date.now())));
  const startedAt = Date.now();
  sample.captureStartedAt = new Date(startedAt).toISOString();
  sample.actualOffsetMs = startedAt - domReadyAt;
  await physicalScreenshot('physical-' + label + '.png');
  await capture('gfxinfo-' + label + '.txt',
    ['shell', 'dumpsys', 'gfxinfo', packageName, 'framestats']);
  sample.finishedAt = new Date().toISOString();
}

async function rendererScreenshot(name) {
  try {
    await checkpoint('cdp:' + name, async () => {
      const result = await cdp.send('Page.captureScreenshot', {
        format: 'png', fromSurface: true, captureBeyondViewport: false,
      }, 20000);
      await savePng(name, Buffer.from(result.data, 'base64'));
    });
  } catch (error) {
    report.diagnosticsErrors.push({ file: name, message: error.message });
  }
}

function uiNodes(xml) {
  const decode = value => value.replace(/&(quot|apos|amp|lt|gt);/g,
    (_, name) => ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' })[name])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => String.fromCodePoint(
      value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value)));
  return [...xml.matchAll(/<node\b[^>]*>/g)].map(match => {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)]
      .map(item => [item[1], decode(item[2])]));
    const bounds = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(attrs.bounds || '');
    return { attrs, bounds: bounds ? bounds.slice(1).map(Number) : null };
  });
}

function tapTarget(xml, dom, display) {
  const nodes = uiNodes(xml).filter(node => node.attrs.package === packageName
    && node.attrs.enabled !== 'false' && node.attrs['visible-to-user'] !== 'false'
    && node.bounds && node.bounds[0] >= 0 && node.bounds[1] >= 0
    && node.bounds[2] > node.bounds[0] && node.bounds[3] > node.bounds[1]
    && node.bounds[2] <= display.width && node.bounds[3] <= display.height);
  const unique = candidates => [...new Map(candidates.map(node => [node.bounds.join(','), node])).values()];
  const webViews = unique(nodes.filter(node => node.attrs.class === 'android.webkit.WebView'));
  let words = nodes.filter(node => node.attrs.text === 'Words' || node.attrs['content-desc'] === 'Words');
  const clickable = words.filter(node => node.attrs.clickable === 'true');
  words = unique(clickable.length ? clickable : words);
  const inside = (inner, outer) => inner[0] >= outer[0] && inner[1] >= outer[1]
    && inner[2] <= outer[2] && inner[3] <= outer[3];
  if (words.length === 1 && (webViews.length !== 1 || inside(words[0].bounds, webViews[0].bounds))) {
    const [left, top, right, bottom] = words[0].bounds;
    const x = Math.floor((left + right) / 2);
    const y = Math.floor((top + bottom) / 2);
    assert.ok(x >= left && x < right && y >= top && y < bottom);
    return { method: 'native_words_node', attrs: words[0].attrs, bounds: words[0].bounds,
      x, y };
  }
  assert.equal(webViews.length, 1, 'No unique native WebView bounds for the guarded fallback');
  assert.equal(dom.linkCount, 1, 'No unique Words link in the DOM');
  assert.equal(dom.rootFrame, true);
  assert.equal(dom.appRoots, 1);
  assert.equal(dom.loadingNodes, 0);
  assert.equal(dom.hitTest, true, 'Words center is not its active hit target');
  const { width, height, dpr, visual } = dom.viewport;
  assert.ok(width > 0 && height > 0 && dpr > 0 && visual);
  assert.ok(Math.abs(visual.scale - 1) < 0.01
    && Math.abs(visual.offsetLeft) < 1 && Math.abs(visual.offsetTop) < 1
    && Math.abs(visual.width - width) <= 2 && Math.abs(visual.height - height) <= 2,
  'Zoomed or offset viewport is unsuitable for a physical tap');
  const [left, top, right, bottom] = webViews[0].bounds;
  const sx = (right - left) / width;
  const sy = (bottom - top) / height;
  assert.ok(Math.abs(sx / sy - 1) <= 0.02
    && Math.abs(sx / dpr - 1) <= 0.03 && Math.abs(sy / dpr - 1) <= 0.03,
  'Native WebView size, CSS viewport and device scale disagree');
  assert.ok(dom.center.x > 0 && dom.center.x < width && dom.center.y > 0 && dom.center.y < height);
  const x = Math.round(left + dom.center.x * sx);
  const y = Math.round(top + dom.center.y * sy);
  assert.ok(x > left && x < right && y > top && y < bottom
    && x < display.width && y < display.height);
  return { method: 'webview_viewport_mapping', bounds: webViews[0].bounds, sx, sy, x, y };
}

await mkdir(output, { recursive: true });
try {
  assert.equal(typeof WebSocket, 'function', 'Use Node 22+ with its built-in WebSocket enabled');
  const bytes = await readFile(apkPath);
  report.apkSha256 = createHash('sha256').update(bytes).digest('hex');
  const buildType = await readFile(join(dirname(apkPath), 'BUILD-TYPE.txt'), 'utf8');
  assert.match(buildType, /^Disposable debug signing\./,
    'This gate is only for disposable debug APKs; release WebViews disable DevTools');
  await checkpoint('install-apk', () => adb(['install', '-r', apkPath], { timeout: 90000 }));
  // Do not grant RECORD_AUDIO or ask a voice/model service to perform inference.
  // This emulator image's unrelated setup app produced an ANR over the first run.
  // Stop that observed fixture package only; retain all Pocket Korean error checks.
  const setupPackage = 'com.google.android.googlesdksetup';
  await adb(['shell', 'am', 'force-stop', setupPackage]);
  report.emulatorFixture = { forceStoppedPackages: [setupPackage] };
  await adb(['logcat', '-b', 'all', '-c']);
  startLiveLogcat();
  await adb(['shell', 'am', 'force-stop', packageName]);
  const launch = await checkpoint('cold-launch', () => adb(
    ['shell', 'am', 'start', '-W', '-n', packageName + '/.MainActivity'], { timeout: 60000 }));
  report.launch = launch.stdout;
  assert.match(launch.stdout, /Status:\s*ok/, 'Android did not report a successful Activity launch');

  // The API 35 fixture also showed a Pixel Launcher ANR over the running app.
  // Stop only that observed background package, after Pocket Korean is launched.
  const launcherPackage = 'com.google.android.apps.nexuslauncher';
  await checkpoint('stop-background-launcher',
    () => adb(['shell', 'am', 'force-stop', launcherPackage]));
  report.emulatorFixture.forceStoppedPackages.push(launcherPackage);

  const pid = await until('Application process', async () => {
    const result = await adb(['shell', 'pidof', packageName]);
    return result.stdout.trim().split(/\s+/)[0] || null;
  });
  report.pid = pid;
  const forward = await adb(['forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid]);
  forwardedPort = forward.stdout.trim();
  assert.match(forwardedPort, /^\d+$/, 'adb did not return the forwarded DevTools port');

  const target = await until('Bundled WebView page', async () => {
    const response = await fetch('http://127.0.0.1:' + forwardedPort + '/json/list',
      { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const pages = await response.json();
    report.targets = pages.map(page => ({ id: page.id, type: page.type, title: page.title,
      url: page.url, description: page.description }));
    const matching = pages.filter(page => page.type === 'page'
      && (page.url === appUrl || page.url.startsWith(appUrl + '#'))
      && page.webSocketDebuggerUrl);
    assert.ok(matching.length <= 1, 'Multiple matching app WebViews are ambiguous');
    return matching[0];
  });
  report.selectedTarget = { id: target.id, type: target.type, title: target.title,
    url: target.url, description: target.description };
  const endpoint = new URL(target.webSocketDebuggerUrl);
  endpoint.hostname = '127.0.0.1';
  endpoint.port = forwardedPort;
  cdp = await openCdp(endpoint.href);
  await cdp.send('Runtime.enable');
  report.ui = await checkpoint('home-dom-ready', () => until('Home DOM', async () => {
    const state = await evaluate(uiSnapshot);
    report.lastUi = state;
    return state?.heading === 'A little Korean, every day.'
      && state.navigation.length === 5 && state.visible && state.cssLoaded
      && state.bridgePresent && state.appStarted && state.rootFrame
      && state.roots.app === 1 && state.roots.main === 1 && state.roots.nav === 1
      && state.loadingNodes === 0 && state.viewport.width > 0 && state.viewport.height > 0
      ? state : null;
  }));
  assert.equal(report.ui.title, 'Pocket Korean');
  const homeDomReadyAt = Date.now();
  report.presentation.homeDomReadyAt = new Date(homeDomReadyAt).toISOString();

  // Preserve the Android surface before any screenshot request to Chromium,
  // accessibility inspection, or diagnostic input can change presentation.
  await physicalScreenshot('physical-before.png');
  // Observe whether ordinary pending frames reach Android without a CDP PNG.
  await passivePhysicalSample('home', homeDomReadyAt, 5000);
  await passivePhysicalSample('home', homeDomReadyAt, 15000);
  await capture('power-before-input.txt', ['shell', 'dumpsys', 'power']);
  await capture('display-before-input.txt', ['shell', 'dumpsys', 'display']);
  const dispatchStartedAt = Date.now();
  try {
    report.nativeDispatch = await checkpoint('native-unknown-action',
      () => evaluate(nativeDispatchProbe, 10000));
  } catch (error) {
    report.nativeDispatch = { error: error.message };
  }
  report.nativeDispatchRoundTripMs = Date.now() - dispatchStartedAt;
  await capture('gfxinfo-before-cdp.txt', ['shell', 'dumpsys', 'gfxinfo', packageName, 'framestats']);
  await rendererScreenshot('renderer-home.png');
  await physicalScreenshot('physical-after-cdp.png');

  // Java's capabilities deadline is 40s; allow its real success/error response to settle.
  const capabilitiesStartedAt = Date.now();
  report.capabilities = await checkpoint('native-capabilities', () => evaluate(nativeSnapshot, 45000));
  report.capabilitiesRoundTripMs = Date.now() - capabilitiesStartedAt;
  assert.equal(report.capabilities.platform, 'android');
  for (const key of ['speechAvailable', 'onDeviceSpeechAvailable', 'ttsReady',
    'translationReady', 'inkReady']) {
    assert.equal(typeof report.capabilities[key], 'boolean', 'Invalid capability field: ' + key);
  }
  assert.equal(typeof report.capabilities.version, 'string');
  assert.ok(report.capabilities.version.length > 0, 'Native version is missing');

  // Accessibility inspection is deliberately after the initial image pair.
  // It may itself invalidate a WebView, so preserve another physical image afterward.
  let windowXml;
  try {
    await checkpoint('uiautomator-bounds', () => adb(
      ['shell', 'uiautomator', 'dump', '/sdcard/pocket-smoke-window.xml'], { timeout: 20000 }));
    windowXml = await capture('window.xml', ['exec-out', 'cat', '/sdcard/pocket-smoke-window.xml']);
  } catch (error) {
    report.wordsTap = { status: 'skipped', reason: 'Native bounds unavailable: ' + error.message };
  }
  await physicalScreenshot('physical-after-bounds.png');
  if (windowXml) {
    try {
      report.wordsDom = await checkpoint('words-target-dom', () => evaluate(wordsTargetSnapshot));
      report.wordsTap = { status: 'ready', ...tapTarget(windowXml, report.wordsDom,
        report.images['physical-after-bounds.png']) };
    } catch (error) {
      report.wordsTap = { status: 'skipped', reason: 'No safe physical target: ' + error.message };
    }
  } else {
    report.wordsTap ||= { status: 'skipped', reason: 'Native UI hierarchy could not be read' };
  }
  if (report.wordsTap.status === 'ready') {
    await checkpoint('adb-words-tap', () => adb(['shell', 'input', 'tap',
      String(report.wordsTap.x), String(report.wordsTap.y)]));
    report.wordsTap.status = 'sent';
    report.wordsUi = await checkpoint('words-route-dom', () => until('Words route after real tap', async () => {
      const state = await evaluate(uiSnapshot);
      report.lastUi = state;
      return state?.url === appUrl + '#words' && state.heading === 'Your word garden.'
        && state.activeNavigation === 'Words' && state.visible && state.loadingNodes === 0
        ? state : null;
    }));
    report.wordsTap.status = 'route_changed';
    const wordsDomReadyAt = Date.now();
    report.presentation.wordsDomReadyAt = new Date(wordsDomReadyAt).toISOString();
    // Capture the result of actual Android input before asking Chromium for pixels.
    await physicalScreenshot('physical-after-tap.png');
    await capture('gfxinfo-after-tap.txt', ['shell', 'dumpsys', 'gfxinfo', packageName, 'framestats']);
    await passivePhysicalSample('words', wordsDomReadyAt, 3000);
    await passivePhysicalSample('words', wordsDomReadyAt, 10000);
    await rendererScreenshot('renderer-words.png');
  }

  assert.equal(report.nativeDispatch?.code, 'UNKNOWN_ACTION',
    'The cheap native main-thread dispatch probe did not respond correctly');
  assert.deepEqual(cdp.exceptions, [], 'An uncaught JavaScript exception occurred');
  const stillRunning = await adb(['shell', 'pidof', packageName]);
  assert.ok(stillRunning.stdout.trim().split(/\s+/).includes(pid),
    'The application process exited or restarted during the check');
  report.automatedChecks = 'passed';
  report.status = 'pending_visual_review';
} catch (error) {
  report.status = 'failed';
  report.automatedChecks = 'failed';
  report.error = error.stack || String(error);
  console.error(report.error);
} finally {
  report.runtimeExceptions = cdp?.exceptions || [];
  // Capture while the emulator is still running, including on every failed assertion.
  await capture('screen.png', ['exec-out', 'screencap', '-p'], true);
  await capture('logcat.txt', ['logcat', '-b', 'main', '-b', 'system', '-b', 'crash',
    '-d', '-v', 'threadtime']);
  const crashes = await capture('crash.txt', ['logcat', '-b', 'crash', '-d', '-v', 'threadtime']);
  await capture('activity.txt', ['shell', 'dumpsys', 'activity', 'activities']);
  if (crashes && /Process:\s*net\.pocketlab\.korean(?:,|\s)|>>>\s*net\.pocketlab\.korean\s*<<</.test(crashes)) {
    report.status = 'failed';
    report.automatedChecks = 'failed';
    report.error ||= 'Android recorded an application crash; see crash.txt';
  }
  try { await finishLiveLogcat(); }
  catch (error) { report.diagnosticsErrors.push({ step: 'live-logcat', message: error.message }); }
  cdp?.close();
  if (forwardedPort) {
    try { await adb(['forward', '--remove', 'tcp:' + forwardedPort]); }
    catch (error) { report.diagnosticsErrors.push({ step: 'remove-forward', message: error.message }); }
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Android startup smoke: ' + report.status + '. Evidence: ' + output);
  process.exitCode = report.status === 'pending_visual_review' ? 0 : 1;
}
