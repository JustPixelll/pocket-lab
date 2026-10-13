# Korean practice at Greybridge Outpost

## The idea

Greybridge is a frontier outpost with dispatches to sort, gear to account for, and road crews waiting to leave. Your character takes on these errands through ten quests. Each has a named location, someone who needs a specific job done, and four Korean challenges that advance the scene.

The first version uses an authored bank of 60 words and expressions across ten lessons. It recommends lessons using your actual vocabulary progress and completed adventures. This keeps the grammar bounded and reviewable while still letting the path respond to what you have practiced.

The presentation is stylized fantasy: a quartermaster with a loan ledger, a scout with a dispatch bag, an archive full of overdue returns, and a delver checking supplies before a watchtower contract. The cast speaks directly and has practical reasons to involve you. These are episodic jobs at one outpost; each stands on its own within the existing learning path.

There are **exactly ten initial quests**. Their stable IDs, Korean teaching content, answers, grammar, prerequisites, and saved progress remain in place. New English titles, scene narration, and selected prompt framing give the existing exercises a purpose in the setting. A completion resolves the current errand through its closing scene.

## The people at camp

The same five characters appear twice each across the ten quests. Their names stay in 한글, with English roles and biographies. Each has a distinct appearance, expression, and signature prop for the portrait renderer, independent of the appearance you choose for your own character.

| Character | Role | Existing quests |
| --- | --- | --- |
| 다온 | Quartermaster; stern, ledger in hand, exact about borrowed gear | The Gate Ledger; The Stores Ledger |
| 하루 | Scout; focused, compass at hand, unwilling to accept vague route details | Names on the Roster; Tomorrow’s Dispatch |
| 보리 | Provisioner; skeptical, ladle ready, expects an honest food report | Orders at the Brass Kettle; Rations for the Road |
| 소담 | Archivist; reserved, scroll in hand, remembers every missing return | The Backstreet Route; The Unmarked Return |
| 나래 | Delver; a competing adventurer with a sword and a methodical approach to supplies | A Seat at the Table; Before the North Gate |

The cast notebook at camp can show each portrait, biography, and links to these existing quests. The quest board groups the opening bank as Chapter I. Returning to a character keeps the setting familiar and brings you back to the same learning requirements.

## A useful first session

1. Start with **The Gate Ledger**. Meet the quartermaster, listen to the examples, and complete its four choices. Your starter list already contains the seven words and phrases you practiced before, but their mastery starts unscored.
2. Open **Speak** and recall a few words in both directions. Korean stays in Korean script. In the English-to-Korean direction, dictionary-form verbs such as 자다 are practiced separately from the polite forms used in sentences.
3. Try **Names on the Roster** or **Orders at the Brass Kettle** when their prerequisites are ready. Each lesson adds its useful vocabulary to your list for later practice.
4. Open a word to hear its normal Korean spelling, inspect a Korean-script pronunciation hint when one is available, and read its example. Use **Write** for a short drawing break.

The aim is to finish a useful interaction. A lesson can be revisited whenever you want. Its puzzles teach understanding; separate vocabulary recall builds the evidence for mastery.

## The first ten adventures

| Quest | Job at the outpost | Main pattern |
| --- | --- | --- |
| The Gate Ledger | Borrow a route map from the quartermaster at Greybridge Gatehouse | 안녕하세요 · 감사합니다 · 죄송해요 |
| Names on the Roster | Register a clear introduction for the scout’s dispatches at Rook Post | 저는 …이에요 / …예요 |
| Orders at the Brass Kettle | Collect the waiting road crew’s drinks without mixing up the orders | 물 주세요 |
| The Stores Ledger | Check loaned equipment against the quartermaster’s records | 열쇠가 있어요 · 검이 없어요 |
| The Backstreet Route | Trace the café contact holding an overdue archive packet | 어디에 있어요? |
| Rations for the Road | Test a departure meal and report to the provisioner | 밥을 먹어요 · 물을 마셔요 |
| Tomorrow’s Dispatch | Sort route and rest updates before the scout seals the bag | 오늘 집에 가요 |
| A Seat at the Table | Set up a game with the delver while the contract board is closed | 같이 게임을 해요 |
| The Unmarked Return | Identify a returned object for the Lantern Archive’s catalogue | 이거 뭐예요? · 한국어를 배워요 |
| Before the North Gate | Check provisions and keys for the delver’s watchtower inspection | 한 개 · 두 개 |

Introductions and the café form the early branches. They feed into the inventory and lunch lessons. From there, the path opens into locations, plans, playing together, language questions, and packing supplies. Required earlier lessons keep grammar introductions in a sensible order.

## How it adapts

A word you just added is **new**. After you begin testing it, it is **learning**. **Mastered** depends on successful recall in both directions across multiple days; rapid repetition alone does not provide the same evidence. A missed review brings a mastered word back into learning. The review engine changes which words appear using their progress and review timing.

A lesson vocabulary prerequisite accepts a word you have begun learning or already mastered. You do not need to make the entire previous lesson's word list green before continuing. Required earlier adventures must also be completed. The lesson screen identifies the words or adventures that are still missing, so there is a concrete next step.

The lesson puzzles accept explicitly listed grammatical alternative word orders. The primary example remains an uncomplicated beginner model; some accepted alternatives change emphasis. Korean does not have only one valid order for every sentence.

Each challenge now has a brief situation in English, followed by a model Korean line after the answer is checked. The model line is practice dialogue and may be the learner's own line, rather than something the other character says. Opening dialogue avoids giving a quiz answer together with its translation. The first greeting quest opens with narration alone, because that conversation is what the learner is about to practice.

The fantasy setting changes the reason for an exchange, not the meaning of its Korean. The Brass Kettle includes a café, the dispatch exercise still refers to a school and home, and the delver’s table activity is a game. English flavour dialogue is authored fiction; its wording is separate from each displayed Korean line and that line’s translation.

## What the adventure layer implements

Chapter I supplies a fixed opening scene, four challenge-aligned story beats, and a closing scene for each quest. Five reusable portraits provide the recurring cast. Lesson progress and vocabulary progress determine what is available on the quest board.

Gear, dispatches, meals, and contracts provide the fictional context. This version tracks learning progress; it does not simulate a second inventory, combat, travel, or branching contract system. Further chapters can reuse the cast and prerequisites after their Korean content has been written and checked.

## Your own vocabulary

Words or phrases collected through translation enter the same vocabulary review process as other saved cards. Keep their spelling, meaning, and context reviewable because automatic translation can choose an unintended sense. A word such as 차 needs its intended meaning: tea and a vehicle are different learning targets despite sharing a spelling.

The first lesson bank adapts within its prepared content. Saving an unrelated new translated phrase does **not** automatically generate a fresh grammar lesson about it. Extending the authored bank with more scenarios is a practical next step and can reuse the existing progress system.

## What counts as feedback

Vocabulary speech practice checks a transcript that you can inspect and correct. It is a recall exercise, not an accent or phoneme assessment. Korean audio comes from the phone's available speech service. The pronunciation hints use Korean script and remain separate from the correct written spelling.

Handwriting practice is a place to draw and compare shapes. Recognition can suggest what the phone read, but a matching result does not establish correct stroke order or good penmanship. Those would need separate, specifically designed exercises.

See [curriculum-sources.md](curriculum-sources.md) for the source checks, pronunciation notes, and the exact curriculum data contract.
