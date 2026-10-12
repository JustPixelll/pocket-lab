const pending = new Map();
let serial = 0;
export const isAndroid = typeof window.PocketNative?.request === 'function';

export class ServiceError extends Error {
  constructor(code, message) { super(message); this.name = 'ServiceError'; this.code = code; }
}

window.__pocketNativeResult = result => {
  const task = pending.get(result.id);
  if (!task) return;
  clearTimeout(task.timer);
  pending.delete(result.id);
  if (result.ok) task.resolve(result.data ?? {});
  else {
    const error = result.error || {};
    task.reject(new ServiceError(error.code || 'SERVICE_ERROR', error.message || String(error)));
  }
};

window.__pocketNativeEvent = event => window.dispatchEvent(new CustomEvent('pocket-service', { detail: event }));

export async function native(action, payload = {}) {
  if (!isAndroid) return browserService(action, payload);
  return new Promise((resolve, reject) => {
    const id = `pocket-${Date.now()}-${++serial}`;
    const timeout = ['importBackup', 'exportBackup', 'prepareModels'].includes(action) ? 300000 : 45000;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new ServiceError('TIMEOUT', 'This took longer than expected. Please try again.'));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    try { window.PocketNative.request(JSON.stringify({ id, action, payload })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(new ServiceError('BRIDGE_ERROR', error.message)); }
  });
}

async function browserService(action, payload) {
  if (action === 'capabilities') return { platform: 'browser', speechAvailable: false, onDeviceSpeechAvailable: false, ttsReady: !!window.speechSynthesis, translationReady: false, inkReady: false, version: 'browser preview' };
  if (action === 'stopListening' || action === 'stopSpeaking') { window.speechSynthesis?.cancel(); return {}; }
  if (action === 'speak') {
    if (!window.speechSynthesis) throw new ServiceError('TTS_UNAVAILABLE', 'Audio is available in the Android app when a Korean voice is installed.');
    const utterance = new SpeechSynthesisUtterance(payload.text);
    const language = payload.lang || 'ko-KR';
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    if (!voice) throw new ServiceError('TTS_LANGUAGE_MISSING', `Install a ${language.startsWith('ko') ? 'Korean' : 'English'} voice to play this audio.`);
    utterance.lang = language; utterance.voice = voice; utterance.rate = payload.rate || 0.9;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    return { started: true };
  }
  if (action === 'exportBackup') {
    const blob = new Blob([payload.content], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = href; a.download = payload.name || 'pocket-korean-backup.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
    return { saved: true };
  }
  if (action === 'importBackup') return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.oncancel = () => reject(new ServiceError('CANCELLED', 'Import cancelled.'));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new ServiceError('CANCELLED', 'Import cancelled.'));
      if (file.size > 4 * 1024 * 1024) return reject(new ServiceError('FILE_TOO_LARGE', 'Please choose a backup smaller than 4 MB.'));
      resolve({ content: await file.text() });
    };
    input.click();
  });
  throw new ServiceError('ANDROID_REQUIRED', 'Open the installed Android app to use this feature. You can explore the notebook and use typed practice in this browser preview.');
}
