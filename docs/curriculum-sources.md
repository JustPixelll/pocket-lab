# Korean curriculum: scope, sources, and grading notes

Version 1. Prepared 2026-10-12.

## What is bundled

The app contains 60 beginner vocabulary entries and ten authored micro-lessons with four challenges each. Twelve vocabulary cards are active at first launch. Those include the learner's seven previously practiced items: 한국어, 한글, 자다, 안녕히 주무세요, 감사합니다, 지금, 오늘. Familiarity from a previous conversation does not assign a learning score or mastery.

The lessons cover greetings, introductions, requests in a café, a game inventory, locations, meals, simple plans, an invitation to play, identifying an object, and counting one or two items. They reuse a small group of everyday polite patterns. Every vocabulary item is introduced by at least one lesson. The examples and explanations are written for this app, rather than reproduced from a textbook or a dictionary corpus.

The lesson bank is fixed and available offline. Its selection adapts to active vocabulary progress and completed lessons; it does not invent new grammar or generate unrestricted lesson content. It is a compact starting curriculum and has not undergone an independent native-speaker editorial review.

## Sources used for checks

General lexical reference: [National Institute of Korean Language, Korean–English Learners' Dictionary](https://krdict.korean.go.kr/eng/mainAction). The app links to this reference; it does not bundle the dictionary database or its audio recordings. Linking the dictionary as a general reference is not a claim that every authored example is a dictionary quotation.

Specific pronunciation and grammar checks:

| Topic | Primary reference | How the app uses it |
| --- | --- | --- |
| 한국어 | [Dictionary entry](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=26910) | Reading hint 한구거, with dictionary vowel length omitted. |
| 학교 | [Dictionary entry](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=73276) | Reading hint 학꾜. |
| 열쇠 | [Dictionary search](https://krdict.korean.go.kr/eng/dicMarinerSearch/search?mainSearchWord=%EC%97%B4%EC%87%A0&nation=eng) | Records both 열쐬 and 열쒜. |
| 같이 | [National Institute pronunciation explanation](https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=327454) | Reading hint 가치. |
| 맛있다 / 맛있어요 | [Dictionary inflection entry](https://krdict.korean.go.kr/m/eng/searchResultView?ParaWordNo=70811&currentPage=1&exaType=&font_size=12&mainSearchWord=%EB%A7%9B&nation=eng&nationCode=6&proverbType=&searchType=W&sort=W&viewType=A&wordMatchFlag=N) and [National Institute pronunciation explanation](https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=9036&mn_id=21&pageIndex=1) | Both 마시써요 and 마디써요 are represented. |
| 좋아 | [National Institute explanation](https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=317245) | The reading hint for 좋아요 is 조아요. |
| 괜찮다 | [Dictionary result](https://krdict.korean.go.kr/m/eng/searchResult?displayNum=10&divSearch=search&examples=&mainSearchWord=%EA%B4%9C%EC%B0%AE%EB%8B%A4&nation=eng&nationCode=6&pageNo=1&preKeyword=&proverb=&sort=) | Meaning and base pronunciation; the polite example uses 괜찮아요. |
| 없어 | [National Institute phonology discussion](https://www.korean.go.kr/nkview/nklife/1993_1/3_1.html) | The polite form has reading hint 업써요. |
| 이에요 / 예요 | [National Institute explanation](https://korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=308945) | Teach the common vowel-ending contraction 예요 and consonant-ending 이에요. Do not claim full 이에요 is categorically impossible after every vowel-ending noun. |
| 은 | [Dictionary entry](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=86111) | Explain topic use with a short note about contrast; avoid equating it with English “is”. |
| 을 | [Dictionary entry](https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=86355&nation=eng) | Teach object marking in the specific eating, drinking, playing, and learning patterns. |
| 학교에 가다 | [National Institute explanation](https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=318644) | Teach 에 as the destination marker in the beginner pattern. |
| Number forms before counters | [National Institute beginner textbook, counting table](https://korean.go.kr/common/download.do%3Bfront%3D5F080AC99A51E3FBDDED6C1224B875FB?c_file_name=c4b897e3-3c46-4c8b-bf5d-b28abbe3a789_1.pdf&file_path=etcData&o_file_name=%EC%B2%AB%EA%B1%B8%EC%9D%8C.pdf) | Teach 하나 → 한 개 and 둘 → 두 개. |

These references support the stated checks. Not every pronunciation was separately retrieved as an individual dictionary entry. No external content is fetched to run the bundled lessons.

## Writing, sound, and speech practice

- Korean vocabulary, Korean answer variants, and pronunciation hints use Korean script. No Latin transliteration is supplied.
- `ko` is the normal spelling. `pronunciation` is an optional Korean-script reading hint. For example, 한국어 remains the spelling even when the hint says 한구거. The answer lists do not accept sound-hint spellings as normal written Korean.
- Read hints as broad pronunciation aids, not a complete phonetic transcription. Dictionary vowel-length marks are omitted. Not every contextual sound change in a whole sentence is transcribed.
- Text-to-speech should speak the normal `ko` string. Sending the reading hint to a speech engine can distort its own pronunciation rules.
- Dictionary-form verbs retain their dictionary target: 자다, 먹다, 마시다, 가다, 오다, 보다, 하다, 배우다. Their `politeForm` and contextual examples teach the corresponding forms used in these lessons. Prompting for “to eat” should make the dictionary-form expectation clear instead of treating an inflected response as a pronunciation failure.
- English synonyms and small sets of equivalent Korean expressions are accepted where appropriate. A synonym is a valid meaning recall; it does not demonstrate recall of every syllable of the displayed target expression.
- A speech recognizer's transcript supports a vocabulary recall check. It cannot establish pronunciation mastery, native accent, or a reliable phoneme score. Recognition failure should allow the learner to retry or correct the transcript.
- Short expressions such as 있어요 and 없어요 have context-dependent English meanings. Their examples explain which sense a drill is practicing. 차 and 사과 use explicitly selected senses.

## Adaptation contract

`recommendLessons(cards, completedIds)` accepts active cards shaped as `{ id, stage }`, where `stage` is `new`, `learning`, or `mastered`. It also accepts the public progress-engine field `status` when `stage` is absent. `completedIds` is an array or set of successful lesson IDs.

A vocabulary prerequisite is met by a learning or mastered card. Adding a new card alone does not meet it. Required earlier lessons must also be completed. Each returned lesson includes `ready`, `completed`, `missingVocabIds`, `missingLessonIds`, `knownCount`, and a short `reason`. Ready unfinished lessons come first, then locked lessons with the fewest missing requirements, then completed lessons. Completed lessons remain available for replay if a vocabulary card is later removed.

Starting a lesson may add its `teachVocab` cards for later vocabulary practice. Lesson completion should require success on its challenges. Multiple-choice recognition or sentence ordering should not by itself award the same mastery evidence as independent spoken recall. These choices are implemented by the app's progress engine; the curriculum itself never assigns scores.

Each challenge uses `{ id, type, prompt, ko?, answer, options, explanation, vocabIds }`. For `choose`, the answer is exactly one option. For `order`, options are unique space-delimited word blocks and their canonical joined order equals the answer. `acceptedAnswers` lists additional grammatical arrangements of those exact blocks. The first model is a straightforward beginner order; some alternatives place stronger emphasis on the earlier object, topic, or time. The app should compare an order response against both `answer` and `acceptedAnswers`. The list does not cover every possible paraphrase or different sentence construction.

## Validation

The curriculum tests check the lesson dependency graph, vocabulary reachability, the twelve-card starter set, Korean-only spellings and sound hints, answerability of every puzzle, preservation of spelling versus sound hints, actual progress-dependent recommendations, replay behavior, and lack of state mutation. They cannot replace a linguistic editorial review.
