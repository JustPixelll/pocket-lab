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
  scope: 'Installed debug APK startup, bundled WebView UI and native capabilities roundtrip',
  sourceRunId: process.env.SOURCE_RUN_ID || null,
  sourceHeadSha: process.env.SOURCE_HEAD_SHA || null,
  startedAt: new Date().toISOString(),
  diagnosticsErrors: [],
};
let cdp;
let forwardedPort;

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

async function capture(name, args, binary = false) {
  try {
    const result = await adb(args, { encoding: binary ? null : 'utf8', timeout: 20000 });
    await writeFile(join(output, name), result.stdout);
    return result.stdout;
  } catch (error) {
    report.diagnosticsErrors.push({ file: name, message: error.message });
    return null;
  }
}

await mkdir(output, { recursive: true });
try {
  assert.equal(typeof WebSocket, 'function', 'Use Node 22+ with its built-in WebSocket enabled');
  const bytes = await readFile(apkPath);
  report.apkSha256 = createHash('sha256').update(bytes).digest('hex');
  const buildType = await readFile(join(dirname(apkPath), 'BUILD-TYPE.txt'), 'utf8');
  assert.match(buildType, /^Disposable debug signing\./,
    'This gate is only for disposable debug APKs; release WebViews disable DevTools');
  await adb(['install', '-r', apkPath], { timeout: 90000 });
  // Do not grant RECORD_AUDIO or ask a voice/model service to perform inference.
  // This emulator image's unrelated setup app produced an ANR over the first run.
  // Stop that observed fixture package only; retain all Pocket Korean error checks.
  const setupPackage = 'com.google.android.googlesdksetup';
  await adb(['shell', 'am', 'force-stop', setupPackage]);
  report.emulatorFixture = { forceStoppedPackages: [setupPackage] };
  await adb(['logcat', '-b', 'all', '-c']);
  await adb(['shell', 'am', 'force-stop', packageName]);
  const launch = await adb(['shell', 'am', 'start', '-W', '-n', packageName + '/.MainActivity'],
    { timeout: 60000 });
  report.launch = launch.stdout;
  assert.match(launch.stdout, /Status:\s*ok/, 'Android did not report a successful Activity launch');

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
    return pages.find(page => page.type === 'page'
      && (page.url === appUrl || page.url.startsWith(appUrl + '#'))
      && page.webSocketDebuggerUrl);
  });
  const endpoint = new URL(target.webSocketDebuggerUrl);
  endpoint.hostname = '127.0.0.1';
  endpoint.port = forwardedPort;
  cdp = await openCdp(endpoint.href);
  await cdp.send('Runtime.enable');
  report.ui = await until('Rendered home screen', async () => {
    const state = await evaluate(uiSnapshot);
    report.lastUi = state;
    return state?.heading === 'A little Korean, every day.'
      && state.navigation.length === 5 && state.visible && state.cssLoaded
      && state.bridgePresent && state.appStarted ? state : null;
  });
  assert.equal(report.ui.title, 'Pocket Korean');

  // Java's capabilities deadline is 40s; allow its real success/error response to settle.
  const capabilitiesStartedAt = Date.now();
  report.capabilities = await evaluate(nativeSnapshot, 45000);
  report.capabilitiesRoundTripMs = Date.now() - capabilitiesStartedAt;
  assert.equal(report.capabilities.platform, 'android');
  for (const key of ['speechAvailable', 'onDeviceSpeechAvailable', 'ttsReady',
    'translationReady', 'inkReady']) {
    assert.equal(typeof report.capabilities[key], 'boolean', 'Invalid capability field: ' + key);
  }
  assert.equal(typeof report.capabilities.version, 'string');
  assert.ok(report.capabilities.version.length > 0, 'Native version is missing');

  // A DOM update can precede its presentation on the Android WebView surface.
  // Wait for browser frames, then allow the emulator's compositor a bounded settle.
  report.presentation = await evaluate(async function () {
    await new Promise(resolveFrame => {
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
    });
    return { animationFrames: 2, visible: document.visibilityState === 'visible' };
  }, 15000);
  assert.equal(report.presentation.visible, true, 'The WebView became hidden before painting');
  report.presentation.compositorSettleMs = 3000;
  await delay(report.presentation.compositorSettleMs);
  report.uiBeforeCapture = await evaluate(uiSnapshot);
  assert.deepEqual(report.uiBeforeCapture, report.ui, 'The home screen changed before capture');

  assert.deepEqual(cdp.exceptions, [], 'An uncaught JavaScript exception occurred');
  const stillRunning = await adb(['shell', 'pidof', packageName]);
  assert.ok(stillRunning.stdout.trim().split(/\s+/).includes(pid),
    'The application process exited or restarted during the check');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack || String(error);
  console.error(report.error);
} finally {
  report.runtimeExceptions = cdp?.exceptions || [];
  // Capture while the emulator is still running, including on every failed assertion.
  await capture('screen.png', ['exec-out', 'screencap', '-p'], true);
  await capture('logcat.txt', ['logcat', '-b', 'main', '-b', 'system', '-b', 'crash',
    '-d', '-v', 'threadtime', '-t', '3000']);
  const crashes = await capture('crash.txt', ['logcat', '-b', 'crash', '-d', '-v', 'threadtime']);
  await capture('activity.txt', ['shell', 'dumpsys', 'activity', 'activities']);
  if (crashes && /Process:\s*net\.pocketlab\.korean(?:,|\s)|>>>\s*net\.pocketlab\.korean\s*<<</.test(crashes)) {
    report.status = 'failed';
    report.error ||= 'Android recorded an application crash; see crash.txt';
  }
  cdp?.close();
  if (forwardedPort) {
    try { await adb(['forward', '--remove', 'tcp:' + forwardedPort]); }
    catch (error) { report.diagnosticsErrors.push({ step: 'remove-forward', message: error.message }); }
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Android startup smoke: ' + report.status + '. Evidence: ' + output);
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
