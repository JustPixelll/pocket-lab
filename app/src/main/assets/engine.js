/**
 * Pocket Lab's offline vocabulary engine.
 *
 * Progress is derived from review events, never from a manually chosen color.
 * There is deliberately no network, speech-recognition, or pronunciation score
 * here: a confirmed speech transcript is checked as vocabulary recall.
 */

export const SCHEMA_VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const CREDIT_GAP_MS = 20 * 60 * 60 * 1000;
export const MASTERY_SPAN_MS = 4 * DAY_MS;
export const RETRY_DELAY_MS = 10 * 60 * 1000;
export const DIRECTIONS = Object.freeze(['enToKo', 'koToEn']);
export const REVIEW_INTERVALS_DAYS = Object.freeze([0, 1, 3, 7, 14, 30]);

const DEFAULT_KEY = 'pocketLabKorean.v1';
const MAX_CARDS = 10000;
const MAX_TEXT = 2000;
const DEFAULT_SETTINGS = Object.freeze({ dailyGoal: 10, answerMode: 'voice', testDirection: 'mixed', speechRate: 0.85 });

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; }
}

export class StorageError extends Error {
  constructor(message, cause) { super(message); this.name = 'StorageError'; this.cause = cause; }
}

const copy = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function fail(message) { throw new ValidationError(message); }
function assertObject(value, label) { if (!isObject(value)) fail(`${label} must be an object.`); }
function assertDirection(direction) { if (!DIRECTIONS.includes(direction)) fail('Choose enToKo or koToEn.'); }

function timestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) fail(`${label} must be a valid timestamp.`);
  return value;
}

function textValue(value, label, { optional = false, max = MAX_TEXT } = {}) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const result = value.normalize('NFC').trim();
  if (!optional && !result) fail(`${label} cannot be empty.`);
  if (result.length > max) fail(`${label} is too long.`);
  return result;
}

function identifier(value, label) {
  const result = textValue(value, label, { max: 160 });
  if (!/^[\p{L}\p{N}_.:-]+$/u.test(result) || ['__proto__', 'constructor', 'prototype'].includes(result)) fail(`${label} contains unsupported characters.`);
  return result;
}

function koreanText(value, label, optional = false) {
  const result = textValue(value, label, { optional });
  if (result && (!/\p{Script=Hangul}/u.test(result) || /[A-Za-z]/u.test(result))) {
    fail(`${label} must use 한글, without romanization.`);
  }
  return result;
}

function textArray(value, label, korean = false) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) fail(`${label} must be a short list.`);
  return [...new Set(value.map((item) => korean ? koreanText(item, label) : textValue(item, label)))];
}

function trimSentencePunctuation(value) {
  return value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '').trim()
    .replace(/[.!?。！？…,:;]+$/gu, '').trim();
}

/** Whitespace and final sentence punctuation do not decide Korean recall. */
export function normalizeKorean(value) {
  return trimSentencePunctuation(String(value ?? '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/gu, ''))
    .replace(/\s+/gu, '');
}

/** English matching keeps spelling and words intact; aliases are explicit. */
export function normalizeEnglish(value) {
  return trimSentencePunctuation(String(value ?? '').normalize('NFC').replace(/[‘’]/gu, "'"))
    .toLocaleLowerCase('en').replace(/\s+/gu, ' ');
}

function englishForms(value, partOfSpeech) {
  const normalized = normalizeEnglish(value);
  const result = [normalized];
  // These two grammatical variations are safe only for a known word class.
  // Other synonyms, inflections and sentence alternatives must be curated.
  if (partOfSpeech === 'verb') result.push(normalized.replace(/^to /u, ''));
  if (partOfSpeech === 'noun') result.push(normalized.replace(/^(?:a|an) /u, ''));
  return result;
}

/**
 * Evaluate a typed answer or a learner-confirmed speech transcript.
 * This does not evaluate accent, audio quality, or phonetic pronunciation.
 */
export function evaluateAnswer(card, direction, answer) {
  assertDirection(direction);
  assertObject(card, 'Vocabulary card');
  const expected = direction === 'enToKo' ? card.ko : card.en;
  const normalized = direction === 'enToKo' ? normalizeKorean(answer) : normalizeEnglish(answer);
  let correct = false;
  if (normalized) {
    if (direction === 'enToKo') {
      correct = [card.ko, ...(card.acceptedKo ?? [])].some((item) => normalizeKorean(item) === normalized);
    } else {
      const actualForms = englishForms(answer, card.partOfSpeech);
      correct = [card.en, ...(card.acceptedEn ?? [])].some((item) => englishForms(item, card.partOfSpeech)
        .some((form) => actualForms.includes(form)));
    }
  }
  return { correct, normalized, expected };
}

function metadata(input, at, { imported = false } = {}) {
  assertObject(input, 'Vocabulary card');
  const ko = koreanText(input.ko, 'Korean vocabulary');
  const en = textValue(input.en, 'English meaning');
  const result = {
    id: identifier(input.id, 'Card ID'), ko, en,
    pronunciation: koreanText(input.pronunciation, 'Pronunciation', true),
    acceptedKo: textArray(input.acceptedKo, 'Accepted Korean answers', true),
    acceptedEn: textArray(input.acceptedEn, 'Accepted English answers'),
    partOfSpeech: textValue(input.partOfSpeech, 'Part of speech', { optional: true, max: 100 }),
    tags: textArray(input.tags, 'Tags'),
    note: textValue(input.note, 'Note', { optional: true, max: 5000 }),
    source: textValue(input.source ?? (input.starter ? 'curated' : 'custom'), 'Vocabulary source', { max: 100 }),
    sourceIds: textArray(input.sourceIds, 'Source references'),
    politeForm: koreanText(input.politeForm, 'Polite form', true),
    pronunciationVariants: textArray(input.pronunciationVariants, 'Pronunciation variants', true),
    starter: input.starter === true,
    addedAt: imported ? timestamp(input.addedAt, 'Card addedAt') : at,
    updatedAt: imported ? timestamp(input.updatedAt ?? input.addedAt, 'Card updatedAt') : at,
  };
  if (input.example !== undefined && input.example !== null) {
    assertObject(input.example, 'Example');
    result.example = { ko: koreanText(input.example.ko, 'Korean example'), en: textValue(input.example.en, 'English example') };
  }
  return result;
}

function initialProgress(at) {
  return { attempts: 0, correct: 0, assisted: 0, lapses: 0, stage: 0, dueAt: at,
    firstCreditAt: null, lastCreditAt: null, lastAttemptAt: null, lastFailureAt: null, lastResult: null };
}

function applyReview(previous, event) {
  const progress = { ...previous, attempts: previous.attempts + 1, lastAttemptAt: event.at };
  const recalled = event.correct && !event.assisted;
  if (!recalled) {
    progress.assisted += event.assisted ? 1 : 0;
    progress.lapses += 1;
    progress.stage = Math.min(progress.stage, 1);
    progress.dueAt = event.at + RETRY_DELAY_MS;
    progress.lastFailureAt = event.at;
    progress.lastResult = event.assisted ? 'assisted' : 'incorrect';
    return progress;
  }
  progress.correct += 1;
  progress.lastResult = 'correct';
  if (progress.lastCreditAt === null || event.at - progress.lastCreditAt >= CREDIT_GAP_MS) {
    progress.stage = Math.min(REVIEW_INTERVALS_DAYS.length - 1, progress.stage + 1);
    progress.firstCreditAt ??= event.at;
    progress.lastCreditAt = event.at;
    progress.dueAt = event.at + REVIEW_INTERVALS_DAYS[progress.stage] * DAY_MS;
  }
  // An early practice success never postpones the existing review date.
  return progress;
}

export function getCardStatus(card) {
  const directions = DIRECTIONS.map((direction) => card.progress?.[direction] ?? initialProgress(card.addedAt ?? 0));
  if (directions.every((item) => item.attempts === 0)) return 'new';
  const mastered = directions.every((item) => item.stage >= 3 && item.firstCreditAt !== null
    && item.lastCreditAt !== null && item.lastCreditAt - item.firstCreditAt >= MASTERY_SPAN_MS);
  return mastered ? 'mastered' : 'learning';
}

function enrich(card, progress) {
  const result = { ...copy(card), progress: copy(progress) };
  result.status = getCardStatus(result);
  result.color = { new: 'black', learning: 'yellow', mastered: 'green' }[result.status];
  return result;
}

function validateSettings(input) {
  assertObject(input, 'Settings');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    identifier(key, 'Setting name');
    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) fail('Settings values must be text, a number, a boolean, or null.');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('Settings numbers must be finite.');
    if (typeof value === 'string' && value.length > 2048) fail('A setting value is too long.');
    result[key] = value;
  }
  if (own(result, 'dailyGoal') && (!Number.isInteger(result.dailyGoal) || result.dailyGoal < 1 || result.dailyGoal > 500)) fail('Daily goal must be between 1 and 500.');
  if (own(result, 'speechRate') && (typeof result.speechRate !== 'number' || result.speechRate < 0.25 || result.speechRate > 2)) fail('Speech rate must be between 0.25 and 2.');
  if (own(result, 'answerMode') && !['voice', 'typed'].includes(result.answerMode)) fail('Answer mode must be voice or typed.');
  if (own(result, 'testDirection') && !['mixed', ...DIRECTIONS].includes(result.testDirection)) fail('Test direction must be mixed, enToKo, or koToEn.');
  return result;
}

function reviewEvent(input, cardIds) {
  assertObject(input, 'History event');
  const common = { id: identifier(input.id, 'Event ID'), type: input.type, at: timestamp(input.at, 'Event time') };
  if (input.type === 'lesson') return { ...common, lessonId: identifier(input.lessonId, 'Lesson ID') };
  if (input.type !== 'attempt') fail('Unknown history event type.');
  const cardId = identifier(input.cardId, 'Reviewed card ID');
  if (!cardIds.has(cardId)) fail('A review references a missing vocabulary card.');
  assertDirection(input.direction);
  if (typeof input.correct !== 'boolean' || typeof input.assisted !== 'boolean') fail('Review outcomes must be booleans.');
  if (!['voice', 'typed'].includes(input.mode)) fail('Review mode must be voice or typed.');
  const result = { ...common, cardId, direction: input.direction, correct: input.correct, assisted: input.assisted, mode: input.mode };
  if (input.answer !== undefined) result.answer = textValue(input.answer, 'Recorded answer', { optional: true });
  return result;
}

function orderedEvents(events) {
  return [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id, 'en'));
}

function parseSnapshot(value) {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { fail('This backup is not valid JSON. Your existing data has not changed.'); }
  }
  assertObject(input, 'Backup');
  if (input.schemaVersion !== SCHEMA_VERSION) fail('This backup uses an unsupported schema version. Your existing data has not changed.');
  if (!Array.isArray(input.cards) || input.cards.length > MAX_CARDS) fail('The backup vocabulary list is invalid or too large.');
  if (!Array.isArray(input.history)) fail('The backup is missing its learning history.');
  const cards = input.cards.map((card) => metadata(card, 0, { imported: true }));
  const cardIds = new Set(cards.map((card) => card.id));
  if (cardIds.size !== cards.length) fail('The backup has duplicate card IDs.');
  const history = input.history.map((event) => reviewEvent(event, cardIds));
  if (new Set(history.map((event) => event.id)).size !== history.length) fail('The backup has duplicate history event IDs.');
  return { schemaVersion: SCHEMA_VERSION, cards, history: orderedEvents(history),
    settings: { ...DEFAULT_SETTINGS, ...validateSettings(input.settings ?? {}) },
    settingsUpdatedAt: timestamp(input.settingsUpdatedAt ?? 0, 'Settings updatedAt'),
    createdAt: timestamp(input.createdAt, 'Store createdAt'), updatedAt: timestamp(input.updatedAt, 'Store updatedAt') };
}

function derive(state) {
  const progress = new Map(state.cards.map((card) => [card.id, {
    enToKo: initialProgress(card.addedAt), koToEn: initialProgress(card.addedAt),
  }]));
  const lessons = {};
  for (const event of state.history) {
    if (event.type === 'attempt') {
      const card = progress.get(event.cardId);
      card[event.direction] = applyReview(card[event.direction], event);
    } else {
      const previous = lessons[event.lessonId];
      lessons[event.lessonId] = { id: event.lessonId, completed: true,
        completedAt: previous?.completedAt ?? event.at,
        firstCompletedAt: previous?.firstCompletedAt ?? event.at,
        lastCompletedAt: event.at, completions: (previous?.completions ?? 0) + 1 };
    }
  }
  return { progress, lessons };
}

function snapshot(state, derived) {
  return { ...state,
    cards: state.cards.map((card) => ({ ...card, progress: copy(derived.progress.get(card.id)) })),
    lessonProgress: copy(derived.lessons),
  };
}

function identity(card) { return `${normalizeKorean(card.ko)}\u0000${normalizeEnglish(card.en)}`; }

function mergeMetadata(existing, incoming) {
  if (normalizeKorean(existing.ko) !== normalizeKorean(incoming.ko)) fail('A backup reuses a card ID for different Korean vocabulary. Your existing data has not changed.');
  const preferred = incoming.updatedAt > existing.updatedAt ? incoming : existing;
  // Keep the newest description intact: unioning old aliases back in could
  // resurrect a mistaken machine translation that the learner corrected.
  return { ...preferred, id: existing.id, addedAt: Math.min(existing.addedAt, incoming.addedAt),
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt), starter: existing.starter || incoming.starter,
  };
}

function sameEvent(first, second) {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => own(second, key) && first[key] === second[key]);
}

function previousDateKey(key) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Create a synchronous store. `storage` implements localStorage's getItem and
 * setItem. Every mutation is saved successfully before the live state changes.
 */
export function createStore(storage = globalThis.localStorage, options = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new StorageError('Local storage is unavailable. Existing learning data has not been overwritten.');
  }
  const key = options.key ?? DEFAULT_KEY;
  const clock = options.now ?? Date.now;
  const random = options.random ?? options.rng ?? Math.random;
  const now = () => timestamp(Math.trunc(clock()), 'Current time');
  let sequence = 0;
  function makeId(prefix) {
    if (options.idFactory) return identifier(options.idFactory(prefix), 'Generated ID');
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    sequence += 1;
    return `${prefix}-${now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  let raw;
  try { raw = storage.getItem(key); } catch (cause) { throw new StorageError('Learning data could not be read. Existing data has not been overwritten.', cause); }
  let state;
  if (raw === null || raw === undefined) {
    const at = now();
    state = { schemaVersion: SCHEMA_VERSION, cards: [], history: [], settings: { ...DEFAULT_SETTINGS },
      settingsUpdatedAt: 0, createdAt: at, updatedAt: at };
    if (options.seed !== undefined && !Array.isArray(options.seed)) fail('Starter vocabulary must be a list.');
    const seed = (options.seed ?? []).filter((card) => card.starter === true);
    state.cards = seed.map((card) => metadata({ ...card, id: card.id ?? makeId('card') }, at));
    if (new Set(state.cards.map((card) => card.id)).size !== state.cards.length) fail('Starter vocabulary has duplicate IDs.');
  } else {
    state = parseSnapshot(raw);
  }
  let derived = derive(state);

  function persist(next, nextDerived) {
    const serialized = JSON.stringify(snapshot(next, nextDerived));
    try {
      const result = storage.setItem(key, serialized);
      if (result && typeof result.then === 'function') throw new Error('Use a synchronous storage adapter.');
    } catch (cause) {
      throw new StorageError('This change could not be saved. Your previous learning data is still intact. Export a backup or free storage, then try again.', cause);
    }
  }

  function commit(next) {
    const nextDerived = derive(next);
    persist(next, nextDerived);
    state = next;
    derived = nextDerived;
  }

  // Persist the first-run marker even with no seed, so reopening an empty store
  // never silently adds new cards or overwrites a deliberate empty vocabulary.
  if (raw === null || raw === undefined) persist(state, derived);

  function cardById(id) {
    const card = state.cards.find((item) => item.id === id);
    if (!card) fail('That vocabulary card does not exist.');
    return card;
  }

  function getCard(id) {
    const card = state.cards.find((item) => item.id === id);
    return card ? enrich(card, derived.progress.get(card.id)) : null;
  }

  const getCards = () => state.cards.map((card) => enrich(card, derived.progress.get(card.id)));
  const eventTime = () => Math.max(now(), state.history.length ? state.history[state.history.length - 1].at + 1 : 0);

  function addCard(input) {
    const at = now();
    assertObject(input, 'Vocabulary card');
    const card = metadata({ ...input, id: input.id ?? makeId('card') }, at);
    const sameId = state.cards.find((item) => item.id === card.id);
    if (sameId && identity(sameId) !== identity(card)) fail('That card ID already belongs to different vocabulary.');
    const existing = sameId ?? state.cards.find((item) => identity(item) === identity(card));
    if (existing) return getCard(existing.id);
    if (state.cards.length >= MAX_CARDS) fail('The vocabulary list is full. Export a backup before reorganizing it.');
    commit({ ...state, cards: [...state.cards, card], updatedAt: at });
    return getCard(card.id);
  }

  function updateCard(cardId, patch) {
    const existing = cardById(cardId);
    assertObject(patch, 'Vocabulary changes');
    const allowed = new Set(['id', 'ko', 'en', 'pronunciation', 'acceptedKo', 'acceptedEn', 'partOfSpeech',
      'tags', 'note', 'example', 'source', 'sourceIds', 'politeForm', 'pronunciationVariants']);
    for (const field of Object.keys(patch)) if (!allowed.has(field)) fail(`The ${field} field cannot be edited.`);
    if (own(patch, 'id') && patch.id !== existing.id) fail('A card ID cannot be changed.');
    if (own(patch, 'ko') && koreanText(patch.ko, 'Korean vocabulary') !== existing.ko) {
      fail('Add a new vocabulary card for different Korean spelling so its review history stays accurate.');
    }
    const at = Math.max(now(), existing.updatedAt + 1);
    const updated = metadata({ ...existing, ...patch, id: existing.id,
      addedAt: existing.addedAt, updatedAt: at }, at, { imported: true });
    if (state.cards.some((card) => card.id !== cardId && identity(card) === identity(updated))) {
      fail('A card for that Korean word and English meaning already exists.');
    }
    commit({ ...state, cards: state.cards.map((card) => card.id === cardId ? updated : card), updatedAt: at });
    return getCard(cardId);
  }

  function recordAttempt(cardId, direction, input) {
    const card = cardById(cardId);
    assertDirection(direction);
    assertObject(input, 'Review result');
    if (typeof input.correct !== 'boolean') fail('A review must include whether recall was correct.');
    if (input.assisted !== undefined && typeof input.assisted !== 'boolean') fail('Assisted must be true or false.');
    let answer;
    if (input.answer !== undefined) {
      answer = textValue(input.answer, 'Answer');
      if (!(direction === 'enToKo' ? normalizeKorean(answer) : normalizeEnglish(answer))) fail('Confirm a nonempty answer before recording a test.');
    }
    const correct = input.correct && (answer === undefined || evaluateAnswer(card, direction, answer).correct);
    const event = reviewEvent({ id: makeId('review'), type: 'attempt', cardId, direction,
      at: eventTime(), correct, assisted: input.assisted ?? false, mode: input.mode ?? 'typed',
      ...(answer !== undefined ? { answer } : {}),
    }, new Set(state.cards.map((item) => item.id)));
    const before = derived.progress.get(cardId)[direction];
    if (state.history.some((item) => item.id === event.id)) fail('A generated review ID already exists. Try again.');
    commit({ ...state, history: [...state.history, event], updatedAt: event.at });
    const updated = getCard(cardId);
    return { card: updated, correct: event.correct && !event.assisted,
      credited: updated.progress[direction].lastCreditAt !== before.lastCreditAt,
      status: updated.status, eventId: event.id };
  }

  function selectNext({ direction = 'mixed', lastCardId = null } = {}) {
    if (direction !== 'mixed') assertDirection(direction);
    if (!state.cards.length) return null;
    const at = now();
    const directions = direction === 'mixed' ? DIRECTIONS : [direction];
    const candidates = [];
    const hasAlternative = state.cards.some((card) => card.id !== lastCardId);
    for (const card of state.cards) {
      if (hasAlternative && card.id === lastCardId) continue;
      const progress = derived.progress.get(card.id);
      for (const currentDirection of directions) {
        const item = progress[currentDirection];
        let weight;
        if (item.attempts === 0) {
          // Newly added entries appear regularly without taking every turn.
          weight = at - card.addedAt <= 2 * DAY_MS ? 6 : 5;
        } else if (item.dueAt <= at) {
          const overdueDays = Math.max(0, (at - item.dueAt) / DAY_MS);
          weight = 4 + Math.min(12, overdueDays * 1.5) + Math.max(0, 3 - item.stage);
        } else {
          weight = item.stage >= 3 ? 0.12 : 0.55;
        }
        if (item.lastResult === 'incorrect' || item.lastResult === 'assisted') {
          // Let another card intervene; a forgotten card returns soon, while
          // the official due date still records the ten-minute retry target.
          weight += item.dueAt <= at ? 8 : 2.5;
        }
        candidates.push({ card, direction: currentDirection, weight });
      }
    }
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    const value = Number(random());
    let cursor = (Number.isFinite(value) ? Math.max(0, Math.min(0.999999999999, value)) : 0.5) * totalWeight;
    let selected = candidates[candidates.length - 1];
    for (const candidate of candidates) {
      cursor -= candidate.weight;
      if (cursor < 0) { selected = candidate; break; }
    }
    return { card: getCard(selected.card.id), direction: selected.direction };
  }

  function completeLesson(lessonId) {
    identifier(lessonId, 'Lesson ID');
    const event = { id: makeId('lesson'), type: 'lesson', at: eventTime(), lessonId };
    if (state.history.some((item) => item.id === event.id)) fail('A generated lesson ID already exists. Try again.');
    commit({ ...state, history: [...state.history, event], updatedAt: event.at });
    return copy(derived.lessons[lessonId]);
  }

  function setSettings(patch) {
    const validated = validateSettings(patch);
    const settings = { ...state.settings, ...validated };
    validateSettings(settings);
    if (JSON.stringify(settings) === JSON.stringify(state.settings)) return copy(settings);
    const at = now();
    commit({ ...state, settings, settingsUpdatedAt: at, updatedAt: at });
    return copy(settings);
  }

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    ...(options.timeZone ? { timeZone: options.timeZone } : {}), year: 'numeric', month: '2-digit', day: '2-digit',
  });
  function dateKey(at) {
    const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function getDailyStats() {
    const result = {};
    for (const event of state.history) {
      const day = dateKey(event.at);
      result[day] ??= { attempts: 0, correct: 0, assisted: 0, lessons: 0 };
      if (event.type === 'lesson') result[day].lessons += 1;
      else {
        result[day].attempts += 1;
        result[day].correct += event.correct && !event.assisted ? 1 : 0;
        result[day].assisted += event.assisted ? 1 : 0;
      }
    }
    return result;
  }

  function getStats() {
    const cards = getCards();
    const at = now();
    const todayKey = dateKey(at);
    const daily = getDailyStats();
    let streak = 0;
    let cursor = daily[todayKey] ? todayKey : previousDateKey(todayKey);
    while (daily[cursor]) { streak += 1; cursor = previousDateKey(cursor); }
    return { total: cards.length, new: cards.filter((card) => card.status === 'new').length,
      learning: cards.filter((card) => card.status === 'learning').length,
      mastered: cards.filter((card) => card.status === 'mastered').length,
      due: cards.filter((card) => DIRECTIONS.some((direction) => card.progress[direction].dueAt <= at)).length,
      dueDirections: cards.reduce((sum, card) => sum + DIRECTIONS.filter((direction) => card.progress[direction].dueAt <= at).length, 0),
      today: daily[todayKey] ?? { attempts: 0, correct: 0, assisted: 0, lessons: 0 }, streak };
  }

  function importData(value) {
    const incoming = parseSnapshot(value);
    const cards = state.cards.map((card) => copy(card));
    const byId = new Map(cards.map((card, index) => [card.id, index]));
    const byIdentity = new Map(cards.map((card) => [identity(card), card.id]));
    const importedIds = new Map();
    let added = 0;
    let merged = 0;
    for (const card of incoming.cards) {
      const canonicalId = byId.has(card.id) ? card.id : byIdentity.get(identity(card));
      if (canonicalId) {
        const index = byId.get(canonicalId);
        const oldIdentity = identity(cards[index]);
        cards[index] = mergeMetadata(cards[index], card);
        const nextIdentity = identity(cards[index]);
        if (byIdentity.has(nextIdentity) && byIdentity.get(nextIdentity) !== canonicalId) {
          fail('This backup correction would make two existing vocabulary cards identical. Your data has not changed.');
        }
        if (byIdentity.get(oldIdentity) === canonicalId) byIdentity.delete(oldIdentity);
        byIdentity.set(nextIdentity, canonicalId);
        importedIds.set(card.id, canonicalId);
        merged += 1;
      } else {
        byId.set(card.id, cards.length);
        byIdentity.set(identity(card), card.id);
        importedIds.set(card.id, card.id);
        cards.push(copy(card));
        added += 1;
      }
    }
    if (cards.length > MAX_CARDS) fail('Merging this backup would exceed the vocabulary limit. Your data has not changed.');
    const events = new Map(state.history.map((event) => [event.id, event]));
    for (const original of incoming.history) {
      const event = original.type === 'attempt' ? { ...original, cardId: importedIds.get(original.cardId) } : original;
      const existing = events.get(event.id);
      if (existing && !sameEvent(existing, event)) fail('The backup conflicts with an existing history event. Your data has not changed.');
      if (!existing) events.set(event.id, event);
    }
    const preferIncomingSettings = incoming.settingsUpdatedAt > state.settingsUpdatedAt;
    const settings = preferIncomingSettings ? { ...state.settings, ...incoming.settings } : { ...incoming.settings, ...state.settings };
    const next = { ...state, cards, history: orderedEvents([...events.values()]), settings,
      settingsUpdatedAt: Math.max(state.settingsUpdatedAt, incoming.settingsUpdatedAt),
      createdAt: Math.min(state.createdAt, incoming.createdAt), updatedAt: Math.max(state.updatedAt, incoming.updatedAt) };
    if (JSON.stringify(next) !== JSON.stringify(state)) commit(next);
    return { added, merged, total: cards.length };
  }

  return Object.freeze({
    addCard, updateCard, getCard, getCards, recordAttempt, selectNext,
    evaluateAnswer, getStats, getDailyStats,
    completeLesson, recordLesson: completeLesson,
    getLessonProgress: () => copy(derived.lessons),
    getSettings: () => copy(state.settings), setSettings,
    exportData: () => JSON.stringify(snapshot(state, derived), null, 2), importData,
  });
}
