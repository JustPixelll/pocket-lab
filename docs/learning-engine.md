# Adaptive vocabulary engine

`app/src/main/assets/engine.js` is a dependency-free ES module. It owns local vocabulary, review history, lesson completion, the character and earned coins, simple settings, and backup merge. Native speech recognition and the visual interface are separate. Cosmetic definitions live in `app/src/main/assets/data/customization.js`.

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
| `recordAttempt(id, direction, result)` | `{ card, correct, credited, status, eventId, coinsEarned, rewards }` after persistence succeeds. |
| `getStats()` | `{ total, new, learning, mastered, due, dueDirections, today, streak }`. `due` counts cards; `dueDirections` counts their directions. |
| `getDailyStats()` | Calendar date keys mapping to `{ attempts, correct, assisted, lessons }`. |
| `completeLesson(id)` / `recordLesson(id)` | Saved `{ id, completed, completedAt, firstCompletedAt, lastCompletedAt, completions, coinsEarned, rewards }`. |
| `getLessonProgress()` | Object keyed by lesson ID, using the completion records above. |
| `getSettings()` / `setSettings(patch)` | Fresh copy of the saved flat settings object. |
| `getProfile()` | Fresh character, balance, owned-item, equipment, purchase, and achievement view; see below. |
| `buyItem(itemId)` | Atomically buys and equips the item; returns `{ purchased, spent, item, profile }`. An owned/free item costs zero. |
| `equipItem(itemId)` | Equips an owned item in its catalogue slot and returns the updated profile. |
| `setCharacterName(name)` | Saves a nonempty name of at most 24 Unicode code points and returns the profile. Names are plain text; the UI must escape them. |
| `exportData()` | Complete, formatted JSON backup string. |
| `importData(jsonOrObject)` | Merges and returns `{ added, merged, total }`, plus `coinDebt` only if positive; never clears the current vocabulary. |

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

Schema version 2 contains `cards`, uniquely identified review and lesson `history`, `profile`, `settings`, `settingsUpdatedAt`, `createdAt`, and `updatedAt`. Exported card progress and `lessonProgress` are convenient derived views; review and lesson events remain authoritative for vocabulary progress.

The storage key stays **`pocketLabKorean.v1`**. A version-1 notebook or backup is supported and gains a default character plus achievement receipts recovered by replaying its full history. Vocabulary, original lesson IDs, review events, settings, and completion counts are retained. Migration is persisted in one write before the store is returned; a failed migration leaves the old saved bytes intact and throws `StorageError`, so it can be retried. A version-2 backup requires the updated app; unsupported versions fail without resetting data.

Each mutation constructs and validates its next state, saves one JSON value through the synchronous storage adapter, and only then exposes the change to the UI. A failed write throws `StorageError` and leaves the previous live and persisted state unchanged. Callers should show the error and offer the existing backup export; they must not show the attempted change as successfully saved. Corrupt saved data throws `ValidationError`; it is not silently replaced or reseeded. Invalid imports are rejected before any write.

Backup import merges vocabulary by ID and then by normalized Korean/English identity. It remaps histories when duplicate words have different IDs, keeps existing cards, and merges unique event IDs. Reimporting the same backup does not inflate counts. A stale backup cannot erase a more recent failure. A newer failure from a second copy legitimately demotes the recomputed result. Conflicting event IDs and reused card IDs with different meanings cause the whole import to fail safely. Deliberately changed settings use their saved modification timestamp, so a fresh installation can restore old preferences while newer local preferences survive an old import.

The full event log is retained rather than silently truncating evidence. Very large histories can eventually reach the WebView storage quota; failed saves remain visible and recoverable. The app offers backup export. This schema is intended for personal use and ordinary phone-clock behavior, not adversarial score verification or concurrent real-time synchronization across devices.

## Character, coin rewards, and the shop

Coins are earned through learning. There are no currency purchases, random rewards, or cosmetic bonuses to vocabulary scores.

| Achievement | Coins | Repetition |
| --- | --- | --- |
| First completion of a lesson/quest ID | 20 | Replays still count as lesson activity, but earn no additional coins. |
| First time a vocabulary card reaches green in both directions | 10 | Losing and regaining green earns no further coins. |

Each qualifying event and its reward are saved together. `recordAttempt()` and `completeLesson()` preserve their existing result fields and additionally return `coinsEarned` and `rewards`. Each new reward is `{ type: 'lesson' | 'mastery', targetId, at, coins }`. When nothing new was earned, `coinsEarned` is zero and `rewards` is an empty array. A failed write does not grant a reward or advance learning. `coinsEarned` denotes newly earned coins; a merged-backup adjustment described below can absorb them before they become spendable.

Reward receipts are permanent local records keyed by lesson ID or canonical saved card ID. Full review-history replay discovers the first historical green result, even if the word is yellow today. Receipts are retained after subsequent lapses, and when merging another device's earlier reviews changes the reconstructed timeline. This preserves an achievement already earned. Combining partial histories can also establish a first historical mastery, which is credited once.

### Profile returned to the interface

```js
{
  characterName: '콩이',
  coins: 10,                 // Spendable; never negative.
  coinDebt: 0,               // Normally zero; see forked-backup spending below.
  totalEarned: 30,
  totalSpent: 20,
  ownedItems: ['hat-none', 'hat-beanie', 'outfit-tee', 'body-cream', 'body-sand', 'body-cocoa'],
  equipment: { hat: 'hat-beanie', outfit: 'outfit-tee', body: 'body-cream' },
  rewards: { lessonIds: ['first-hello'], masteredCardIds: ['sleep'] },
  purchases: [{ itemId: 'hat-beanie', price: 20, at: 1792152000000 }],
}
```

The saved profile also keeps a timestamp for the name, a separate timestamp for each equipment slot, and dated achievement receipts. `coins`, `totalEarned`, `totalSpent`, and `ownedItems` in an export are derived display values; importing edited display values does not create currency or ownership. All profile getters return fresh values.

`buyItem()` validates the item and available balance before writing. Acquisition, the purchase receipt, and equipment are one atomic change. Buying an already owned item only equips it for zero coins. Equipping the currently worn item or setting the existing name is a no-op. Unowned items, unknown IDs, insufficient funds, unsupported names, and invalid backup receipts fail without changing the notebook.

### Catalogue and drawing contract

`customization.js` exports `COSMETICS`, `COSMETIC_BY_ID`, `COSMETIC_SLOTS`, `DEFAULT_EQUIPMENT`, and `DEFAULT_CHARACTER_NAME`. Every item has `{ id, slot, name, price, style, color, accent }`; colors are six-digit hex strings suitable for the SVG renderer. Slots are `hat`, `outfit`, and `body`.

- Hats: `hat-none` (free), `hat-beanie` (20), `hat-cap` (30), `hat-wizard` (80), `hat-flower-crown` (60). Styles are `none`, `beanie`, `cap`, `wizard`, and `flower-crown`.
- Outfits: `outfit-tee` (free), `outfit-scarf` (20), `outfit-hoodie` (40), and `outfit-cape` (60), with the corresponding `tee`, `scarf`, `hoodie`, and `cape` styles.
- Body colors: `body-cream`, `body-sand`, and `body-cocoa` are free; `body-mint` and `body-peach` cost 20, and `body-lavender` costs 30. All use `solid`.

All free choices are owned immediately. The default equipment is no hat, the everyday tee, and warm cream. Catalogue IDs and shipped prices are part of purchase receipts and must remain stable; changing their meaning or price requires an explicit migration or a new item ID.

### Merging character backups

Imports union achievement receipts and purchases by their semantic IDs. Matching vocabulary with different saved IDs has its mastery receipt remapped along with its reviews, so it earns one reward. Two copies that both bought the same item produce one owned item and one charge. Newer names and each newer equipment-slot choice win independently; equal timestamps use a deterministic lexical tie-break. An older backup cannot remove purchases or replace a newer appearance choice. Repeating an import makes no additional change.

Two offline copies can spend the same previously earned coins on different items. The merge retains both inventories and all learning progress, deduplicates the common earnings, and records the difference as `coinDebt`. Available `coins` remains `max(0, totalEarned - totalSpent)`. Future learning rewards cover that difference before producing a spendable balance. For example, two copies each spend the same 20-coin quest reward on different 20-coin items: the merged notebook owns both, has zero spendable coins, and has a 20-coin adjustment. The next new quest clears that adjustment; it does not award a second copy of the original reward. The interface can explain this using `getProfile().coinDebt` or the positive `coinDebt` returned by import. Ordinary use of one notebook cannot create this adjustment.

## Verification

Run `node --test tests/engine.test.js` from the repository root. The checks cover both-direction mastery, elapsed-time protection, lapses, safe transcript handling, conservative answer variants, adaptive selection, saved-state isolation, corruption, write failures, backup merge and deduplication, and local-calendar streaks. Character tests cover historical version-1 migration, one-time rewards, failed reward/purchase saves, ownership and equipment, repeat purchases/imports, canonical-card reward deduplication, name validation, and forked-backup spending without lost inventory or negative available coins.
