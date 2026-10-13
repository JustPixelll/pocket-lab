import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOCAB, VOCAB_BY_ID, LESSONS, CHARACTERS, CURRICULUM_SOURCES, recommendLessons,
} from '../app/src/main/assets/data/curriculum.js';

const lessonById = Object.fromEntries(LESSONS.map(lesson => [lesson.id, lesson]));
const sourceIds = new Set(CURRICULUM_SOURCES.map(source => source.id));
const starterIds = new Set(VOCAB.filter(word => word.starter).map(word => word.id));

test('every card has a Korean spelling, Korean reading hint, and usable answer sets', () => {
  assert.equal(VOCAB.length, 60);
  assert.equal(new Set(VOCAB.map(word => word.id)).size, VOCAB.length);
  assert.equal(new Set(VOCAB.map(word => word.ko)).size, VOCAB.length);
  for (const word of VOCAB) {
    assert.match(word.ko, /[가-힣]/u, word.id);
    assert.doesNotMatch(word.ko, /[A-Za-z]/, `${word.id}: spelling must not be romanized`);
    assert.match(word.pronunciation, /^[가-힣 ]+$/u, `${word.id}: reading hint must use Korean script`);
    assert.ok(word.en.trim(), `${word.id}: missing translation`);
    assert.ok(word.acceptedKo.includes(word.ko), `${word.id}: own spelling is not accepted`);
    assert.ok(word.acceptedEn.length > 0, `${word.id}: no accepted English answers`);
    assert.doesNotMatch(word.acceptedKo.join(' '), /[A-Za-z]/, `${word.id}: Korean answers must not be romanized`);
    assert.ok(word.example.ko && word.example.en, `${word.id}: missing contextual example`);
    assert.doesNotMatch(word.example.ko, /[A-Za-z]/, `${word.id}: Korean example must not be romanized`);
    assert.ok(word.sourceIds.every(id => sourceIds.has(id)), `${word.id}: unknown source`);
  }
});

test('starter deck is small and includes the seven previously practiced items', () => {
  assert.equal(starterIds.size, 12);
  for (const id of ['korean', 'alphabet', 'sleep', 'good-night', 'thanks', 'now', 'today']) {
    assert.ok(starterIds.has(id), `${id} must be available from the first launch`);
  }
  assert.ok(!VOCAB.some(word => word.stage === 'mastered'), 'Curriculum must not award progress from a memory of familiarity');
});

test('sound hints remain separate from spellings and accepted written answers', () => {
  for (const [id, spelling, hint] of [
    ['korean', '한국어', '한구거'],
    ['thanks', '감사합니다', '감사함니다'],
    ['together', '같이', '가치'],
    ['school', '학교', '학꾜'],
    ['not-have', '없어요', '업써요'],
  ]) {
    assert.equal(VOCAB_BY_ID[id].ko, spelling);
    assert.equal(VOCAB_BY_ID[id].pronunciation, hint);
    assert.ok(!VOCAB_BY_ID[id].acceptedKo.includes(hint), `${id}: sound spelling is not standard spelling`);
  }
});

test('every lesson is reachable and all vocabulary is introduced somewhere', () => {
  assert.equal(new Set(LESSONS.map(lesson => lesson.id)).size, LESSONS.length);
  assert.equal(LESSONS.length, 10);
  const allTaught = new Set(LESSONS.flatMap(lesson => lesson.teachVocab));
  for (const word of VOCAB) assert.ok(allTaught.has(word.id), `${word.id} is unreachable through lessons`);

  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    assert.ok(lessonById[id], `Unknown prerequisite lesson: ${id}`);
    assert.ok(!visiting.has(id), `Cycle at lesson: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parentId of lessonById[id].prerequisiteLessons) visit(parentId);
    visiting.delete(id);
    visited.add(id);
  }
  for (const lesson of LESSONS) {
    visit(lesson.id);
    assert.ok(['chat', 'words', 'coffee', 'pin', 'game', 'clock', 'learn'].includes(lesson.icon), `${lesson.id}: unknown app icon key`);
    for (const id of [...lesson.prerequisiteVocab, ...lesson.teachVocab]) {
      assert.ok(VOCAB_BY_ID[id], `${lesson.id} references unknown vocabulary ${id}`);
    }
    assert.ok(lesson.sourceIds.every(id => sourceIds.has(id)), `${lesson.id}: unknown source`);
  }
  assert.equal(visited.size, LESSONS.length);
});

test('challenges are answerable and never rely on vocabulary outside their learning route', () => {
  function availableFor(lesson) {
    const available = new Set([...starterIds, ...lesson.teachVocab]);
    const collect = id => {
      const parent = lessonById[id];
      for (const wordId of parent.teachVocab) available.add(wordId);
      for (const parentId of parent.prerequisiteLessons) collect(parentId);
    };
    lesson.prerequisiteLessons.forEach(collect);
    return available;
  }

  const challengeIds = new Set();
  for (const lesson of LESSONS) {
    const available = availableFor(lesson);
    assert.ok(lesson.challenges.length >= 3 && lesson.challenges.length <= 4);
    for (const challenge of lesson.challenges) {
      assert.ok(!challengeIds.has(challenge.id), `Duplicate challenge: ${challenge.id}`);
      challengeIds.add(challenge.id);
      assert.ok(challenge.prompt && challenge.answer && challenge.explanation);
      assert.equal(new Set(challenge.options).size, challenge.options.length, `${challenge.id}: duplicate option/token`);
      if (challenge.type === 'choose') {
        assert.ok(challenge.options.includes(challenge.answer), `${challenge.id}: answer absent from options`);
      } else if (challenge.type === 'order') {
        assert.deepEqual(
          [...challenge.options].sort(),
          challenge.answer.split(' ').sort(),
          `${challenge.id}: order puzzle cannot produce the answer`,
        );
        assert.equal(new Set(challenge.acceptedAnswers).size, challenge.acceptedAnswers.length, `${challenge.id}: repeated accepted alternative`);
        assert.ok(!challenge.acceptedAnswers.includes(challenge.answer), `${challenge.id}: redundant canonical answer`);
        for (const alternative of challenge.acceptedAnswers) {
          assert.deepEqual([...challenge.options].sort(), alternative.split(' ').sort(), `${challenge.id}: alternative cannot be built from the available tokens`);
        }
      } else assert.fail(`Unknown challenge type: ${challenge.type}`);
      for (const id of challenge.vocabIds) {
        assert.ok(VOCAB_BY_ID[id], `${challenge.id}: unknown vocabulary ${id}`);
        assert.ok(available.has(id), `${challenge.id}: ${id} has not been introduced on this route`);
      }
    }
  }
});

test('only the opening lesson is ready for a learner without any progress', () => {
  const recommendations = recommendLessons(VOCAB.filter(word => word.starter).map(word => ({ id: word.id, stage: 'new' })));
  assert.deepEqual(recommendations.filter(lesson => lesson.ready).map(lesson => lesson.id), ['first-hello']);
  assert.equal(recommendations[0].id, 'first-hello');
});

test('lesson completion and learned vocabulary both influence the next recommendations', () => {
  const cards = [{ id: 'thanks', stage: 'learning' }, { id: 'hello', stage: 'new' }];
  const withoutCompletedIntro = recommendLessons(cards);
  assert.equal(withoutCompletedIntro.find(lesson => lesson.id === 'cafe-stop').ready, false);

  const afterIntro = recommendLessons(cards, ['first-hello']);
  assert.equal(afterIntro[0].id, 'cafe-stop');
  assert.equal(afterIntro.find(lesson => lesson.id === 'cafe-stop').ready, true);
  const badge = afterIntro.find(lesson => lesson.id === 'name-badge');
  assert.equal(badge.ready, false);
  assert.deepEqual(badge.missingVocabIds, ['hello']);

  const afterRecall = recommendLessons([{ id: 'hello', stage: 'mastered' }, ...cards.filter(card => card.id !== 'hello')], ['first-hello']);
  assert.equal(afterRecall.find(lesson => lesson.id === 'name-badge').ready, true);
});

test('completed lessons can be replayed after card removal and recommendation does not mutate state', () => {
  const cards = [{ id: 'thanks', stage: 'learning' }];
  const completed = ['first-hello', 'cafe-stop'];
  const cardsBefore = JSON.stringify(cards);
  const completedBefore = JSON.stringify(completed);
  const result = recommendLessons([], completed);
  const cafe = result.find(lesson => lesson.id === 'cafe-stop');
  assert.equal(cafe.completed, true);
  assert.equal(cafe.ready, true);
  recommendLessons(cards, completed);
  assert.equal(JSON.stringify(cards), cardsBefore);
  assert.equal(JSON.stringify(completed), completedBefore);
  assert.ok(LESSONS.every(lesson => !Object.hasOwn(lesson, 'ready')));
});

test('recommendations accept the public engine card.status interface directly', () => {
  const cards = [{ id: 'thanks', status: 'learning' }, { id: 'hello', status: 'new' }];
  const result = recommendLessons(cards, ['first-hello']);
  assert.equal(result.find(lesson => lesson.id === 'cafe-stop').ready, true);
  assert.equal(result.find(lesson => lesson.id === 'name-badge').ready, false);
});

test('time-first and place-first grammatical arrangements are explicitly accepted', () => {
  const challenges = Object.fromEntries(LESSONS.flatMap(lesson => lesson.challenges).map(challenge => [challenge.id, challenge]));
  assert.ok(challenges['lunch-3'].acceptedAnswers.includes('오늘 저는 빵을 먹어요.'));
  assert.ok(challenges['plan-2'].acceptedAnswers.includes('오늘 저는 집에 가요.'));
  assert.ok(challenges['map-3'].acceptedAnswers.includes('여기 문이 있어요.'));
  assert.ok(!challenges['pack-2'].acceptedAnswers.includes('두 사과 개 주세요.'));
});

test('story quests retain all ten existing lesson IDs used by saved progress', () => {
  const legacyChallengePrefixes = [
    ['first-hello', 'hello'], ['name-badge', 'badge'], ['cafe-stop', 'cafe'],
    ['inventory', 'inventory'], ['find-the-cafe', 'map'], ['lunch-break', 'lunch'],
    ['small-plan', 'plan'], ['play-together', 'play'], ['language-mission', 'language'],
    ['pack-the-quest', 'pack'],
  ];
  assert.deepEqual(LESSONS.map(lesson => lesson.id), legacyChallengePrefixes.map(([id]) => id));
  for (const [id, prefix] of legacyChallengePrefixes) {
    assert.deepEqual(lessonById[id].challenges.map(challenge => challenge.id), [1, 2, 3, 4].map(number => `${prefix}-${number}`), `${id}: preserve the four existing challenges`);
  }
  assert.ok(LESSONS.every(lesson => lesson.quest), 'Every existing lesson needs a scene');
});

test('recurring characters have Korean names and supported geometric appearances', () => {
  const expectedCharacterIds = ['townkeeper', 'courier', 'cook', 'bookseller', 'rival'];
  const requiredAppearanceKeys = ['body', 'outfit', 'outfitStyle', 'accent', 'hat', 'hatColor', 'hatAccent'];
  const optionalAppearanceFields = {
    archetype: ['quartermaster', 'scout', 'provisioner', 'archivist', 'delver'],
    expression: ['stern', 'focused', 'skeptical', 'calm', 'smirk'],
    signatureProp: ['ledger', 'compass', 'ladle', 'scroll', 'sword'],
  };
  assert.deepEqual(Object.keys(CHARACTERS).sort(), expectedCharacterIds.sort());
  for (const [id, character] of Object.entries(CHARACTERS)) {
    assert.equal(character.id, id, `${id}: registry identity mismatch`);
    assert.match(character.name, /^[가-힣]+$/u, `${id}: character names must use Korean script`);
    assert.ok(character.role.trim() && character.bio.trim(), `${id}: missing reusable town-notebook text`);
    const appearance = character.appearance;
    assert.deepEqual(Object.keys(appearance).filter(key => !Object.hasOwn(optionalAppearanceFields, key)).sort(), [...requiredAppearanceKeys].sort());
    for (const [field, supported] of Object.entries(optionalAppearanceFields)) {
      if (Object.hasOwn(appearance, field)) assert.ok(supported.includes(appearance[field]), `${id}: unsupported ${field}`);
    }
    for (const color of ['body', 'outfit', 'accent', 'hatColor', 'hatAccent']) {
      assert.match(appearance[color], /^#[0-9A-Fa-f]{6}$/, `${id}: unsupported ${color} color`);
    }
    assert.ok(['tee', 'scarf', 'hoodie', 'cape'].includes(appearance.outfitStyle), `${id}: unsupported outfit`);
    assert.ok(['none', 'beanie', 'cap', 'wizard', 'flower-crown'].includes(appearance.hat), `${id}: unsupported hat`);
    assert.equal(LESSONS.filter(lesson => lesson.quest.npcId === id).length, 2, `${id}: character should recur in two existing quests`);
  }
});

test('the recurring fantasy cast provides distinct role silhouettes and signature props', () => {
  const propByArchetype = {
    quartermaster: 'ledger', scout: 'compass', provisioner: 'ladle', archivist: 'scroll', delver: 'sword',
  };
  const appearances = Object.values(CHARACTERS).map(character => character.appearance);
  assert.deepEqual(appearances.map(appearance => appearance.archetype).sort(), Object.keys(propByArchetype).sort());
  for (const appearance of appearances) {
    assert.ok(appearance.expression, `${appearance.archetype}: missing facial treatment`);
    assert.equal(appearance.signatureProp, propByArchetype[appearance.archetype], `${appearance.archetype}: mismatched portrait prop`);
  }
});

test('quest steps align with challenges and dialogue reuses reviewed Korean', () => {
  const normalizeLine = value => String(value || '').normalize('NFC').trim().replace(/[.!?…]+$/u, '');
  const reviewedLines = new Set([
    ...VOCAB.flatMap(word => [word.ko, word.politeForm, word.example?.ko]),
    ...LESSONS.flatMap(lesson => [
      ...lesson.grammar.examples.map(example => example.ko),
      ...lesson.challenges.flatMap(challenge => [challenge.ko, challenge.answer, ...(challenge.acceptedAnswers || [])]),
    ]),
  ].filter(line => typeof line === 'string' && /[가-힣]/u.test(line)).map(normalizeLine));

  function assertDialogue(dialogue, label, optional = false) {
    assert.equal(typeof dialogue.ko, 'string', `${label}: missing Korean field`);
    assert.equal(typeof dialogue.en, 'string', `${label}: missing translation field`);
    assert.equal(Boolean(dialogue.ko.trim()), Boolean(dialogue.en.trim()), `${label}: incomplete dialogue pair`);
    if (!optional) assert.ok(dialogue.ko.trim(), `${label}: a checked challenge needs its model line`);
    if (dialogue.ko) {
      assert.doesNotMatch(dialogue.ko, /[A-Za-z]/, `${label}: Korean dialogue must not be romanized`);
      assert.ok(reviewedLines.has(normalizeLine(dialogue.ko)), `${label}: dialogue introduces unreviewed Korean`);
    }
  }

  for (const lesson of LESSONS) {
    const quest = lesson.quest;
    assert.ok(CHARACTERS[quest.npcId], `${lesson.id}: unresolved character reference`);
    assert.ok(quest.location.trim() && quest.objective.trim(), `${lesson.id}: missing scene context`);
    assert.ok(quest.intro.text.trim() && quest.outro.text.trim(), `${lesson.id}: missing opening or ending`);
    assertDialogue(quest.intro, `${lesson.id} introduction`, true);
    assertDialogue(quest.outro, `${lesson.id} ending`);
    assert.equal(quest.steps.length, lesson.challenges.length, `${lesson.id}: story/challenge alignment mismatch`);
    assert.equal(quest.steps.length, 4, `${lesson.id}: keep the existing four challenges`);
    for (const [index, step] of quest.steps.entries()) {
      assert.ok(step.text.trim(), `${lesson.id} step ${index}: missing situation`);
      assert.doesNotMatch(step.text, /[가-힣]/u, `${lesson.id} step ${index}: keep model Korean in the after-check field`);
      assertDialogue(step.after, `${lesson.id} step ${index}`);
    }
    if (quest.intro.ko) {
      for (const challenge of lesson.challenges) {
        for (const line of [challenge.ko, challenge.answer, ...(challenge.acceptedAnswers || [])]) {
          if (typeof line === 'string' && /[가-힣]/u.test(line)) {
            assert.notEqual(normalizeLine(quest.intro.ko), normalizeLine(line), `${lesson.id}: opening dialogue reveals a challenge line with its translation`);
          }
        }
      }
    }
  }
});
