import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as engine from '../app/src/main/assets/engine.js';
import * as curriculum from '../app/src/main/assets/data/curriculum.js';
import * as customization from '../app/src/main/assets/data/customization.js';
import { characterSvg, sceneDecor } from '../app/src/main/assets/characters.js';

// Exercise the actual app's event handlers against the real learning engine.
// DOM layout and native platform behavior are covered separately by browser
// smoke checks and on-device verification; these tests isolate asynchronous
// response ownership and the saved/UI progression contract.
const appSource = (await readFile(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '');
const cloneInput = value => value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function application() {
  const elements = new Map();
  const handlers = new Map();
  const data = new Map();
  const storage = { failWrite: false,
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (this.failWrite) throw new Error('quota exceeded'); data.set(key, value); },
  };
  let nativeHandler = async action => action === 'capabilities'
    ? { platform: 'browser', translationReady: false, inkReady: false } : {};
  function node(selector) {
    if (!elements.has(selector)) {
      let markup = '';
      const listeners = new Map();
      elements.set(selector, {
        id: selector.replace(/^#/, ''), textContent: '', value: '', disabled: false,
        isConnected: true, dataset: {}, classList: { add() {}, remove() {} },
        get innerHTML() { return markup; },
        set innerHTML(value) {
          markup = value;
          if (selector === '#main') {
            if (elements.has('#ink-canvas')) elements.get('#ink-canvas').isConnected = false;
            elements.delete('#ink-canvas');
          }
        },
        addEventListener(type, handler) { const list = listeners.get(type) ?? []; list.push(handler); listeners.set(type, list); },
        emit(type, event) { for (const handler of listeners.get(type) ?? []) handler(event); },
        focus() {}, remove() { this.innerHTML = ''; this.isConnected = false; }, querySelectorAll() { return []; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 320 }),
        getContext: () => ({ scale() {}, clearRect() {}, beginPath() {}, moveTo() {}, arc() {}, fill() {}, lineTo() {}, stroke() {} }),
        setPointerCapture() {},
        get childElementCount() { return this.innerHTML ? 1 : 0; },
      });
    }
    return elements.get(selector);
  }
  const document = {
    activeElement: null, body: { classList: { add() {}, remove() {} } },
    querySelector(selector) {
      if (selector === '.modal' && !node('#modal-root').innerHTML) return null;
      return node(selector);
    },
    addEventListener(type, handler) { const list = handlers.get(type) ?? []; list.push(handler); handlers.set(type, list); },
  };
  const location = { hash: '' };
  let actualStore;
  const bridge = {
    ...engine,
    createStore(adapter, options) {
      actualStore = engine.createStore(adapter, cloneInput(options));
      // Inputs created in the VM have a distinct Object prototype. Converting
      // the test boundary preserves the same-realm contract used by the app.
      return Object.fromEntries(Object.entries(actualStore).map(([key, fn]) => [key, (...args) => fn(...args.map(cloneInput))]));
    },
  };
  const context = vm.createContext({ ...bridge, ...curriculum, ...customization, characterSvg, sceneDecor, document, location,
    history: { replaceState(_a, _b, hash) { location.hash = hash; } },
    window: { addEventListener() {}, scrollTo() {} },
    localStorage: storage, isAndroid: false, icon: () => '',
    native: (action, payload) => nativeHandler(action, payload),
    setTimeout: () => 1, clearTimeout() {}, console,
  });
  vm.runInContext(`${appSource}\n
    globalThis.testApp = {
      action: (name, dataset = {}) => actions[name]({ dataset }),
      getPractice: () => practice,
      getTranslation: () => translation,
      navigate, newPractice, nextQuestion, submitAnswer, listenAnswer, translateText,
      collectTranslation, lessonsWithReadiness, browseVocab, wordForm, saveWord,
      checkWriting, showSettings, prepareModel, getWriting: () => writing,
      getLessonRun: () => lessonRun,
    };`, context);
  return { ...context.testApp, storage, node,
    get store() { return actualStore; },
    native: fn => { nativeHandler = fn; },
    input(selector, value) {
      const target = node(selector); target.value = value;
      for (const handler of handlers.get('input') ?? []) handler({ target });
    },
    pointer(type, x = 20, y = 30) {
      node('#ink-canvas').emit(type, { isPrimary: true, pointerId: 1, clientX: x, clientY: y, preventDefault() {} });
    },
    dispatch(type, target) {
      const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      for (const handler of handlers.get(type) ?? []) handler(event);
      return event;
    },
  };
}

test('app initializes its real store and typed submission saves matching UI progress', async () => {
  const app = application();
  assert.ok(app.node('#main').innerHTML.includes('A little Korean, every day.'));
  assert.equal(app.store.getCards().length, 12);
  assert.ok(app.store.getCards().every(card => card.status === 'new'));
  app.action('practice-word', { id: 'thanks' });
  app.action('input-mode', { mode: 'typed' });
  app.input('#practice-answer', '감사합니다');
  app.submitAnswer();
  assert.equal(app.store.getCard('thanks').progress.enToKo.correct, 1);
  assert.equal(app.store.getCard('thanks').color, 'yellow');
  assert.equal(app.getPractice().correct, 1);
  assert.equal(app.getPractice().count, 1);
  const event = JSON.parse(app.store.exportData()).history[0];
  assert.equal(event.mode, 'typed');
  assert.equal(event.answer, '감사합니다');
  app.action('word-detail', { id: 'thanks' });
  assert.ok(app.node('#modal-root').innerHTML.includes('1 correct · 1 attempts'));
});

test('app does not announce or count a review when persistence fails', () => {
  const app = application();
  app.action('practice-word', { id: 'thanks' });
  app.action('input-mode', { mode: 'typed' });
  app.input('#practice-answer', '감사합니다');
  app.storage.failWrite = true;
  app.submitAnswer();
  assert.equal(app.getPractice().answered, false);
  assert.equal(app.getPractice().count, 0);
  assert.equal(app.store.getCard('thanks').status, 'new');
  assert.ok(app.node('#toast').textContent.includes('could not be saved'));
});

test('failed speech services do not create failed vocabulary reviews', async () => {
  const app = application();
  app.action('practice-word', { id: 'thanks' });
  app.native(async action => { if (action === 'listen') throw Object.assign(new Error('No speech detected'), { code: 'NO_MATCH' }); return {}; });
  await app.listenAnswer();
  assert.equal(app.store.getStats().today.attempts, 0);
  assert.equal(app.getPractice().listening, false);
  assert.equal(app.getPractice().answered, false);
});

test('a delayed speech response cannot replace an answer after switching to typing', async () => {
  const app = application();
  const speech = deferred();
  app.action('practice-word', { id: 'thanks' });
  app.native(async action => action === 'listen' ? speech.promise : {});
  const listening = app.listenAnswer();
  app.action('input-mode', { mode: 'typed' });
  app.input('#practice-answer', '고맙습니다');
  speech.resolve({ text: 'unrelated old transcript', alternatives: ['unrelated old transcript'] });
  await listening;
  assert.equal(app.getPractice().answer, '고맙습니다');
  assert.equal(app.store.getStats().today.attempts, 0);
});

test('a delayed speech response cannot attach itself to a replacement practice round', async () => {
  const app = application();
  const speech = deferred();
  app.action('practice-word', { id: 'thanks' });
  app.native(async action => action === 'listen' ? speech.promise : {});
  const listening = app.listenAnswer();
  app.action('restart-practice');
  const replacement = app.getPractice();
  speech.resolve({ text: '감사합니다', alternatives: ['감사합니다'] });
  await listening;
  assert.equal(app.getPractice(), replacement);
  assert.equal(app.getPractice().answer, '');
  assert.equal(app.store.getStats().today.attempts, 0);
});

test('editing translator input cannot silently pair it with an old translation', async () => {
  const app = application();
  app.navigate('translate');
  app.native(async action => action === 'translate' ? { text: '학교' } : {});
  app.input('#translation-input', 'school');
  await app.translateText();
  app.input('#translation-input', 'water');
  await app.collectTranslation(false);
  // Either invalidate the old output, or retain its original source pair.
  // A form that offers 학교 as "water" would corrupt the vocabulary list.
  assert.ok(!app.node('#modal-root').innerHTML.includes('value="water"'));
});

test('custom IDs for curated vocabulary do not trap curriculum prerequisites or practice', () => {
  const app = application();
  const custom = app.store.addCard({ id: 'custom-key', ko: '열쇠', en: 'key', source: 'machine' });
  assert.equal(app.store.getCard('key'), null);
  app.action('prepare-lesson-words', { id: 'find-the-cafe' });
  assert.ok(app.getPractice().queue.some(item => item.id === custom.id));
  assert.ok(app.getPractice().queue.every(item => app.store.getCard(item.id)));
  assert.equal(app.store.getCard('key'), null);
  app.store.recordAttempt(custom.id, 'enToKo', { correct: true, answer: '열쇠', mode: 'typed' });
  const lesson = app.lessonsWithReadiness().find(item => item.id === 'find-the-cafe');
  assert.ok(!lesson.missingVocabIds.includes('key'));
  app.browseVocab();
  assert.match(app.node('#modal-root').innerHTML, /data-id="key"\s+disabled/u);
});

test('machine-translation form saves provenance and leaves an unverified hint empty', () => {
  const app = application();
  app.wordForm({ ko: '학교', en: 'school', machineTranslated: true, note: 'Check meaning in context.' });
  const source = app.node('#modal-root').innerHTML.match(/data-source="([^"]+)"/u)?.[1];
  const form = app.node('#word-form');
  form.dataset = { editId: '', source };
  app.node('#new-ko').value = '학교';
  app.node('#new-en').value = 'school';
  app.node('#new-aliases').value = '';
  app.node('#new-pronunciation').value = '';
  app.node('#new-note').value = 'Check meaning in context.';
  const card = app.saveWord({ target: form, preventDefault() {} });
  assert.ok(card);
  assert.equal(card.source, 'machine');
  assert.deepEqual(card.sourceIds, ['google-translate']);
  assert.equal(card.pronunciation, '');
  assert.equal(card.status, 'new');
});

test('modal form clicks preserve default submission while direct backdrop clicks still close', () => {
  const app = application();
  app.wordForm();
  const form = app.node('#word-form'); form.dataset = { editId: '', source: 'custom' };
  app.node('#new-ko').value = '강아지';
  app.node('#new-en').value = 'puppy';
  app.node('#new-aliases').value = '';
  app.node('#new-pronunciation').value = '';
  app.node('#new-note').value = '';
  const backdrop = { dataset: { action: 'close-backdrop' }, closest() { return this; } };
  const submitButton = { type: 'submit', closest: () => backdrop };

  const click = app.dispatch('click', submitButton);
  assert.equal(click.defaultPrevented, false, 'The backdrop delegate must allow the button default action.');
  assert.ok(app.node('#modal-root').childElementCount > 0, 'Clicking inside the dialog must keep it open.');
  // A real browser follows this uncancelled activation with the form submit.
  app.dispatch('submit', form);
  assert.ok(app.store.getCards().some(card => card.ko === '강아지' && card.en === 'puppy'));
  assert.equal(app.node('#modal-root').childElementCount, 0);

  app.wordForm();
  app.dispatch('click', backdrop);
  assert.equal(app.node('#modal-root').childElementCount, 0, 'Clicking the backdrop itself still closes the dialog.');
});

test('handwriting feedback still applies when the recognized drawing is unchanged', async () => {
  const app = application();
  app.navigate('write');
  app.pointer('pointerdown'); app.pointer('pointerup', 60, 60);
  app.native(async action => action === 'recognizeInk' ? { candidates: ['가'] } : {});
  const button = app.node('#recognize-button');
  await app.checkWriting(button);
  assert.ok(app.getWriting().feedback.includes('Your writing was recognized.'));
  assert.equal(button.disabled, false);
});

test('clearing, undoing, drawing, or returning to a target invalidates old handwriting results', async () => {
  for (const mutation of ['clear', 'undo', 'draw', 'target', 'group']) {
    const app = application();
    const recognition = deferred();
    app.navigate('write');
    app.pointer('pointerdown'); app.pointer('pointerup', 60, 60);
    app.native(async action => action === 'recognizeInk' ? recognition.promise : {});
    const pending = app.checkWriting(app.node('#recognize-button'));
    if (mutation === 'clear') app.action('clear-writing');
    if (mutation === 'undo') app.action('undo-stroke');
    if (mutation === 'draw') { app.pointer('pointerdown', 80, 80); app.pointer('pointermove', 90, 90); app.pointer('pointerup', 95, 95); }
    if (mutation === 'target') { app.action('writing-target', { target: '나' }); app.action('writing-target', { target: '가' }); }
    if (mutation === 'group') { app.action('writing-group', { group: 'vowels' }); app.action('writing-group', { group: 'syllables' }); }
    recognition.resolve({ candidates: ['가'] });
    await pending;
    assert.equal(app.getWriting().feedback, '', mutation);
    assert.equal(app.getWriting().candidates.length, 0, mutation);
  }
});

test('model preparation preserves a newer word form instead of opening settings', async () => {
  for (const origin of ['settings', 'page']) {
    const app = application();
    const download = deferred();
    app.navigate('translate');
    if (origin === 'settings') app.showSettings();
    app.native(async action => action === 'prepareModels' ? download.promise
      : { translationReady: true, inkReady: true });
    const pending = app.prepareModel('all', app.node('#prepare-button'));
    app.wordForm({ ko: '학교', en: 'school' });
    const formMarkup = app.node('#modal-root').innerHTML;
    app.node('#new-en').value = 'school, edited while downloading';
    download.resolve({});
    await pending;
    assert.equal(app.node('#modal-root').innerHTML, formMarkup, origin);
    assert.equal(app.node('#new-en').value, 'school, edited while downloading', origin);
  }
});

test('model preparation refreshes its original settings modal when it remains open', async () => {
  const app = application();
  app.showSettings();
  assert.ok(app.node('#modal-root').innerHTML.includes('Download needed'));
  app.native(async action => action === 'prepareModels' ? {} : { translationReady: true, inkReady: true });
  await app.prepareModel('all', app.node('#prepare-button'));
  assert.ok(!app.node('#modal-root').innerHTML.includes('Download needed'));
  assert.ok(app.node('#modal-root').innerHTML.includes('>Ready</span>'));
});

test('quest audio plays Korean without choosing or grading an answer', async () => {
  const app = application();
  const calls = [];
  app.native(async (action, payload) => { calls.push({ action, payload }); return {}; });
  app.action('start-lesson', { id: 'first-hello' });
  app.action('lesson-next');
  app.action('lesson-choice', { index: '1' });
  const choice = app.getLessonRun().choice;
  const history = app.store.exportData();
  await app.action('play-korean', { text: '감사합니다.' });
  assert.equal(app.getLessonRun().choice, choice);
  assert.equal(app.getLessonRun().index, 0);
  assert.equal(app.getLessonRun().feedback, null);
  assert.equal(app.store.exportData(), history);
  const spoken = calls.find(call => call.action === 'speak');
  assert.equal(spoken.payload.text, '감사합니다.');
  assert.equal(spoken.payload.lang, 'ko-KR');
});

test('finishing a quest awards once and the character shop uses those saved coins', () => {
  const app = application();
  const quest = curriculum.LESSONS.find(item => item.id === 'first-hello');
  function finish() {
    app.action('start-lesson', { id: quest.id });
    app.action('lesson-next');
    for (const challenge of quest.challenges) {
      if (challenge.type === 'choose') app.action('lesson-choice', { index: String(challenge.options.indexOf(challenge.answer)) });
      else for (const token of challenge.answer.split(' ')) app.action('add-token', { index: String(challenge.options.indexOf(token)) });
      app.action('check-lesson');
      assert.equal(app.getLessonRun().feedback.correct, true);
      app.action('lesson-next');
    }
    app.action('finish-lesson');
  }
  finish();
  assert.equal(app.store.getProfile().coins, 20);
  finish();
  assert.equal(app.store.getProfile().coins, 20);
  app.action('home-section', { section: 'shop' });
  app.action('buy-item', { id: 'hat-beanie' });
  assert.equal(app.store.getProfile().coins, 0);
  assert.equal(app.store.getProfile().equipment.hat, 'hat-beanie');
  app.action('buy-item', { id: 'hat-beanie' });
  assert.equal(app.store.getProfile().totalSpent, 20);
  assert.ok(app.node('#main').innerHTML.includes('Wearing'));
});

test('failed cosmetic persistence leaves the character and its coins unchanged', () => {
  const app = application();
  app.store.completeLesson('first-hello');
  app.action('home-section', { section: 'shop' });
  const before = app.store.getProfile();
  app.storage.failWrite = true;
  app.action('buy-item', { id: 'hat-beanie' });
  assert.deepEqual(app.store.getProfile(), before);
  assert.ok(app.node('#toast').textContent.includes('could not be saved'));
});

test('handwriting service errors stay visible and preserve the actual strokes', async () => {
  const app = application();
  app.navigate('write');
  app.pointer('pointerdown', 15, 25);
  app.pointer('pointermove', 85, 25);
  app.pointer('pointerup', 85, 90);
  const drawing = JSON.stringify(app.getWriting().strokes);
  app.native(async action => {
    if (action === 'recognizeInk') { const error = new Error('Prepare the Korean handwriting model.'); error.code = 'INK_RECOGNITION_FAILED'; throw error; }
    return {};
  });
  await app.checkWriting(app.node('#check-writing'));
  assert.equal(JSON.stringify(app.getWriting().strokes), drawing);
  assert.ok(app.getWriting().feedback.includes('The handwriting service needs attention.'));
  assert.ok(app.getWriting().feedback.includes('Prepare handwriting model'));
  assert.ok(!app.getWriting().feedback.includes('Here’s what your phone could read.'));
});
