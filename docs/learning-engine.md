# Adaptive vocabulary engine

`app/src/main/assets/engine.js` is a dependency-free ES module. It owns local vocabulary, review history, lesson completion, simple settings, and backup merge. Native speech recognition and the visual interface are separate.

## What the colors mean

| Color | Stored status | Meaning |
| --- | --- | --- |
| Black | `new` | This card has not been tested in either direction. |
| Yellow | `learning` | It has been tested, but does not meet the mastery rule in both directions. |
| Green | `mastered` | Successful reviews in each direction have reached stage 3 or higher and the credited successes in **each** direction span at least four elapsed days. |

Colors are derived from review events. There is no operation to mark a card mastered manually. Leaving the application closed does not turn a yellow card green. Restored progress is recomputed from history, so changing a backup's displayed stage or color has no effect.

The schedule is an intentionally simple product heuristic, not a validated measure of language proficiency or a pronunciation assessment.

## Two independent directions

`enToKo` tests an English prompt against Korean answers. `koToEn` tests a Korean prompt against English answers. Each has its own stage, counters, dates, and lapses. Recognizing a word does not automatically grant productive recall of that word.

An unassisted correct answer earns at most one progression credit per direction in twenty elapsed hours. The successive review intervals are 1, 3, 7, 14, and 30 days. A credited review at the highest stage schedules another 30-day review. Extra successes in the same study session count as practice but do not increase the stage or postpone the existing due date.

An incorrect or assisted answer drops that direction to at most stage 1 and schedules a retry ten minutes later. It therefore demotes a mastered card to yellow. The other direction retains its own history. Early practice remains possible before the retry time.

Mastery can first be earned through successful reviews on day 0, day 1, and day 4 in each direction. Equivalent schedules are possible, but the successful evidence itself must span four days; waiting after a cluster of early reviews is insufficient.

## Sampling

The selector uses weighted sampling across eligible card directions:

- Untested and recently added cards have a substantial baseline weight.
- Due cards gain weight as they become overdue.
- A most-recent failed or assisted recall gains additional retry weight.
- Practiced cards that are not due retain a small weight, so mastered words still appear occasionally.
- Passing `lastCardId` excludes that card for the next turn when any alternative exists.

The selector is intentionally not a strict due-only queue. It supports a playful continuous practice session while still concentrating on weak and due material. Callers can select only one direction or mix both. The two directions of the same word are not treated as two separate vocabulary entries.

## Answer checking and speech fairness

`evaluateAnswer(card, direction, text)` checks a typed answer or a **confirmed speech transcript**. It never examines audio and does not score phonetic pronunciation, accent, intonation, or fluency. The interface should let the learner inspect or edit a recognized transcript before committing the test. A microphone failure or absent transcript should not call `recordAttempt`.

Korean answers use NFC-normalized Hangul. Spacing and trailing sentence punctuation do not decide vocabulary recall. English matching ignores case, extra spacing and trailing sentence punctuation. Explicit `acceptedKo` and `acceptedEn` entries supply valid alternatives. Known noun entries allow an optional `a`/`an`; known verb entries allow an optional English infinitive `to`. Other synonyms, inflections, similar spellings, and approximate matches require curated aliases.

Korean vocabulary, pronunciation explanations and Korean examples use 한글. Romanized Korean is not an accepted answer or a pronunciation field. English translations remain in English. A future phonetic scoring feature would require an independently designed and tested audio system.

An absent pronunciation hint stays empty. The spelling is not automatically copied into that field, because Korean pronunciation may differ from spelling. The UI should offer audio when no reviewed hint is available.

If the interface supplies both `correct: true` and an `answer`, the engine checks the answer again and will not grant credit to a mismatching answer. `assisted: true` means the learner needed help; it counts as activity, not independent recall. A correct result without an answer is supported for controlled callers, so the UI remains responsible for collecting a genuine response.

## Public API

```js
import { createStore, evaluateAnswer } from './engine.js';

const store = createStore(localStorage, {
  key: 'pocketLabKorean.v1',
  seed: VOCABULARY,
});

const next = store.selectNext({ direction: 'mixed', lastCardId: null });
if (next) {
  const result = evaluateAnswer(next.card, next.direction, confirmedTranscript);
  const saved = store.recordAttempt(next.card.id, next.direction, {
    correct: result.correct,
    assisted: false,
    answer: confirmedTranscript,
    mode: 'voice', // or 'typed'
  });
  console.log(saved.credited, saved.card.status);
}
```

| Method | Result |
| --- | --- |
| `getCards()` | Fresh array of cards, with independent `progress`, `status`, and `color`. |
| `getCard(id)` | A fresh card copy, or `null`. |
| `addCard(metadata)` | The saved card; the same Korean/English meaning is reused if already present. |
| `updateCard(id, patch)` | Corrected metadata with the same review history. Korean spelling and card IDs are immutable; meaning, aliases, pronunciation, examples, notes and provenance can be edited. |
| `selectNext({ direction, lastCardId })` | `{ card, direction }`, or `null` for an empty vocabulary. Direction defaults to `mixed`. |
| `evaluateAnswer(card, direction, text)` | `{ correct, normalized, expected }`; also available as a named export. |
| `recordAttempt(id, direction, result)` | `{ card, correct, credited, status, eventId }` after persistence succeeds. |
| `getStats()` | `{ total, new, learning, mastered, due, dueDirections, today, streak }`. `due` counts cards; `dueDirections` counts their directions. |
| `getDailyStats()` | Calendar date keys mapping to `{ attempts, correct, assisted, lessons }`. |
| `completeLesson(id)` / `recordLesson(id)` | Saved `{ id, completed, completedAt, firstCompletedAt, lastCompletedAt, completions }`. |
| `getLessonProgress()` | Object keyed by lesson ID, using the completion records above. |
| `getSettings()` / `setSettings(patch)` | Fresh copy of the saved flat settings object. |
| `exportData()` | Complete, formatted JSON backup string. |
| `importData(jsonOrObject)` | Merges and returns `{ added, merged, total }`; never clears the current vocabulary. |

`createStore` also accepts `now`, `random` (or `rng`), `idFactory`, and `timeZone` options for deterministic checks and controlled environments. The normal app uses the phone's clock, random generator, and local calendar timezone. Streaks count any recorded review or lesson activity. Yesterday's streak stays visible before today's first practice and expires if a whole additional day is missed.

Vocabulary metadata follows this shape:

```js
{
  id: 'sleep',
  ko: '자다',
  en: 'to sleep',
  pronunciation: '자다',
  acceptedKo: [],
  acceptedEn: ['sleep'],
  partOfSpeech: 'verb',
  tags: ['daily'],
  note: 'Dictionary form.',
  example: { ko: '저는 자요.', en: 'I sleep.' },
  starter: true,
  source: 'curated',
  sourceIds: ['dictionary'],
  politeForm: '자요',
  pronunciationVariants: [],
}
```

Only `starter: true` entries are seeded, and only when the storage key is genuinely absent. Later content updates never silently inject the full learning corpus into an existing learner's tracked vocabulary. New custom entries receive IDs when one is not supplied. Distinct English meanings of the same Korean word may have separate cards.

`updateCard` supports correcting a machine translation and adding or removing accepted English answers. Existing test events and their historical outcomes remain intact; changing a description does not retroactively regrade old tests. A different Korean word requires a new card. Newer metadata wins during backup merge, including deliberate alias removal, so an old backup cannot resurrect a translation error. `source` and `sourceIds` preserve the difference between curated, machine translated, and custom entries.

## Persistence, recovery and imports

Schema version 1 contains `cards`, uniquely identified review and lesson `history`, `settings`, `settingsUpdatedAt`, `createdAt`, and `updatedAt`. Exported card progress and `lessonProgress` are convenient derived views; review and lesson events remain authoritative.

Each mutation constructs and validates its next state, saves one JSON value through the synchronous storage adapter, and only then exposes the change to the UI. A failed write throws `StorageError` and leaves the previous live and persisted state unchanged. Callers should show the error and offer the existing backup export; they must not show the attempted change as successfully saved. Corrupt saved data throws `ValidationError`; it is not silently replaced or reseeded. Invalid imports are rejected before any write.

Backup import merges vocabulary by ID and then by normalized Korean/English identity. It remaps histories when duplicate words have different IDs, keeps existing cards, and merges unique event IDs. Reimporting the same backup does not inflate counts. A stale backup cannot erase a more recent failure. A newer failure from a second copy legitimately demotes the recomputed result. Conflicting event IDs and reused card IDs with different meanings cause the whole import to fail safely. Deliberately changed settings use their saved modification timestamp, so a fresh installation can restore old preferences while newer local preferences survive an old import.

The full event log is retained rather than silently truncating evidence. Very large histories can eventually reach the WebView storage quota; failed saves remain visible and recoverable. The initial app should offer backup export. This first schema is intended for personal use and ordinary phone-clock behavior, not adversarial score verification or concurrent real-time synchronization across devices.

## Verification

Run `node --test tests/engine.test.js` from the repository root. The checks cover both-direction mastery, elapsed-time protection, lapses, safe transcript handling, conservative answer variants, adaptive selection, saved-state isolation, corruption, write failures, backup merge and deduplication, and local-calendar streaks.
