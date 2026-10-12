import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore, evaluateAnswer, getCardStatus, normalizeKorean,
  DAY_MS, CREDIT_GAP_MS, RETRY_DELAY_MS, StorageError, ValidationError,
} from '../app/src/main/assets/engine.js';

const START = Date.UTC(2026, 9, 12, 12);
const sleep = { id: 'sleep', ko: '자다', en: 'to sleep', pronunciation: '자다',
  acceptedEn: ['sleep'], partOfSpeech: 'verb', starter: true, tags: ['daily'],
  note: 'Dictionary form.', example: { ko: '저는 자요.', en: 'I sleep.' } };
const thanks = { id: 'thanks', ko: '감사합니다', en: 'thank you', pronunciation: '감사함니다',
  acceptedKo: ['고맙습니다'], acceptedEn: ['thanks'], partOfSpeech: 'phrase', starter: true };
const apple = { id: 'apple', ko: '사과', en: 'apple', partOfSpeech: 'noun', starter: true };

class MemoryStorage {
  constructor() { this.data = new Map(); this.failRead = false; this.failWrite = false; this.writes = 0; }
  getItem(key) { if (this.failRead) throw new Error('read unavailable'); return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.failWrite) throw new Error('quota exceeded'); this.writes += 1; this.data.set(key, value); }
}

function harness({ seed = [sleep, thanks], storage = new MemoryStorage(), name = 'test', random = () => 0.5, timeZone = 'UTC' } = {}) {
  let time = START;
  let id = 0;
  const options = { seed, now: () => time, random, timeZone, idFactory: (prefix) => `${name}-${prefix}-${++id}` };
  const store = createStore(storage, options);
  return { store, storage, options, setTime: (value) => { time = value; }, advance: (value) => { time += value; },
    review: (cardId, direction, correct = true, extra = {}) => store.recordAttempt(cardId, direction, { correct, ...extra }) };
}

function master(h, id = 'sleep') {
  for (const offset of [0, DAY_MS, 4 * DAY_MS]) {
    h.setTime(START + offset);
    for (const direction of ['enToKo', 'koToEn']) h.review(id, direction);
  }
  assert.equal(h.store.getCard(id).status, 'mastered');
}

function seededRandom(seed = 42) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

test('only starter vocabulary is seeded, and it is seeded once', () => {
  const h = harness({ seed: [sleep, { ...thanks, starter: false }] });
  assert.deepEqual(h.store.getCards().map((card) => card.id), ['sleep']);
  const reopened = createStore(h.storage, { ...h.options, seed: [sleep, thanks] });
  assert.deepEqual(reopened.getCards().map((card) => card.id), ['sleep']);
  const empty = harness({ seed: [] });
  assert.equal(createStore(empty.storage, { ...empty.options, seed: [sleep] }).getCards().length, 0);
});

test('new cards are black and preserve vocabulary details without romanization', () => {
  const h = harness();
  const card = h.store.getCard('sleep');
  assert.equal(card.status, 'new');
  assert.equal(card.color, 'black');
  assert.equal(card.example.ko, '저는 자요.');
  assert.deepEqual(card.tags, ['daily']);
  assert.throws(() => h.store.addCard({ ko: 'jada', en: 'sleep' }), ValidationError);
  assert.throws(() => h.store.addCard({ ko: '잠', en: 'sleep', pronunciation: 'jam' }), ValidationError);
});

test('returned copies cannot mutate saved progress or settings', () => {
  const h = harness();
  const cards = h.store.getCards();
  cards[0].progress.enToKo.stage = 99;
  cards[0].acceptedEn.push('invented');
  h.store.getSettings().dailyGoal = 999;
  assert.equal(h.store.getCard('sleep').progress.enToKo.stage, 0);
  assert.deepEqual(h.store.getCard('sleep').acceptedEn, ['sleep']);
  assert.equal(h.store.getSettings().dailyGoal, 10);
});

test('duplicate vocabulary is reused, while a different sense can be separate', () => {
  const h = harness();
  assert.equal(h.store.addCard({ ko: '자다', en: 'TO SLEEP' }).id, 'sleep');
  assert.equal(h.store.getCards().length, 2);
  h.store.addCard({ ko: '배', en: 'pear' });
  h.store.addCard({ ko: '배', en: 'boat' });
  assert.equal(h.store.getCards().length, 4);
  assert.throws(() => h.store.addCard({ ...apple, id: 'sleep' }), ValidationError);
});

test('translation corrections preserve history and are not undone by old backups', () => {
  const h = harness();
  h.review('sleep', 'enToKo');
  const before = h.store.getCard('sleep').progress;
  const old = h.store.exportData();
  const updated = h.store.updateCard('sleep', { en: 'sleep', acceptedEn: [], note: 'Corrected description.' });
  assert.deepEqual(updated.progress, before);
  assert.equal(updated.en, 'sleep');
  h.store.importData(old);
  assert.equal(h.store.getCard('sleep').en, 'sleep');
  assert.deepEqual(h.store.getCard('sleep').acceptedEn, []);
  assert.equal(h.store.getCard('sleep').note, 'Corrected description.');
  assert.deepEqual(h.store.getCard('sleep').progress, before);
});

test('descriptive updates preserve provenance and reject changes of Korean identity', () => {
  const h = harness();
  const updated = h.store.updateCard('thanks', {
    pronunciation: '감사함니다', source: 'curated', sourceIds: ['dictionary'],
    politeForm: '감사합니다', pronunciationVariants: ['감사함니다'],
  });
  assert.deepEqual(updated.sourceIds, ['dictionary']);
  assert.equal(updated.politeForm, '감사합니다');
  assert.deepEqual(updated.pronunciationVariants, ['감사함니다']);
  const before = h.store.exportData();
  assert.throws(() => h.store.updateCard('thanks', { ko: '안녕하세요' }), ValidationError);
  assert.throws(() => h.store.updateCard('thanks', { status: 'mastered' }), ValidationError);
  assert.equal(h.store.exportData(), before);
  h.storage.failWrite = true;
  assert.throws(() => h.store.updateCard('thanks', { en: 'thanks' }), StorageError);
  assert.equal(h.store.exportData(), before);
});

test('custom and machine-translated words do not invent pronunciation hints', () => {
  const h = harness();
  const word = h.store.addCard({ ko: '학교', en: 'school', source: 'machine', sourceIds: ['google-translate'] });
  assert.equal(word.pronunciation, '');
  assert.equal(word.source, 'machine');
  assert.deepEqual(word.sourceIds, ['google-translate']);
  const reopened = createStore(h.storage, h.options);
  assert.equal(reopened.getCard(word.id).pronunciation, '');
  assert.equal(h.store.updateCard('thanks', { pronunciation: '' }).pronunciation, '');
});

test('Korean recall tolerates normalized Hangul, spacing, and final punctuation', () => {
  assert.equal(evaluateAnswer(thanks, 'enToKo', '  감사 합니다! ').correct, true);
  assert.equal(evaluateAnswer(thanks, 'enToKo', '감사합니다'.normalize('NFD')).correct, true);
  assert.equal(evaluateAnswer(thanks, 'enToKo', '고맙습니다.').correct, true);
  assert.equal(normalizeKorean('한국 어.'), '한국어');
  assert.equal(evaluateAnswer(thanks, 'enToKo', '감사합니다!').expected, '감사합니다');
});

test('matching is conservative about meanings, spelling, and romanized input', () => {
  assert.equal(evaluateAnswer(thanks, 'enToKo', 'gamsahamnida').correct, false);
  assert.equal(evaluateAnswer(thanks, 'enToKo', '감시합니다').correct, false);
  assert.equal(evaluateAnswer(thanks, 'enToKo', '안녕하세요').correct, false);
  assert.equal(evaluateAnswer(thanks, 'koToEn', '  THANKS! ').correct, true);
  assert.equal(evaluateAnswer(thanks, 'koToEn', 'grateful').correct, false);
  assert.equal(evaluateAnswer(apple, 'koToEn', 'apples').correct, false);
  assert.equal(evaluateAnswer(apple, 'koToEn', 'aple').correct, false);
  assert.equal(evaluateAnswer(sleep, 'enToKo', '').correct, false);
});

test('English article and infinitive variations depend on known word class', () => {
  assert.equal(evaluateAnswer(apple, 'koToEn', 'an apple').correct, true);
  assert.equal(evaluateAnswer({ ...sleep, acceptedEn: [] }, 'koToEn', 'sleep').correct, true);
  assert.equal(evaluateAnswer({ ...sleep, en: 'to school', partOfSpeech: 'phrase', acceptedEn: [] }, 'koToEn', 'school').correct, false);
  assert.equal(evaluateAnswer({ ...apple, en: 'a lot', partOfSpeech: 'phrase' }, 'koToEn', 'lot').correct, false);
});

test('empty or missing speech transcripts are not recorded as failed attempts', () => {
  const h = harness();
  const before = h.store.exportData();
  assert.throws(() => h.review('sleep', 'enToKo', false, { answer: '   ', mode: 'voice' }), ValidationError);
  assert.throws(() => h.review('sleep', 'enToKo', false, { answer: '...', mode: 'voice' }), ValidationError);
  assert.equal(h.store.exportData(), before);
});

test('an incorrect supplied answer cannot accidentally be recorded as correct', () => {
  const h = harness();
  const result = h.review('sleep', 'enToKo', true, { answer: '먹다', mode: 'voice' });
  assert.equal(result.correct, false);
  assert.equal(result.credited, false);
  assert.equal(result.card.progress.enToKo.correct, 0);
  assert.equal(result.card.status, 'learning');
});

test('both directions have independent progress', () => {
  const h = harness();
  h.review('sleep', 'enToKo', true, { answer: '자다' });
  const progress = h.store.getCard('sleep').progress;
  assert.equal(progress.enToKo.stage, 1);
  assert.equal(progress.enToKo.attempts, 1);
  assert.equal(progress.koToEn.stage, 0);
  assert.equal(progress.koToEn.attempts, 0);
  assert.equal(h.store.getCard('sleep').color, 'yellow');
});

test('rapid repeated successes cannot manufacture mastery or postpone a due date', () => {
  const h = harness();
  h.review('sleep', 'enToKo');
  const firstDue = h.store.getCard('sleep').progress.enToKo.dueAt;
  for (let i = 0; i < 60; i += 1) {
    h.review('sleep', 'enToKo');
    h.review('sleep', 'koToEn');
  }
  const card = h.store.getCard('sleep');
  assert.equal(card.progress.enToKo.stage, 1);
  assert.equal(card.progress.koToEn.stage, 1);
  assert.equal(card.progress.enToKo.dueAt, firstDue);
  assert.equal(card.status, 'learning');
  assert.equal(h.store.getStats().today.attempts, 121);
});

test('a new progression credit requires twenty elapsed hours', () => {
  const h = harness();
  h.review('sleep', 'enToKo');
  h.setTime(START + CREDIT_GAP_MS - 1);
  assert.equal(h.review('sleep', 'enToKo').credited, false);
  h.setTime(START + CREDIT_GAP_MS);
  assert.equal(h.review('sleep', 'enToKo').credited, true);
  assert.equal(h.store.getCard('sleep').progress.enToKo.stage, 2);
});

test('waiting alone never grants mastery, even after three rapid daily successes', () => {
  const h = harness();
  for (const offset of [0, DAY_MS, 2 * DAY_MS]) {
    h.setTime(START + offset);
    h.review('sleep', 'enToKo');
    h.review('sleep', 'koToEn');
  }
  assert.equal(h.store.getCard('sleep').progress.enToKo.stage, 3);
  h.setTime(START + 100 * DAY_MS);
  assert.equal(h.store.getCard('sleep').status, 'learning');
});

test('mastery requires successful reviews spanning four days in both directions', () => {
  const h = harness();
  master(h);
  assert.equal(h.store.getCard('sleep').color, 'green');
  const oneDirection = harness();
  for (const offset of [0, DAY_MS, 4 * DAY_MS]) {
    oneDirection.setTime(START + offset);
    oneDirection.review('sleep', 'enToKo');
  }
  assert.equal(oneDirection.store.getCard('sleep').status, 'learning');
});

test('a lapse demotes mastery and schedules a short retry without damaging the other direction', () => {
  const h = harness();
  master(h);
  const previousKo = h.store.getCard('sleep').progress.koToEn;
  h.advance(1000);
  h.review('sleep', 'enToKo', false);
  const card = h.store.getCard('sleep');
  assert.equal(card.color, 'yellow');
  assert.equal(card.progress.enToKo.stage, 1);
  assert.equal(card.progress.enToKo.dueAt, START + 4 * DAY_MS + 1000 + RETRY_DELAY_MS);
  assert.deepEqual(card.progress.koToEn, previousKo);
  h.advance(1000);
  h.review('sleep', 'enToKo', true);
  assert.equal(h.store.getCard('sleep').status, 'learning');
});

test('assisted answers count as learning activity, never independent recall', () => {
  const h = harness();
  const result = h.review('sleep', 'enToKo', true, { assisted: true, answer: '자다' });
  assert.equal(result.correct, false);
  assert.equal(result.credited, false);
  assert.equal(result.card.progress.enToKo.assisted, 1);
  assert.equal(result.card.progress.enToKo.stage, 0);
  assert.equal(h.store.getStats().today.attempts, 1);
  assert.equal(h.store.getStats().today.correct, 0);
});

test('missed cards are sampled more often and mastered cards still receive occasional practice', () => {
  const h = harness({ seed: [sleep, thanks], random: seededRandom() });
  master(h, 'sleep');
  h.review('thanks', 'enToKo', false);
  h.store.addCard(apple);
  h.advance(RETRY_DELAY_MS + 1000);
  const counts = { sleep: 0, thanks: 0, apple: 0 };
  for (let i = 0; i < 15000; i += 1) counts[h.store.selectNext({ direction: 'enToKo' }).card.id] += 1;
  assert.ok(counts.thanks > counts.apple * 1.5, JSON.stringify(counts));
  assert.ok(counts.apple > counts.sleep * 10, JSON.stringify(counts));
  assert.ok(counts.sleep > 0, JSON.stringify(counts));
});

test('mixed selection favors a less-practiced direction without excluding either direction', () => {
  const h = harness({ seed: [sleep], random: seededRandom() });
  for (const offset of [0, DAY_MS, 4 * DAY_MS]) {
    h.setTime(START + offset);
    h.review('sleep', 'enToKo');
  }
  const counts = { enToKo: 0, koToEn: 0 };
  for (let i = 0; i < 5000; i += 1) counts[h.store.selectNext().direction] += 1;
  assert.ok(counts.koToEn > counts.enToKo * 10);
  assert.ok(counts.enToKo > 0);
});

test('selection suppresses immediate repeats when another card is available', () => {
  const h = harness({ random: seededRandom() });
  for (let i = 0; i < 100; i += 1) assert.equal(h.store.selectNext({ lastCardId: 'sleep' }).card.id, 'thanks');
  const single = harness({ seed: [sleep] });
  assert.equal(single.store.selectNext({ lastCardId: 'sleep' }).card.id, 'sleep');
  assert.equal(harness({ seed: [] }).store.selectNext(), null);
});

test('progress, lessons and settings survive reopening', () => {
  const h = harness();
  master(h);
  h.store.completeLesson('hello-lesson');
  h.store.setSettings({ dailyGoal: 20, customPreference: 'yes' });
  const reopened = createStore(h.storage, h.options);
  assert.deepEqual(reopened.getCard('sleep'), h.store.getCard('sleep'));
  assert.deepEqual(reopened.getLessonProgress(), h.store.getLessonProgress());
  assert.equal(reopened.getSettings().dailyGoal, 20);
  assert.equal(reopened.getSettings().customPreference, 'yes');
});

test('failed review writes retain both the previous in-memory and persisted state', () => {
  const h = harness();
  h.review('sleep', 'enToKo');
  const before = h.store.exportData();
  const rawBefore = h.storage.getItem('pocketLabKorean.v1');
  h.storage.failWrite = true;
  assert.throws(() => h.review('sleep', 'enToKo', false), StorageError);
  assert.equal(h.store.exportData(), before);
  assert.equal(h.storage.getItem('pocketLabKorean.v1'), rawBefore);
  h.storage.failWrite = false;
  h.review('sleep', 'enToKo', false);
  assert.equal(h.store.getCard('sleep').progress.enToKo.attempts, 2);
});

test('failed add, lesson and settings writes are also atomic', () => {
  const h = harness();
  const before = h.store.exportData();
  h.storage.failWrite = true;
  assert.throws(() => h.store.addCard(apple), StorageError);
  assert.throws(() => h.store.completeLesson('intro'), StorageError);
  assert.throws(() => h.store.setSettings({ dailyGoal: 30 }), StorageError);
  assert.equal(h.store.exportData(), before);
});

test('corrupted or unreadable storage is never replaced with a fresh seed', () => {
  const storage = new MemoryStorage();
  storage.setItem('pocketLabKorean.v1', '{ broken');
  const writes = storage.writes;
  assert.throws(() => createStore(storage, { seed: [sleep] }), ValidationError);
  assert.equal(storage.getItem('pocketLabKorean.v1'), '{ broken');
  assert.equal(storage.writes, writes);
  storage.failRead = true;
  assert.throws(() => createStore(storage, { seed: [sleep] }), StorageError);
  assert.equal(storage.writes, writes);
});

test('backup restore derives progression from events instead of trusting edited colors or stages', () => {
  const h = harness();
  const backup = JSON.parse(h.store.exportData());
  for (const direction of ['enToKo', 'koToEn']) backup.cards[0].progress[direction] = {
    attempts: 100, stage: 5, firstCreditAt: START, lastCreditAt: START + 10 * DAY_MS,
  };
  backup.cards[0].color = 'green';
  backup.lessonProgress = { forged: { completed: true } };
  const restored = harness({ seed: [], name: 'restore' });
  restored.store.importData(backup);
  assert.equal(restored.store.getCard('sleep').status, 'new');
  assert.deepEqual(restored.store.getLessonProgress(), {});
});

test('stale imports preserve newer lapses and repeated imports do not double-count history', () => {
  const h = harness();
  master(h);
  h.store.completeLesson('intro');
  const oldBackup = h.store.exportData();
  h.advance(DAY_MS);
  h.review('sleep', 'enToKo', false);
  const afterLapse = h.store.exportData();
  h.store.importData(oldBackup);
  assert.equal(h.store.getCard('sleep').status, 'learning');
  assert.equal(h.store.getCard('sleep').progress.enToKo.attempts, 4);
  assert.equal(h.store.exportData(), afterLapse);
  h.store.importData(oldBackup);
  assert.equal(h.store.exportData(), afterLapse);
  assert.equal(h.store.getLessonProgress().intro.completions, 1);
});

test('backup merge preserves both stores, deduplicates the same word, and remaps its reviews', () => {
  const a = harness({ seed: [sleep], name: 'phone-a' });
  a.review('sleep', 'enToKo');
  const b = harness({ seed: [{ ...sleep, id: 'another-sleep' }, apple], name: 'phone-b' });
  b.review('another-sleep', 'koToEn');
  b.store.completeLesson('intro');
  const result = a.store.importData(b.store.exportData());
  assert.deepEqual(result, { added: 1, merged: 1, total: 2 });
  assert.equal(a.store.getCard('another-sleep'), null);
  assert.equal(a.store.getCard('sleep').progress.enToKo.attempts, 1);
  assert.equal(a.store.getCard('sleep').progress.koToEn.attempts, 1);
  assert.equal(a.store.getLessonProgress().intro.completions, 1);
  a.store.importData(b.store.exportData());
  assert.equal(a.store.getCard('sleep').progress.koToEn.attempts, 1);
});

test('newer genuine review history can demote progress imported from an older device', () => {
  const old = harness({ name: 'old' });
  master(old);
  const recent = harness({ seed: [], name: 'recent' });
  recent.store.importData(old.store.exportData());
  recent.setTime(START + 5 * DAY_MS);
  recent.review('sleep', 'koToEn', false);
  old.store.importData(recent.store.exportData());
  assert.equal(old.store.getCard('sleep').status, 'learning');
  assert.equal(old.store.getCard('sleep').progress.koToEn.lapses, 1);
});

test('invalid or conflicting imports leave every existing record unchanged', () => {
  const h = harness();
  h.review('sleep', 'enToKo');
  const original = h.store.exportData();
  const wrongVersion = JSON.parse(original); wrongVersion.schemaVersion = 99;
  const missingCard = JSON.parse(original); missingCard.history[0].cardId = 'does-not-exist';
  const wrongIdentity = JSON.parse(original); wrongIdentity.cards[0].ko = '먹다';
  const wrongEvent = JSON.parse(original); wrongEvent.history[0].correct = false;
  for (const invalid of ['no json', wrongVersion, missingCard, wrongIdentity, wrongEvent]) {
    assert.throws(() => h.store.importData(invalid), ValidationError);
    assert.equal(h.store.exportData(), original);
  }
});

test('a failed backup save does not partially import cards, settings or history', () => {
  const h = harness({ seed: [sleep] });
  const source = harness({ seed: [apple], name: 'source' });
  source.review('apple', 'enToKo');
  source.store.setSettings({ dailyGoal: 25 });
  const original = h.store.exportData();
  h.storage.failWrite = true;
  assert.throws(() => h.store.importData(source.store.exportData()), StorageError);
  assert.equal(h.store.exportData(), original);
});

test('settings backups restore deliberate preferences without overwriting newer ones', () => {
  const source = harness({ name: 'source' });
  source.store.setSettings({ dailyGoal: 25 });
  const restored = harness({ seed: [], name: 'restored' });
  restored.advance(DAY_MS);
  restored.store.importData(source.store.exportData());
  assert.equal(restored.store.getSettings().dailyGoal, 25);
  restored.store.setSettings({ dailyGoal: 12 });
  restored.store.importData(source.store.exportData());
  assert.equal(restored.store.getSettings().dailyGoal, 12);
});

test('daily activity follows local calendar dates and a streak survives an unfinished today', () => {
  const h = harness({ timeZone: 'Europe/Vienna' });
  h.setTime(Date.parse('2026-10-12T22:30:00Z')); // October 13 in Vienna.
  h.review('sleep', 'enToKo');
  h.store.completeLesson('intro');
  assert.deepEqual(h.store.getStats().today, { attempts: 1, correct: 1, assisted: 0, lessons: 1 });
  assert.equal(h.store.getStats().streak, 1);
  h.setTime(Date.parse('2026-10-13T22:30:00Z'));
  h.review('sleep', 'koToEn');
  assert.equal(h.store.getStats().streak, 2);
  h.setTime(Date.parse('2026-10-14T22:30:00Z'));
  assert.equal(h.store.getStats().today.attempts, 0);
  assert.equal(h.store.getStats().streak, 2);
  h.setTime(Date.parse('2026-10-15T22:30:00Z'));
  assert.equal(h.store.getStats().streak, 0);
  assert.equal(h.store.getDailyStats()['2026-10-13'].lessons, 1);
});

test('unknown cards, directions and unsafe settings are rejected without changes', () => {
  const h = harness();
  const original = h.store.exportData();
  assert.throws(() => h.review('missing', 'enToKo'), ValidationError);
  assert.throws(() => h.review('sleep', 'romanization'), ValidationError);
  assert.throws(() => h.store.setSettings({ dailyGoal: 0 }), ValidationError);
  assert.throws(() => h.store.setSettings({ answerMode: 'unknown' }), ValidationError);
  assert.throws(() => h.store.setSettings({ testDirection: 'unknown' }), ValidationError);
  const invalidBackup = JSON.parse(original);
  invalidBackup.settings.testDirection = 'unknown';
  assert.throws(() => h.store.importData(invalidBackup), ValidationError);
  assert.throws(() => h.store.setSettings(JSON.parse('{"__proto__":"bad"}')), ValidationError);
  assert.throws(() => h.store.completeLesson('__proto__'), ValidationError);
  assert.equal(h.store.exportData(), original);
  assert.equal(getCardStatus(sleep), 'new');
});
