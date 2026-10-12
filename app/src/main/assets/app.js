import { createStore, evaluateAnswer } from './engine.js';
import { VOCAB, LESSONS, recommendLessons } from './data/curriculum.js';
import { native, isAndroid } from './native.js';
import { icon } from './icons.js';

const $ = (selector, root = document) => root.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = status => ({ new: 'New', learning: 'Learning', mastered: 'Mastered' }[status] || 'New');
const languageName = lang => lang === 'ko' ? 'Korean' : 'English';
const sourceById = new Map(VOCAB.map(word => [word.id, word]));
const NAV = [['learn', 'Learn', 'learn'], ['write', 'Write', 'write'], ['speak', 'Speak', 'mic'], ['words', 'Words', 'words'], ['translate', 'Translate', 'translate']];
let store;
let capabilities = { platform: isAndroid ? 'android' : 'browser', translationReady: false, inkReady: false };
let route = 'learn';
let modalOpener = null;
let modalRevision = 0;
let modalKind = '';
let toastTimer;
let wordFilter = 'all';
let wordQuery = '';
let practice = null;
let lessonRun = null;
let inputMode = 'voice';
let practiceDirection = 'mixed';
let translation = { source: 'en', target: 'ko', input: '', translatedInput: '', output: '', selection: '', busy: false };
let writing = { group: 'syllables', target: '가', showGuide: true, strokes: [], activeStroke: null, feedback: '', candidates: [], lastWidth: 0, lastHeight: 0, revision: 0 };
let lessonFeedback = null;
let speechToken = 0;
const jamo = {
  syllables: ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하', '한', '글', '말', '물', '밥', '집', '잠'],
  consonants: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'],
  vowels: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅒ', 'ㅔ', 'ㅖ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ']
};

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4300);
}
function handleError(error) {
  if (error.code === 'CANCELLED') return;
  toast(error.message || 'Something went wrong. Your saved progress is still here.');
}
function safeMutation(fn) { try { const result = fn(); updateHeader(); return result; } catch (error) { handleError(error); return null; } }
function button(action, text, style = '', symbol = '', attrs = '') { return `<button class="button ${style}" data-action="${action}" ${attrs}>${symbol ? icon(symbol) : ''}${text}</button>`; }
function intro(kicker, title, description) { return `<div class="page-intro"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>`; }
function statusTag(card) { return `<span class="tag ${card.status === 'learning' ? 'yellow' : card.status === 'new' ? 'neutral' : ''}"><i class="dot ${card.status}"></i>${label(card.status)}</span>`; }
function updateHeader() {
  const stats = store.getStats();
  $('#streak').innerHTML = `${icon('flame')} ${stats.streak || 0} day${stats.streak === 1 ? '' : 's'}`;
  $('#settings-button').innerHTML = icon('settings');
}
function updateNav() {
  $('#nav').innerHTML = NAV.map(([id, title, symbol]) => `<a href="#${id}" class="nav-item ${id === route ? 'active' : ''}" ${id === route ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${title}</span></a>`).join('');
}
function lessonsWithReadiness() {
  const canonicalProgress = VOCAB.map(meta => { const owned = ownedForVocab(meta.id); return owned ? { id: meta.id, stage: owned.status } : null; }).filter(Boolean);
  return recommendLessons(canonicalProgress, Object.keys(store.getLessonProgress()));
}
function ownedForVocab(id) {
  const meta = sourceById.get(id);
  const direct = store.getCard(id);
  if (direct) return direct;
  if (!meta) return null;
  return store.getCards().find(card => card.ko.normalize('NFC').replace(/\s+/g, '') === meta.ko.normalize('NFC').replace(/\s+/g, '') && (evaluateAnswer(meta, 'koToEn', card.en).correct || evaluateAnswer(card, 'koToEn', meta.en).correct)) || null;
}
function collectCurated(id) {
  const owned = ownedForVocab(id);
  return owned || safeMutation(() => store.addCard(sourceById.get(id)));
}
function render() {
  updateHeader(); updateNav();
  const main = $('#main');
  if (route === 'learn') renderLearn(main);
  else if (route === 'words') renderWords(main);
  else if (route === 'speak') renderSpeak(main);
  else if (route === 'translate') renderTranslate(main);
  else if (route === 'write') renderWrite(main);
}
function navigate(next) {
  speechToken++;
  closeModal();
  native('stopListening').catch(() => {});
  native('stopSpeaking').catch(() => {});
  if (practice) practice.listening = false;
  route = NAV.some(n => n[0] === next) ? next : 'learn';
  if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderLearn(main) {
  if (lessonRun) return renderLesson(main);
  const stats = store.getStats();
  const dailyGoal = Number(store.getSettings().dailyGoal || 10);
  const daily = stats.today?.attempts || 0;
  const lessons = lessonsWithReadiness();
  const done = Object.keys(store.getLessonProgress()).length;
  main.innerHTML = `${intro('Your little language notebook', 'A little Korean, every day.', 'Build your vocabulary. Find your voice. Make the words your own.')}
    <div class="hero"><span class="eyebrow">Your daily practice</span><h2 lang="ko">오늘도 한 걸음.</h2><p>One more step today.<br>${stats.due ? `${stats.due} words are ready for another visit.` : 'A few small moments make a language feel familiar.'}</p>
      <div class="hero-art" aria-hidden="true"><div class="hero-orbit"></div><div class="hero-orbit second"></div><span class="letter-tile back" lang="ko">가</span><span class="letter-tile" lang="ko">한</span><span class="small-spark">✳</span></div>
      ${button('start-practice', 'Let’s practice', 'light', 'arrow')}
    </div>
    <div class="stats-row"><div class="stat"><b>${stats.total}</b><span>Words collected</span></div><div class="stat"><b>${stats.learning}</b><span>Taking root</span></div><div class="stat mastered"><b>${stats.mastered}</b><span>Mastered</span></div></div>
    <div class="section-head"><h2>Your next little adventures</h2><span class="muted tiny">${done} / ${LESSONS.length}</span></div>
    <div class="lesson-list">${lessons.map((lesson, i) => `<button class="lesson-card" data-action="open-lesson" data-id="${escape(lesson.id)}"><span class="lesson-icon ${i % 3 === 1 ? 'gold' : i % 3 === 2 ? 'coral' : ''}">${icon(lesson.icon)}</span><div class="lesson-content"><h3>${escape(lesson.title)}</h3><p>${escape(lesson.subtitle)}</p><div class="lesson-meta">${lesson.completed ? `${icon('check')} Revisit anytime` : lesson.ready ? '<span class="tag">Ready for you</span>' : `<span class="tag neutral">${(lesson.missingLessonIds || []).length ? 'A step to work toward' : `${(lesson.missingVocabIds || []).length} words to explore`}</span>`}<span>4 little challenges</span></div></div>${icon('chevron')}</button>`).join('')}</div>
    <div class="section-head"><h2>Small steps count</h2></div><div class="daily-goal"><div><h3>Today’s word practice</h3><p>${Math.min(daily, dailyGoal)} of ${dailyGoal} reviews · no need to rush</p></div><div class="goal-ring" style="--progress:${Math.min(100, 100 * daily / dailyGoal)}%"><span>${daily}/${dailyGoal}</span></div></div>
    <p class="footer-note">${icon('leaf')} A notebook that grows with you.</p>`;
}

function renderWords(main) {
  const stats = store.getStats();
  main.innerHTML = `${intro('Collected, practiced, remembered', 'Your word garden.', 'Every word starts somewhere. Tap one to hear it, see an example, and follow its progress.')}
    <div class="search-wrap">${icon('search')}<input id="word-search" class="input" type="search" placeholder="Find a word or meaning" aria-label="Search vocabulary" value="${escape(wordQuery)}"></div>
    <div class="filter-row">${[['all', 'All', stats.total], ['new', 'New', stats.new], ['learning', 'Learning', stats.learning], ['mastered', 'Mastered', stats.mastered]].map(([id, title, count]) => `<button class="filter ${wordFilter === id ? 'active' : ''}" data-action="word-filter" data-filter="${id}">${id === 'all' ? '' : `<i class="dot ${id}"></i>`}${title} · ${count}</button>`).join('')}</div>
    <div class="button-row equal space-bottom">${button('new-word', 'Add a word', 'outline small', 'plus')}${button('browse-vocab', 'Explore starter words', 'outline small', 'learn')}</div>
    <div id="vocab-results" class="vocab-list"></div><p class="footer-note">Black · new &nbsp; Yellow · learning &nbsp; Green · mastered</p>`;
  updateWordResults();
}
function updateWordResults() {
  const needle = wordQuery.toLocaleLowerCase().trim();
  const cards = store.getCards().filter(c => (wordFilter === 'all' || c.status === wordFilter) && (!needle || `${c.ko} ${c.en} ${(c.acceptedEn || []).join(' ')}`.toLocaleLowerCase().includes(needle)));
  const results = $('#vocab-results'); if (!results) return;
  results.innerHTML = cards.length ? cards.map(c => `<button class="vocab-row ${c.status}" data-action="word-detail" data-id="${escape(c.id)}"><div class="word-info"><div class="word ko" lang="ko">${escape(c.ko)}</div><div class="meaning">${escape(c.en)}</div></div><span class="status-text">${statusTag(c)}</span>${icon('chevron')}</button>`).join('') : `<div class="empty">${icon('words')}<h3>No words here yet</h3><p>Try another search, or collect your next word.</p></div>`;
}
function showWord(id) {
  const card = store.getCard(id); if (!card) return;
  showModal('A closer look', `${statusTag(card)}<div class="detail-word ko" lang="ko">${escape(card.ko)}</div><p class="detail-meaning">${escape(card.en)}</p>${card.pronunciation ? `<p class="sound-hint" lang="ko">[${escape(card.pronunciation)}]</p><p class="pronunciation-note">Sound hint in 한글. Keep using the spelling above when you write.</p>` : '<p class="pronunciation-note">Listen to the Korean audio for pronunciation.</p>'}
    <div class="button-row space-top">${button('play-word', 'Listen', 'secondary', 'volume', `data-id="${escape(id)}"`)}${button('play-word-slow', 'Slower', 'outline', '', `data-id="${escape(id)}"`)}</div>
    ${card.example?.ko ? `<div class="example-block"><div lang="ko" class="ko">${escape(card.example.ko)}</div><p>${escape(card.example.en)}</p>${button('play-example', 'Hear example', 'outline small space-top', 'volume', `data-id="${escape(id)}"`)}</div>` : ''}
    ${card.source === 'machine' ? '<p class="word-summary">Collected from a machine translation · check meaning in context</p>' : ''}
    ${card.note ? `<p class="soft-note space-top">${escape(card.note)}</p>` : ''}
    <div class="direction-stats">${['enToKo', 'koToEn'].map(direction => { const p = card.progress?.[direction] || {}; return `<div><strong>${direction === 'enToKo' ? 'English → Korean' : 'Korean → English'}</strong><small>${p.correct || 0} correct · ${p.attempts || 0} attempts</small><div class="progress-line"><span style="width:${Math.min(100, (p.stage || 0) / 3 * 100)}%"></span></div></div>`; }).join('')}</div>
    <p class="status-help">Green means you have recalled this word in both directions over several days. A missed review brings it back for more practice.</p>
    <div class="button-row equal space-top">${button('practice-word', 'Practice this', '', 'mic', `data-id="${escape(id)}"`)}${button('write-word', 'Write it', 'outline', 'write', `data-id="${escape(id)}"`)}</div>
    ${store.updateCard ? button('edit-word', 'Edit meaning & accepted answers', 'outline full space-top', '', `data-id="${escape(id)}"`) : ''}`);
}
function wordForm(seed = {}, editId = '') {
  showModal(editId ? 'Make this word yours' : 'Collect a new word', `<form id="word-form" data-edit-id="${escape(editId)}" data-source="${seed.machineTranslated ? 'machine' : escape(seed.source || 'custom')}">
    <label class="field"><span>Korean spelling</span><input class="input ko" id="new-ko" lang="ko" value="${escape(seed.ko)}" maxlength="150" required ${editId ? 'readonly' : ''} placeholder="한국어"></label>
    <label class="field"><span>English meaning</span><input class="input" id="new-en" lang="en" value="${escape(seed.en)}" maxlength="250" required placeholder="Korean language"></label>
    <label class="field"><span>Other accepted English answers · separate with ;</span><input class="input" id="new-aliases" value="${escape((seed.acceptedEn || []).join('; '))}" maxlength="800" placeholder="Korean; the Korean language"></label>
    <label class="field"><span>Optional pronunciation hint · 한글 only</span><input class="input ko" id="new-pronunciation" lang="ko" value="${escape(seed.pronunciation)}" maxlength="180" placeholder="한구거"></label>
    <label class="field"><span>Optional note or context</span><textarea id="new-note" maxlength="1000" style="min-height:80px">${escape(seed.note)}</textarea></label>
    <p class="soft-note">${seed.machineTranslated ? 'This is a machine translation suggestion. Check the spelling and meaning before saving; you can edit both here.' : 'Use normal Korean spelling. Add alternative English meanings you want spoken practice to accept.'}</p>
    <button class="button full space-top" type="submit">${icon('plus')}${editId ? 'Save changes' : 'Add to my vocabulary'}</button>
    <div id="word-form-error" role="alert"></div></form>`);
}
function saveWord(event) {
  event.preventDefault();
  const form = event.target;
  const ko = $('#new-ko').value.trim();
  const en = $('#new-en').value.trim();
  const pronunciation = $('#new-pronunciation').value.trim();
  if (!/[\uAC00-\uD7A3\u3131-\u318E]/u.test(ko) || /[A-Za-z]/u.test(ko)) return showFormError('Write the Korean entry in 한글, without romanization.');
  if (pronunciation && /[^\uAC00-\uD7A3\u3131-\u318E\s()[\]·.,!?…-]/u.test(pronunciation)) return showFormError('Pronunciation hints use 한글 only. You can leave this blank and use the audio.');
  const patch = { ko, en, acceptedEn: $('#new-aliases').value.split(';').map(s => s.trim()).filter(Boolean), pronunciation, note: $('#new-note').value.trim(), tags: ['collected'], acceptedKo: [ko], source: form.dataset.source || 'custom', sourceIds: form.dataset.source === 'machine' ? ['google-translate'] : [] };
  try {
    const card = form.dataset.editId ? store.updateCard(form.dataset.editId, { en, acceptedEn: patch.acceptedEn, pronunciation, note: patch.note }) : store.addCard(patch);
    practice = null; speechToken++;
    closeModal(); updateHeader(); render(); toast(form.dataset.editId ? 'Word updated. Your reviews are kept.' : `Added ${ko} to your vocabulary.`);
    return card;
  } catch (error) { showFormError(error.message); }
}
function showFormError(message) { $('#word-form-error').innerHTML = `<div class="inline-error">${escape(message)}</div>`; }
function browseVocab() {
  const owned = new Set(VOCAB.filter(c => ownedForVocab(c.id)).map(c => c.id));
  showModal('Find your next words', `<p class="muted tiny space-top">A small, carefully prepared collection. Add the words you want to learn.</p><div class="lesson-list space-top">${VOCAB.map(c => `<button class="lesson-card" data-action="collect-seed" data-id="${escape(c.id)}" ${owned.has(c.id) ? 'disabled' : ''}><div class="lesson-content"><h3 lang="ko" style="font-size:21px">${escape(c.ko)}</h3><p>${escape(c.en)}</p></div>${icon(owned.has(c.id) ? 'check' : 'plus')}</button>`).join('')}</div>`);
}

function newPractice(cardId = '', focusedIds = []) {
  speechToken++;
  const focused = focusedIds.filter(id => store.getCard(id));
  const queue = ['enToKo', 'koToEn'].flatMap(direction => focused.map(id => ({ id, direction })));
  practice = { count: 0, correct: 0, target: queue.length || 10, queue, current: null, direction: practiceDirection, lastCardId: '', answered: false, assisted: false, feedback: null, listening: false, answer: '', alternatives: [], fixedId: cardId, finished: false };
  nextQuestion();
}
function nextQuestion() {
  speechToken++;
  if (!practice) newPractice();
  if (practice.count >= practice.target) { practice.finished = true; return; }
  let selected;
  if (practice.queue?.length) { const item = practice.queue[practice.count]; selected = { card: store.getCard(item.id), direction: item.direction }; }
  else if (practice.fixedId && practice.count === 0) selected = { card: store.getCard(practice.fixedId), direction: practiceDirection === 'koToEn' ? 'koToEn' : 'enToKo' };
  else selected = store.selectNext({ direction: practiceDirection, lastCardId: practice.lastCardId });
  Object.assign(practice, { current: selected, answered: false, assisted: false, feedback: null, answer: '', alternatives: [], listening: false, serviceError: '' });
}
function renderSpeak(main) {
  if (!practice) newPractice();
  if (practice.finished) {
    main.innerHTML = `${intro('A little progress, saved', 'You showed up.', 'That’s how words become familiar. Your next review is already planned.')}<div class="card" style="text-align:center"><div class="success-seal">${icon('leaf')}</div><div class="summary-large">${practice.correct}<span style="font-size:24px;color:var(--muted)"> / ${practice.count}</span></div><p class="muted space-top">recalled without revealing the answer</p>${button('restart-practice', 'Another little round', 'full space-top', 'arrow')}${button('go-words', 'See my vocabulary', 'outline full space-top', 'words')}</div><p class="soft-note space-top">Fast repeats are useful practice. Lasting mastery comes from successful reviews on different days.</p>`;
    return;
  }
  const item = practice.current;
  if (!item?.card) { main.innerHTML = `${intro('Find your voice', 'A word to start with.', 'Collect a word and we’ll help you practice it.')} ${button('go-words', 'Open vocabulary', 'full', 'words')}`; return; }
  const card = item.card;
  const enToKo = item.direction === 'enToKo';
  const prompt = enToKo ? card.en : card.ko;
  const answerLanguage = enToKo ? 'ko' : 'en';
  main.innerHTML = `${intro('Remember it. Say it.', 'Find your voice.', 'See the prompt, recall the word, and say it out loud.')}
    <div class="segmented" aria-label="Practice direction">${[['mixed', 'Both ways'], ['enToKo', 'English → Korean'], ['koToEn', 'Korean → English']].map(([id, text]) => `<button data-action="practice-direction" data-direction="${id}" class="${practiceDirection === id ? 'active' : ''}">${text}</button>`).join('')}</div>
    <div class="practice-head"><span>${practice.count + 1} of ${practice.target} words</span><span>${enToKo ? 'Answer in Korean' : 'Answer in English'}</span></div><div class="progress-line"><span style="width:${practice.count / practice.target * 100}%"></span></div>
    <div class="practice-card"><span class="eyebrow">${enToKo ? 'How do you say…' : 'What does this mean?'}</span><div class="practice-prompt ${enToKo ? '' : 'ko'} ${prompt.length > 20 ? 'long' : ''}" lang="${enToKo ? 'en' : 'ko'}">${escape(prompt)}</div>
      ${enToKo && card.partOfSpeech === 'verb' ? '<p class="practice-hint">Use the dictionary form · ends in 다</p>' : ''}<button class="icon-button bordered" data-action="play-prompt" aria-label="Hear the prompt">${icon('volume')}</button>
      ${!practice.answered ? `<div class="segmented space-top"><button data-action="input-mode" data-mode="voice" class="${inputMode === 'voice' ? 'active' : ''}">Speak it</button><button data-action="input-mode" data-mode="typed" class="${inputMode === 'typed' ? 'active' : ''}">Type it</button></div>
        ${inputMode === 'voice' ? `<button class="mic-button ${practice.listening ? 'listening' : ''}" data-action="listen-answer" aria-label="${practice.listening ? 'Stop recording' : `Speak your answer in ${languageName(answerLanguage)}`}">${icon(practice.listening ? 'stop' : 'mic')}</button><p class="mic-caption">${practice.listening ? 'Listening…' : 'Tap and speak'}</p>` : ''}
        <form id="answer-form"><label class="field" style="text-align:left"><span>${inputMode === 'voice' ? 'I heard · check before submitting' : `Your answer in ${languageName(answerLanguage)}`}</span><input id="practice-answer" class="input ${enToKo ? 'ko' : ''}" lang="${answerLanguage}" value="${escape(practice.answer)}" placeholder="${enToKo ? '한국어로 답하세요' : 'Type the meaning'}" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="300" ${practice.listening ? 'disabled' : ''}></label>
        ${practice.alternatives.length > 1 ? `<div class="choice-alternatives">${practice.alternatives.slice(0, 3).map(a => `<button type="button" data-action="speech-alternative" data-answer="${escape(a)}">${escape(a)}</button>`).join('')}</div>` : ''}
        <button type="submit" class="button full" ${practice.listening ? 'disabled' : ''}>${icon('check')}Check my answer</button></form>
        ${practice.serviceError ? `<div class="inline-error" role="alert">${escape(practice.serviceError)}</div>` : ''}
        <button class="text-button space-top" data-action="reveal-answer">I need a little help · reveal answer</button>` : `<div class="feedback ${practice.feedback?.correct ? '' : 'wrong'}" role="status"><strong>${practice.feedback?.correct ? 'That’s the word.' : practice.assisted ? 'A word to revisit.' : 'Let’s keep this one growing.'}</strong><p class="answer ko" lang="ko">${escape(card.ko)}</p><p>${escape(card.en)}</p><p class="tiny">${escape(practice.feedback?.message || '')}</p>${button('play-answer', 'Hear the Korean', 'outline small', 'volume')}</div>${button('next-question', practice.count >= practice.target ? 'See this round' : 'Next word', 'full', 'arrow')}`}
    </div><p class="soft-note">${icon('info')}Speech checks which word you recalled. Check the transcript before submitting if your phone heard you incorrectly. ${isAndroid ? 'Your phone’s speech service may use the internet.' : 'Microphone practice is available in the Android app; typed practice works here.'}</p>`;
}
function submitAnswer(event) {
  event?.preventDefault();
  if (!practice || practice.answered || practice.listening) return;
  const answer = $('#practice-answer')?.value.trim() || '';
  if (!answer) return toast('Add an answer, or tap “reveal answer” for help.');
  practice.answer = answer;
  const currentCard = store.getCard(practice.current.card.id);
  const result = evaluateAnswer(currentCard, practice.current.direction, answer);
  const saved = safeMutation(() => store.recordAttempt(practice.current.card.id, practice.current.direction, { correct: result.correct, assisted: false, answer, mode: inputMode === 'voice' ? 'voice' : 'typed' }));
  if (!saved) return;
  practice.answered = true; practice.count++; if (saved.correct) practice.correct++;
  practice.lastCardId = practice.current.card.id;
  practice.feedback = { correct: saved.correct, message: saved.correct ? (saved.credited ? 'A successful review, saved to your word history.' : 'Good practice. Another day’s review will help it stick.') : 'This word will come back sooner. The saved meanings are accepted; you can add another valid meaning in Words.' };
  renderSpeak($('#main')); updateHeader();
}
async function listenAnswer() {
  if (!practice || practice.answered) return;
  if (practice.listening) { await native('stopListening').catch(handleError); return; }
  const activePractice = practice;
  const activeQuestion = practice.current;
  const token = ++speechToken;
  practice.listening = true; practice.serviceError = ''; practice.answer = ''; renderSpeak($('#main'));
  try {
    const result = await native('listen', { lang: practice.current.direction === 'enToKo' ? 'ko-KR' : 'en-US', preferOffline: true });
    if (practice !== activePractice || practice.current !== activeQuestion || speechToken !== token || practice.answered || route !== 'speak' || inputMode !== 'voice') return;
    practice.alternatives = result.alternatives || [result.text].filter(Boolean);
    practice.answer = result.text || practice.alternatives[0] || '';
  } catch (error) {
    if (practice === activePractice && speechToken === token && error.code !== 'CANCELLED') practice.serviceError = error.message;
  } finally {
    if (practice === activePractice && speechToken === token) { practice.listening = false; if (route === 'speak') renderSpeak($('#main')); }
  }
}
async function speak(text, lang = 'ko-KR', rate) {
  try { await native('speak', { text, lang, rate: rate || Number(store.getSettings().speechRate || 0.9) }); }
  catch (error) { handleError(error); }
}

function renderTranslate(main) {
  main.innerHTML = `${intro('Turn curiosity into vocabulary', 'A phrase worth keeping.', 'Translate a thought. Collect the words you want to remember.')}
    <div class="translation-top"><span class="language-label">${languageName(translation.source)}</span><button class="icon-button bordered" data-action="swap-languages" aria-label="Swap translation languages" ${translation.busy ? 'disabled' : ''}>${icon('swap')}</button><span class="language-label">${languageName(translation.target)}</span></div>
    <div class="translation-box"><label class="sr-only" for="translation-input">Text to translate</label><textarea id="translation-input" lang="${translation.source}" placeholder="${translation.source === 'en' ? 'What would you like to say?' : '무엇을 말하고 싶어요?'}" maxlength="1500">${escape(translation.input)}</textarea><div class="counter"><span id="translation-count">${translation.input.length}</span> / 1500</div>${button('translate-text', translation.busy ? '<span class="spinner"></span>Translating…' : 'Translate with Google', 'full', translation.busy ? '' : 'translate', translation.busy ? 'disabled' : '')}</div>
    ${!capabilities.translationReady ? modelSetup('translation', 'Your pocket translator', 'Download the Korean translation model once. After that, translation runs on your phone, including offline.') : '<p class="word-summary">Translation model ready · runs on your phone</p>'}
    ${translation.output ? `<section class="translation-box translation-result"><div class="chip-title"><span>${languageName(translation.target)} · automatic translation</span><button class="icon-button" data-action="speak-translation" aria-label="Hear translated text">${icon('volume')}</button></div><div id="translation-output" class="translation-output" lang="${translation.target}">${escape(translation.output)}</div><p class="select-hint">Press and hold to select a word or phrase, then add it below.</p><div class="button-row equal">${button('collect-selection', 'Add selected phrase', 'secondary small', 'plus', 'id="collect-selection" disabled')}${button('collect-translation', 'Add whole phrase', 'outline small', 'plus')}</div><div class="translation-attribution"><img src="google-translate-attribution.png" alt="powered by Google Translate" width="155"></div></section>` : ''}
    <p class="soft-note space-top">A translation is a starting point. You’ll review and edit the Korean and English before a new word enters your list.</p>`;
  translation.selection = '';
}
function modelSetup(which, title, description) {
  return `<div class="setup-box"><h3>${title}</h3><p>${description}</p>${button('prepare-model', 'Download Korean model', 'secondary small', 'download', `data-model="${which}"`)}</div>`;
}
async function translateText() {
  const input = $('#translation-input')?.value.trim() || '';
  if (!input) return toast('Write a word or phrase first.');
  if (translation.source === 'ko' && !/[\uAC00-\uD7A3\u3131-\u318E]/u.test(input)) return toast('Use 한글 for Korean input.');
  translation.input = input;
  if (translation.busy) return;
  const request = { text: input, source: translation.source, target: translation.target };
  translation.busy = true; renderTranslate($('#main'));
  try {
    const result = await native('translate', request);
    if (translation.input.trim() === request.text && translation.source === request.source && translation.target === request.target) { translation.output = result.text; translation.translatedInput = request.text; }
    else { translation.output = ''; toast('The input changed. Tap Translate to translate the new text.'); }
  }
  catch (error) { handleError(error); }
  finally { translation.busy = false; if (route === 'translate') renderTranslate($('#main')); }
}
async function collectTranslation(selected) {
  const snapshot = { ...translation };
  const text = (selected ? snapshot.selection : snapshot.output).trim();
  if (!text) return toast('Select a word or phrase in the translated text.');
  const entire = !selected || text === snapshot.output;
  let ko, en;
  try {
    if (entire) {
      ko = snapshot.target === 'ko' ? snapshot.output : snapshot.translatedInput;
      en = snapshot.target === 'en' ? snapshot.output : snapshot.translatedInput;
    } else {
      toast('Finding a meaning for your selected phrase…');
      const opposite = await native('translate', { text, source: snapshot.target, target: snapshot.source });
      ko = snapshot.target === 'ko' ? text : opposite.text;
      en = snapshot.target === 'en' ? text : opposite.text;
    }
    wordForm({ ko, en, machineTranslated: true, note: 'Collected from a Google Translate suggestion. Check meaning in context.' });
  } catch (error) { handleError(error); }
}
async function prepareModel(which, buttonElement) {
  const originalModal = modalRevision;
  const startedInSettings = modalKind === 'settings';
  const originalRoute = route;
  if (buttonElement) { buttonElement.disabled = true; buttonElement.innerHTML = '<span class="spinner"></span>Preparing model…'; }
  try {
    await native('prepareModels', { which, wifiOnly: false });
    capabilities = await native('capabilities');
    toast('Korean model ready. You can use it offline.');
    if (startedInSettings && modalKind === 'settings' && modalRevision === originalModal) showSettings();
    else if (!$('#modal-root').childElementCount && route === originalRoute) render();
  } catch (error) {
    handleError(error);
    if (buttonElement?.isConnected) { buttonElement.disabled = false; buttonElement.innerHTML = `${icon('download')}Try download again`; }
  }
}

function writingChanged() {
  writing.revision++;
  writing.feedback = ''; writing.candidates = [];
  const feedback = $('#writing-feedback'); if (feedback) feedback.innerHTML = '';
}
function renderWrite(main) {
  const options = writing.group === 'mywords' ? store.getCards().filter(c => c.ko.length <= 14).map(c => c.ko) : jamo[writing.group];
  if (!options?.includes(writing.target)) { writing.target = options?.[0] || '가'; writingChanged(); }
  main.innerHTML = `${intro('Your fingers know the way', 'Make room for 한글.', 'Trace the shape, then hide the guide and write it from memory.')}
    <div class="segmented">${[['syllables', 'Blocks'], ['consonants', 'Consonants'], ['vowels', 'Vowels'], ['mywords', 'My words']].map(([id, title]) => `<button class="${writing.group === id ? 'active' : ''}" data-action="writing-group" data-group="${id}">${title}</button>`).join('')}</div>
    <div class="target-heading"><div><span class="eyebrow">Write this</span><span class="target ko" lang="ko">${escape(writing.target)}</span></div><button class="icon-button bordered" data-action="speak-writing" aria-label="Hear the writing target">${icon('volume')}</button></div>
    <div class="canvas-shell"><div id="guide-glyph" class="guide-glyph ${writing.target.length > 1 ? 'long' : ''} ${writing.showGuide ? '' : 'hidden'}" lang="ko" aria-hidden="true">${escape(writing.target)}</div><canvas id="ink-canvas" class="ink-canvas" aria-label="Drawing area. Write Korean with your finger or stylus." role="img"></canvas></div>
    <div class="canvas-toolbar">${button('toggle-guide', writing.showGuide ? 'Hide guide' : 'Show guide', 'outline small', 'eye')}${button('undo-stroke', 'Undo', 'outline small', 'undo')}${button('clear-writing', 'Clear', 'outline small', 'erase')}</div>
    ${button('check-writing', 'Read my handwriting', 'full', 'check')}
    <div id="writing-feedback" aria-live="polite">${writing.feedback}</div>
    ${!capabilities.inkReady ? modelSetup('ink', 'Let your phone read your writing', 'Download the Korean handwriting model once to check which letters or words it recognizes.') : ''}
    <div class="section-head"><h2>Pick something to write</h2></div><div class="${writing.group === 'mywords' ? 'writing-choices' : 'jamo-grid'}">${options.map(target => `<button data-action="writing-target" data-target="${escape(target)}" class="${writing.group === 'mywords' ? '' : 'jamo-cell'} ${target === writing.target ? 'active' : ''}" lang="ko">${escape(target)}</button>`).join('')}</div>
    <p class="soft-note">The guide shows the shape, not stroke order. Recognition tells you what the writing looks like to your phone; it doesn’t grade penmanship. Full syllable blocks are usually easier to recognize than single consonants.</p>`;
  setupCanvas();
}
function setupCanvas() {
  const canvas = $('#ink-canvas'); if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 320, height = rect.height || 320;
  if (writing.lastWidth && (writing.lastWidth !== width || writing.lastHeight !== height)) {
    for (const stroke of writing.strokes) for (const p of stroke) { p.x *= width / writing.lastWidth; p.y *= height / writing.lastHeight; }
    writingChanged();
  }
  writing.lastWidth = width; writing.lastHeight = height;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d'); context.scale(ratio, ratio);
  context.strokeStyle = '#285f47'; context.fillStyle = '#285f47'; context.lineWidth = 7; context.lineCap = 'round'; context.lineJoin = 'round';
  function redraw() {
    context.clearRect(0, 0, width, height);
    for (const stroke of writing.strokes) {
      if (!stroke.length) continue;
      context.beginPath(); context.moveTo(stroke[0].x, stroke[0].y);
      if (stroke.length === 1) { context.arc(stroke[0].x, stroke[0].y, 3.5, 0, Math.PI * 2); context.fill(); }
      else { for (const p of stroke.slice(1)) context.lineTo(p.x, p.y); context.stroke(); }
    }
  }
  function point(event) { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(width, event.clientX - r.left)), y: Math.max(0, Math.min(height, event.clientY - r.top)), t: Date.now() }; }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary) return;
    if (writing.strokes.length >= 100) return toast('Try a shorter word, or clear the page and start again.');
    canvas.setPointerCapture(event.pointerId); writing.activePointer = event.pointerId;
    writing.activeStroke = [point(event)]; writing.strokes.push(writing.activeStroke); writingChanged(); redraw(); event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (!writing.activeStroke || event.pointerId !== writing.activePointer) return;
    if (writing.activeStroke.length >= 2500) return;
    writing.activeStroke.push(point(event)); writingChanged(); redraw(); event.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => {
    if (event.pointerId !== writing.activePointer) return;
    if (writing.activeStroke && type === 'pointerup') { writing.activeStroke.push(point(event)); writingChanged(); }
    writing.activeStroke = null; writing.activePointer = null; redraw();
  });
  redraw();
}
async function checkWriting(buttonElement) {
  if (!writing.strokes.length) return toast('Write on the page first.');
  const target = writing.target;
  const revision = writing.revision;
  buttonElement.disabled = true; buttonElement.innerHTML = '<span class="spinner"></span>Reading your strokes…';
  try {
    const result = await native('recognizeInk', { strokes: writing.strokes, width: writing.lastWidth, height: writing.lastHeight });
    if (writing.target !== target || writing.revision !== revision) return;
    writing.candidates = (result.candidates || []).slice(0, 4);
    const normalized = text => text.normalize('NFKC').replace(/\s+/g, '');
    const matched = writing.candidates.some(c => normalized(c) === normalized(target));
    writing.feedback = `<div class="feedback ${matched ? '' : 'wrong'}"><strong>${matched ? 'Your writing was recognized.' : 'Here’s what your phone could read.'}</strong><p lang="ko" class="answer">${escape(writing.candidates.join(' · ') || '—')}</p><p>${matched ? 'Try hiding the guide for another go.' : 'Compare it with the target. Try making each block a little clearer, or use a full syllable.'}</p></div>`;
    if (route === 'write') $('#writing-feedback').innerHTML = writing.feedback;
  } catch (error) { if (writing.target === target && writing.revision === revision) handleError(error); }
  finally { if (buttonElement.isConnected) { buttonElement.disabled = false; buttonElement.innerHTML = `${icon('check')}Read my handwriting`; } }
}

function openLesson(id) {
  const lesson = lessonsWithReadiness().find(l => l.id === id); if (!lesson) return;
  const missing = (lesson.missingVocabIds || []).map(wordId => sourceById.get(wordId)).filter(Boolean);
  const newWords = (lesson.teachVocab || []).map(wordId => sourceById.get(wordId)).filter(Boolean);
  const previous = (lesson.missingLessonIds || []).map(lessonId => LESSONS.find(l => l.id === lessonId)).filter(Boolean);
  showModal(lesson.title, `<p class="muted tiny space-top">${escape(lesson.subtitle)}</p><div class="divider"></div><h3 class="grammar-title" lang="ko">${escape(lesson.grammar.title)}</h3><p class="grammar-text">${escape(lesson.grammar.explanation)}</p>
    ${previous.length ? `<div class="soft-note space-top"><strong>One earlier adventure first</strong><p class="space-top">${previous.map(l => escape(l.title)).join(', ')}</p>${button('open-lesson', 'Open the earlier adventure', 'outline small space-top', 'arrow', `data-id="${escape(previous[0].id)}"`)}</div>` : ''}
    ${missing.length ? `<div class="soft-note space-top"><strong>A few words to warm up</strong><p class="space-top">${missing.map(w => `<span lang="ko">${escape(w.ko)}</span>`).join(' · ')}</p><p class="space-top">Practice these first so the sentences have something familiar to build on.</p>${button('prepare-lesson-words', 'Collect & practice these words', 'secondary small space-top', 'mic', `data-id="${escape(id)}"`)}</div>` : ''}
    <div class="section-head"><h3>Words this adventure introduces</h3></div>${newWords.map(w => `<div class="trail-card"><h3 lang="ko" style="font-size:22px">${escape(w.ko)}</h3><p class="muted tiny">${escape(w.en)}</p></div>`).join('') || '<p class="muted tiny">A new way to use words you already have.</p>'}
    ${button('start-lesson', lesson.completed ? 'Revisit this adventure' : 'Let’s try it', 'full space-top', 'arrow', `data-id="${escape(id)}" ${!lesson.ready && !lesson.completed ? 'disabled' : ''}`)}<p class="pronunciation-note">Lesson puzzles build understanding. Your vocabulary becomes mastered through separate recall reviews.</p>`);
}
function startLesson(id) {
  const lesson = lessonsWithReadiness().find(l => l.id === id);
  if (!lesson || (!lesson.ready && !lesson.completed)) return;
  for (const wordId of lesson.teachVocab || []) { if (!collectCurated(wordId)) return; }
  lessonRun = { lesson, index: -1, choice: '', tokens: [], feedback: null, mistakes: 0 };
  closeModal(); navigate('learn');
}
function renderLesson(main) {
  const { lesson, index } = lessonRun;
  const header = `<div class="back-heading"><button class="icon-button" data-action="exit-lesson" aria-label="Back to lessons">${icon('back')}</button><div><span class="eyebrow">Little adventure</span><h2>${escape(lesson.title)}</h2></div></div>`;
  if (index < 0) {
    main.innerHTML = `${header}<div class="card"><span class="eyebrow">One useful pattern</span><h2 class="grammar-title" lang="ko">${escape(lesson.grammar.title)}</h2><p class="grammar-text">${escape(lesson.grammar.explanation)}</p>${lesson.grammar.examples.map((ex, i) => `<div class="example-block"><div lang="ko" class="ko">${escape(ex.ko)}</div><p>${escape(ex.en)}</p><button class="icon-button bordered space-top" data-action="lesson-example" data-index="${i}" aria-label="Hear example ${i + 1}">${icon('volume')}</button></div>`).join('')}${button('lesson-next', 'Try it in a sentence', 'full', 'arrow')}</div>`; return;
  }
  if (index >= lesson.challenges.length) {
    main.innerHTML = `${header}<div class="card" style="text-align:center"><div class="success-seal">${icon('spark')}</div><h2>A new little possibility.</h2><p class="muted space-top">You can use another piece of Korean now.</p><p class="soft-note space-top">${lessonRun.mistakes ? 'You worked through the tricky parts. Revisit this adventure whenever you want.' : 'Every sentence found its place.'}</p>${button('finish-lesson', 'Save & keep growing', 'full space-top', 'check')}</div>`; return;
  }
  const challenge = lesson.challenges[index];
  main.innerHTML = `${header}<div class="practice-head"><span>Challenge ${index + 1} of ${lesson.challenges.length}</span><span>Put it into practice</span></div><div class="progress-line"><span style="width:${index / lesson.challenges.length * 100}%"></span></div><h2 class="challenge-prompt">${escape(challenge.prompt)}</h2>${challenge.ko ? `<p lang="ko" class="detail-word" style="font-size:28px">${escape(challenge.ko)}</p>` : ''}
    ${challenge.type === 'order' ? `<p class="muted tiny">Tap the pieces to build the sentence. Tap a placed piece to return it.</p><div class="sentence-tray token-tray">${lessonRun.tokens.map((token, i) => `<button class="token" lang="ko" data-action="remove-token" data-index="${i}" ${lessonRun.feedback ? 'disabled' : ''}>${escape(token)}</button>`).join('')}</div><div class="token-tray">${challenge.options.map((token, i) => `<button class="token" lang="ko" data-action="add-token" data-index="${i}" ${lessonRun.tokens.includes(token) || lessonRun.feedback ? 'disabled' : ''}>${escape(token)}</button>`).join('')}</div>` : `<div class="answer-options">${challenge.options.map((option, i) => `<button class="answer-option ${lessonRun.choice === option ? 'selected' : ''}" data-action="lesson-choice" data-index="${i}" ${lessonRun.feedback ? 'disabled' : ''}>${escape(option)}</button>`).join('')}</div>`}
    ${lessonRun.feedback ? `<div class="feedback ${lessonRun.feedback.correct ? '' : 'wrong'}" role="status"><strong>${lessonRun.feedback.correct ? 'You’ve got the idea.' : 'A useful thing to notice.'}</strong><p>${escape(challenge.explanation)}</p>${!lessonRun.feedback.correct ? `<p class="answer">${escape(challenge.answer)}</p>` : ''}</div>${button(lessonRun.feedback.correct ? 'lesson-next' : 'lesson-retry', lessonRun.feedback.correct ? 'Keep going' : 'Try this one again', 'full space-top', 'arrow')}` : button('check-lesson', 'Check this sentence', 'full space-top', 'check')}`;
}
function checkLesson() {
  if (!lessonRun || lessonRun.feedback) return;
  const challenge = lessonRun.lesson.challenges[lessonRun.index];
  const answer = challenge.type === 'order' ? lessonRun.tokens.join(' ') : lessonRun.choice;
  if (!answer) return toast('Choose an answer first.');
  const norm = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const correct = [challenge.answer, ...(challenge.acceptedAnswers || [])].some(expected => norm(answer) === norm(expected));
  lessonRun.feedback = { correct }; if (!correct) lessonRun.mistakes++;
  renderLesson($('#main'));
}

function showModal(title, content, kind = '') {
  modalRevision++; modalKind = kind;
  modalOpener = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="close-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-handle"></div><div class="modal-heading"><h2 id="modal-title">${escape(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div><div class="space-top">${content}</div></section></div>`;
  document.body.classList.add('no-scroll'); $('.modal').focus();
}
function closeModal() {
  if (!$('#modal-root').childElementCount) return;
  modalRevision++; modalKind = '';
  $('#modal-root').innerHTML = ''; document.body.classList.remove('no-scroll');
  if (modalOpener?.isConnected) modalOpener.focus();
}
function showSettings() {
  const settings = store.getSettings();
  showModal('Your pocket notebook', `<div class="soft-note">Your vocabulary, review history and lessons are saved on this phone. Export a backup before moving to another phone or uninstalling.</div>
    <section class="settings-section"><h3>Your pace</h3><label class="setting-row"><span>Daily review goal</span><select id="daily-goal">${[5, 10, 15, 20].map(n => `<option value="${n}" ${Number(settings.dailyGoal || 10) === n ? 'selected' : ''}>${n} words</option>`).join('')}</select></label><label class="setting-row"><span>Korean audio speed</span><select id="speech-rate">${[[0.75, 'Gentle'], [0.85, 'Natural'], [1, 'Full speed']].map(([n, name]) => `<option value="${n}" ${Number(settings.speechRate || 0.85) === n ? 'selected' : ''}>${name}</option>`).join('')}</select></label></section>
    <section class="settings-section"><h3>Korean on your phone</h3><p>Translation and handwriting need a one-time model download, roughly 50 MB together. This download can use your current mobile connection.</p><div class="setting-row"><span>Translation model</span><span class="status-badge ${capabilities.translationReady ? '' : 'pending'}">${capabilities.translationReady ? 'Ready' : 'Download needed'}</span></div><div class="setting-row"><span>Handwriting model</span><span class="status-badge ${capabilities.inkReady ? '' : 'pending'}">${capabilities.inkReady ? 'Ready' : 'Download needed'}</span></div>${button('prepare-model', 'Prepare both Korean models', 'secondary full space-top', 'download', 'data-model="all"')}<p>Speech recognition and spoken audio use your phone’s installed services. Speech may be processed online by that provider; no recordings are stored by this app. Offline language availability varies by phone.</p>${button('speech-settings', 'Phone speech settings', 'outline full small', 'settings')}${button('tts-settings', 'Korean voice settings', 'outline full small space-top', 'volume')}</section>
    <section class="settings-section"><h3>Keep your progress</h3><p>Backups contain your words and learning history. Import merges with your notebook; it doesn’t erase it.</p><div class="button-row equal">${button('export-data', 'Export backup', 'outline small', 'download')}${button('import-data', 'Import backup', 'outline small', 'upload')}</div></section>
    <section class="settings-section"><h3>How words grow</h3><p><strong>Black:</strong> collected, not tested yet.<br><strong>Yellow:</strong> learning through recall.<br><strong>Green:</strong> successful reviews in both directions across multiple days. A miss brings a word back into learning.</p><p>Speech is vocabulary recall, not a pronunciation score. Typed answers count too. Lesson puzzles help understanding; they don’t automatically mark vocabulary mastered.</p></section>
    <section class="settings-section"><h3>About Pocket Korean</h3><p>A personal language playground. Version ${escape(capabilities.version || '0.1.0')}. No app account or API key is needed.</p><p>Google Translate powers automatic translations via ML Kit. These are suggestions and may be incorrect. The app is independent of Google.</p><p><button class="inline-link" data-action="translation-notice">Translation attribution & disclaimer</button></p><p class="tiny">${isAndroid ? 'Your progress is local to this installation.' : 'Browser preview: handwriting checking, translation and microphone practice require the installed Android app.'}</p></section>`, 'settings');
}
async function exportData() {
  try { await native('exportBackup', { content: store.exportData(), name: `pocket-korean-${new Date().toISOString().slice(0, 10)}.json` }); toast('Backup exported.'); }
  catch (error) { handleError(error); }
}
async function importData() {
  try { const result = await native('importBackup'); const merged = store.importData(result.content); practice = null; speechToken++; closeModal(); render(); toast(`Backup merged. ${merged.added} new words added.`); }
  catch (error) { handleError(error); }
}

const actions = {
  'close-modal': closeModal,
  'close-backdrop': element => { if (element === eventTarget) closeModal(); },
  'start-practice': () => { newPractice(); navigate('speak'); },
  'restart-practice': () => { newPractice(); render(); },
  'go-words': () => navigate('words'),
  'word-filter': el => { wordFilter = el.dataset.filter; renderWords($('#main')); },
  'word-detail': el => showWord(el.dataset.id),
  'new-word': () => wordForm(),
  'edit-word': el => wordForm(store.getCard(el.dataset.id), el.dataset.id),
  'browse-vocab': browseVocab,
  'collect-seed': el => { const w = sourceById.get(el.dataset.id); if (w && collectCurated(w.id)) { toast(`Added ${w.ko}.`); browseVocab(); if (route === 'words') renderWords($('#main')); } },
  'play-word': el => speak(store.getCard(el.dataset.id)?.ko),
  'play-word-slow': el => speak(store.getCard(el.dataset.id)?.ko, 'ko-KR', 0.7),
  'play-example': el => speak(store.getCard(el.dataset.id)?.example?.ko),
  'practice-word': el => { newPractice(el.dataset.id); navigate('speak'); },
  'write-word': el => { writing.group = 'mywords'; writing.target = store.getCard(el.dataset.id)?.ko || '한글'; writing.strokes = []; writingChanged(); navigate('write'); },
  'practice-direction': el => { native('stopListening').catch(() => {}); practiceDirection = el.dataset.direction; safeMutation(() => store.setSettings({ testDirection: practiceDirection })); newPractice(); renderSpeak($('#main')); },
  'input-mode': el => { speechToken++; native('stopListening').catch(() => {}); inputMode = el.dataset.mode; safeMutation(() => store.setSettings({ answerMode: inputMode })); practice.listening = false; renderSpeak($('#main')); },
  'play-prompt': () => { const item = practice.current; speak(item.direction === 'enToKo' ? item.card.en : item.card.ko, item.direction === 'enToKo' ? 'en-US' : 'ko-KR'); },
  'play-answer': () => speak(practice.current.card.ko),
  'listen-answer': listenAnswer,
  'speech-alternative': el => { practice.answer = el.dataset.answer; $('#practice-answer').value = practice.answer; },
  'reveal-answer': () => {
    if (!practice || practice.answered) return;
    speechToken++;
    native('stopListening').catch(() => {}); practice.listening = false;
    const saved = safeMutation(() => store.recordAttempt(practice.current.card.id, practice.current.direction, { correct: false, assisted: true, mode: inputMode }));
    if (!saved) return;
    practice.answered = true; practice.assisted = true; practice.count++; practice.lastCardId = practice.current.card.id; practice.feedback = { correct: false, message: 'Asking for help is part of learning. This word will return sooner.' }; renderSpeak($('#main'));
  },
  'next-question': () => { nextQuestion(); renderSpeak($('#main')); },
  'swap-languages': () => { if (translation.busy) return; const { source, target, output } = translation; translation = { source: target, target: source, input: output || '', translatedInput: '', output: '', selection: '', busy: false }; renderTranslate($('#main')); },
  'translate-text': translateText,
  'speak-translation': () => speak(translation.output, translation.target === 'ko' ? 'ko-KR' : 'en-US'),
  'collect-selection': () => collectTranslation(true),
  'collect-translation': () => collectTranslation(false),
  'prepare-model': el => prepareModel(el.dataset.model, el),
  'writing-group': el => { writing.group = el.dataset.group; writing.strokes = []; writingChanged(); renderWrite($('#main')); },
  'writing-target': el => { writing.target = el.dataset.target; writing.strokes = []; writingChanged(); renderWrite($('#main')); },
  'toggle-guide': () => { writing.showGuide = !writing.showGuide; renderWrite($('#main')); },
  'undo-stroke': () => { writing.strokes.pop(); writingChanged(); renderWrite($('#main')); },
  'clear-writing': () => { writing.strokes = []; writingChanged(); renderWrite($('#main')); },
  'check-writing': checkWriting,
  'speak-writing': () => speak(writing.target),
  'open-lesson': el => openLesson(el.dataset.id),
  'prepare-lesson-words': el => {
    const lesson = lessonsWithReadiness().find(l => l.id === el.dataset.id);
    const focusedIds = [];
    for (const id of lesson.missingVocabIds || []) { const word = collectCurated(id); if (!word) return; focusedIds.push(word.id); }
    newPractice('', focusedIds); navigate('speak');
  },
  'start-lesson': el => startLesson(el.dataset.id),
  'exit-lesson': () => { lessonRun = null; render(); },
  'lesson-example': el => speak(lessonRun.lesson.grammar.examples[Number(el.dataset.index)].ko),
  'lesson-next': () => { lessonRun.index++; lessonRun.choice = ''; lessonRun.tokens = []; lessonRun.feedback = null; renderLesson($('#main')); },
  'lesson-choice': el => { lessonRun.choice = lessonRun.lesson.challenges[lessonRun.index].options[Number(el.dataset.index)]; renderLesson($('#main')); },
  'add-token': el => { const token = lessonRun.lesson.challenges[lessonRun.index].options[Number(el.dataset.index)]; if (!lessonRun.tokens.includes(token)) lessonRun.tokens.push(token); renderLesson($('#main')); },
  'remove-token': el => { lessonRun.tokens.splice(Number(el.dataset.index), 1); renderLesson($('#main')); },
  'check-lesson': checkLesson,
  'lesson-retry': () => { lessonRun.feedback = null; lessonRun.choice = ''; lessonRun.tokens = []; renderLesson($('#main')); },
  'finish-lesson': () => { if (!safeMutation(() => store.completeLesson(lessonRun.lesson.id))) return; lessonRun = null; render(); toast('Adventure completed. A new step is waiting.'); },
  'export-data': exportData,
  'import-data': importData,
  'speech-settings': () => native('openSpeechSettings', { kind: 'speech' }).catch(handleError),
  'tts-settings': () => native('openSpeechSettings', { kind: 'tts' }).catch(handleError),
  'translation-notice': () => showModal('Translation information', '<p class="grammar-text">Automatic translation is powered by Google Translate through ML Kit on-device translation. Review suggestions before adding them to your vocabulary. This app is not affiliated with Google.</p><p class="long-note space-top">This service may contain translations powered by Google. Google disclaims all warranties related to the translations, express or implied, including any warranties of accuracy, reliability, and any implied warranties of merchantability, fitness for a particular purpose and noninfringement.</p><p class="tiny space-top">Provider information: https://cloud.google.com/translate<br>Attribution guidelines: https://developers.google.com/ml-kit/language/translation/translation-terms</p>')
};
let eventTarget;
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.dataset.action === 'close-backdrop' && event.target !== el) return;
  eventTarget = event.target;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  event.preventDefault();
  try { const result = fn(el); if (result?.catch) result.catch(handleError); }
  catch (error) { handleError(error); }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'answer-form') submitAnswer(event);
  if (event.target.id === 'word-form') saveWord(event);
});
document.addEventListener('input', event => {
  if (event.target.id === 'word-search') { wordQuery = event.target.value; updateWordResults(); }
  if (event.target.id === 'practice-answer' && practice) practice.answer = event.target.value;
  if (event.target.id === 'translation-input') { translation.input = event.target.value; $('#translation-count').textContent = translation.input.length; if (translation.output && translation.input.trim() !== translation.translatedInput) { translation.output = ''; translation.selection = ''; $('.translation-result')?.remove(); } }
});
document.addEventListener('change', event => {
  if (event.target.id === 'daily-goal') safeMutation(() => store.setSettings({ dailyGoal: Number(event.target.value) }));
  if (event.target.id === 'speech-rate') safeMutation(() => store.setSettings({ speechRate: Number(event.target.value) }));
});
document.addEventListener('selectionchange', () => {
  if (route !== 'translate') return;
  const selection = window.getSelection();
  const output = $('#translation-output');
  if (!output || !selection?.rangeCount) return;
  if (output.contains(selection.anchorNode) && output.contains(selection.focusNode) && selection.toString().trim()) {
    translation.selection = selection.toString().trim();
    const add = $('#collect-selection'); if (add) { add.disabled = false; add.innerHTML = `${icon('plus')}Add selection`; }
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab' && $('.modal')) {
    const focusable = [...$('.modal').querySelectorAll('button:not(:disabled),input,textarea,select,[tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('.modal'))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
window.addEventListener('pocket-service', event => {
  const message = event.detail;
  if (message?.type === 'speechPartial' && practice?.listening) { const field = $('#practice-answer'); if (field) field.value = message.data?.text || ''; }
  if (message?.type === 'capabilities') capabilities = { ...capabilities, ...message.data };
  if (message?.type === 'modelStatus') capabilities = { ...capabilities, translationReady: message.data?.translationReady ?? capabilities.translationReady, inkReady: message.data?.inkReady ?? capabilities.inkReady };
  if (message?.type === 'speechOutputError') toast(message.data?.message || 'Your phone could not play that voice.');
});
window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
document.addEventListener('visibilitychange', () => { if (document.hidden) native('stopListening').catch(() => {}); });
window.pocketBack = () => {
  if ($('#modal-root').childElementCount) { closeModal(); return true; }
  if (route === 'learn' && lessonRun) { lessonRun = null; render(); return true; }
  if (route !== 'learn') { navigate('learn'); return true; }
  return false;
};

try {
  store = createStore(localStorage, { key: 'pocketLabKorean.v1', seed: VOCAB });
  inputMode = store.getSettings().answerMode || 'voice';
  practiceDirection = store.getSettings().testDirection || 'mixed';
  updateHeader();
  $('#settings-button').addEventListener('click', showSettings);
  navigate(location.hash.slice(1) || 'learn');
  native('capabilities').then(result => { capabilities = result; if (route === 'translate' || route === 'write') render(); }).catch(() => {});
} catch (error) {
  $('#main').innerHTML = `<div class="page-intro"><h1>Your notebook needs attention.</h1><p>${escape(error.message)}</p></div><div class="soft-note">Your saved data has not been reset. Close and reopen the app. If you have a backup, keep it safe while we repair the notebook.</div>`;
}
