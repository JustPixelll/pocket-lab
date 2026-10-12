import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOCAB, VOCAB_BY_ID, LESSONS, CURRICULUM_SOURCES, recommendLessons,
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
