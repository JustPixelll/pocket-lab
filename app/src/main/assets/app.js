import { createStore, evaluateAnswer } from './engine.js';
import { VOCAB, LESSONS, CHARACTERS, recommendLessons } from './data/curriculum.js';
import { native, isAndroid } from './native.js';
import { icon } from './icons.js';
import { COSMETICS, DEFAULT_EQUIPMENT } from './data/customization.js';
import { characterSvg, sceneDecor } from './characters.js';

const $ = (selector, root = document) => root.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = status => ({ new: 'New', learning: 'Learning', mastered: 'Mastered' }[status] || 'New');
const languageName = lang => lang === 'ko' ? 'Korean' : 'English';
const sourceById = new Map(VOCAB.map(word => [word.id, word]));
const NAV = [['home', 'Home', 'home'], ['learn', 'Learn', 'learn'], ['write', 'Write', 'write'], ['speak', 'Speak', 'mic'], ['words', 'Words', 'words'], ['translate', 'Translate', 'translate']];
let store;
let capabilities = { platform: isAndroid ? 'android' : 'browser', translationReady: false, inkReady: false };
let route = 'home';
let homeSection = 'room';
let shopSlot = 'hat';
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
let updateCheckToken = 0;
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
function coinLabel(amount, cls = '') { return `<span class="coin-label ${cls}">${icon('coin')}<span>${Number(amount) || 0}<span class="sr-only"> coins</span></span></span>`; }
function audioButton(text, title = 'Hear the Korean', cls = '') {
  if (!text || !/[\uAC00-\uD7A3\u3131-\u318E]/u.test(text)) return '';
  return `<button class="icon-button bordered audio-button ${cls}" type="button" data-action="play-korean" data-text="${escape(text)}" aria-label="${escape(title)}">${icon('volume')}</button>`;
}
function nameLanguage(name) { return /[\uAC00-\uD7A3\u3131-\u318E]/u.test(name) ? 'ko' : 'en'; }
function personName(person) { return `<span lang="ko">${escape(person?.name || '')}</span>`; }
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
  main.dataset.route = route;
  if (route === 'home') renderHome(main);
  else if (route === 'learn') renderLearn(main);
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
  route = NAV.some(n => n[0] === next) ? next : 'home';
  if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderHome(main) {
  const profile = store.getProfile();
  const stats = store.getStats();
  const dailyGoal = Number(store.getSettings().dailyGoal || 10);
  const daily = stats.today?.attempts || 0;
  const completed = store.getLessonProgress();
  const next = lessonsWithReadiness().find(lesson => !lesson.completed && lesson.ready)
    || lessonsWithReadiness().find(lesson => !lesson.completed) || LESSONS[0];
  const tabs = `<div class="home-tabs" aria-label="Home areas">${[['room', 'Camp', 'home'], ['shop', 'Outfitter', 'shop'], ['wardrobe', 'Equipment', 'hat']].map(([id, name, symbol]) => `<button data-action="home-section" data-section="${id}" class="${homeSection === id ? 'active' : ''}" aria-pressed="${homeSection === id}">${icon(symbol)}${name}</button>`).join('')}</div>`;
  const heading = `<div class="home-heading"><div><span class="eyebrow">Greybridge outpost</span><h1>${homeSection === 'shop' ? 'The outfitter.' : homeSection === 'wardrobe' ? 'Your equipment.' : 'Camp.'}</h1></div>${coinLabel(profile.coins, 'wallet')}</div>${tabs}`;
  if (homeSection !== 'room') {
    const owned = new Set(profile.ownedItems);
    const items = COSMETICS.filter(item => item.slot === shopSlot && (homeSection === 'shop' || owned.has(item.id) || item.price === 0));
    main.innerHTML = `${heading}<div class="shop-companion"><div class="shop-avatar">${characterSvg(profile.equipment, { label: profile.characterName })}</div><div><h2 lang="${nameLanguage(profile.characterName)}">${escape(profile.characterName)}</h2><p>Gear up before taking your next contract.</p>${button('rename-character', 'Change name', 'outline small', 'write')}</div></div>
      <div class="segmented" aria-label="Clothing categories">${[['hat', 'Hats'], ['outfit', 'Outfits'], ['body', 'Colors']].map(([id, title]) => `<button data-action="shop-slot" data-slot="${id}" class="${shopSlot === id ? 'active' : ''}">${title}</button>`).join('')}</div>
      <div class="shop-grid">${items.map(item => {
        const equipped = profile.equipment[item.slot] === item.id;
        const isOwned = owned.has(item.id) || item.price === 0;
        const action = isOwned ? 'equip-item' : 'buy-item';
        const title = equipped ? 'Equipped' : isOwned ? 'Equip' : `Buy · ${item.price} coins`;
        const preview = { ...profile.equipment, [item.slot]: item.id };
        return `<article class="shop-card ${equipped ? 'equipped' : ''}" data-item="${escape(item.id)}"><div class="shop-item-art">${characterSvg(preview, { label: `${profile.characterName} wearing ${item.name}` })}</div><h3>${escape(item.name)}</h3><p class="item-price">${isOwned ? (item.price === 0 ? 'Starting equipment' : 'Owned') : coinLabel(item.price)}</p>${button(action, title, `${equipped ? 'secondary' : isOwned ? 'outline' : ''} full small`, equipped ? 'check' : '', `data-id="${escape(item.id)}" ${equipped || (!isOwned && profile.coins < item.price) ? 'disabled' : ''}`)}${!isOwned && profile.coins < item.price ? `<p class="item-shortfall">${item.price - profile.coins} more coins to go</p>` : ''}</article>`;
      }).join('')}</div>
      <p class="soft-note space-top">Earn 20 coins the first time you finish a quest, and 10 when a word first turns green. Everything here is bought with learning coins.</p>${profile.coinDebt ? `<p class="soft-note space-top">Your merged backups included purchases from both copies. The next ${profile.coinDebt} earned coins will account for those items; your wardrobe is kept.</p>` : ''}`;
    return;
  }
  main.innerHTML = `${heading}<div class="home-layout"><section class="character-home card"><div class="character-home-top"><span class="eyebrow">Wayfarer</span><button class="icon-button" data-action="rename-character" aria-label="Change character name">${icon('write')}</button></div><div class="home-stage">${sceneDecor('Camp')}<div class="home-player">${characterSvg(profile.equipment, { label: profile.characterName })}</div></div><div class="character-caption"><h2 lang="${nameLanguage(profile.characterName)}">${escape(profile.characterName)}</h2><p>${escape(COSMETICS.find(item => item.id === profile.equipment.outfit)?.name || 'Travel tunic')} · ${escape(COSMETICS.find(item => item.id === profile.equipment.hat)?.name || 'No hat')}</p></div>${button('home-section', 'Manage equipment', 'secondary full', 'hat', 'data-section="wardrobe"')}</section>
    <div class="home-notes"><div class="card next-quest"><span class="eyebrow">${completed[next.id] ? 'From the journal' : 'Next contract'}</span><h2>${escape(next.title)}</h2><p>${escape(next.quest?.objective || next.subtitle)}</p><div class="next-quest-foot"><span class="tag">${escape(next.quest?.location || 'Around town')}</span>${!completed[next.id] ? coinLabel(20) : '<span class="check-pill">Completed</span>'}</div>${button('open-lesson', completed[next.id] ? 'Replay contract' : 'View contract', 'full space-top', 'arrow', `data-id="${escape(next.id)}"`)}</div>
    <div class="daily-goal"><div><h3>Recall practice</h3><p>${Math.min(daily, dailyGoal)} of ${dailyGoal} reviews today</p>${button('start-practice', 'Practice words', 'outline small space-top', 'mic')}</div><div class="goal-ring" style="--progress:${Math.min(100, 100 * daily / dailyGoal)}%"><span>${daily}/${dailyGoal}</span></div></div></div></div>
    <div class="stats-row"><div class="stat"><b>${Object.keys(completed).filter(id => LESSONS.some(lesson => lesson.id === id)).length}<small> / 10</small></b><span>Quests completed</span></div><div class="stat"><b>${stats.total}</b><span>Words collected</span></div><div class="stat mastered"><b>${stats.mastered}</b><span>Words mastered</span></div></div>
    <div class="section-head"><h2>Contacts</h2><button class="text-button" data-action="town-notebook">Codex ${icon('arrow')}</button></div><div class="town-faces">${Object.values(CHARACTERS).map(person => `<button class="town-face" data-action="meet-character" data-id="${escape(person.id)}"><span>${characterSvg(DEFAULT_EQUIPMENT, { appearance: person.appearance, label: person.name })}</span><strong lang="ko">${escape(person.name)}</strong><small>${escape(person.role)}</small></button>`).join('')}</div>
    <p class="footer-note">${icon('coin')} First quest completion +20 · first green word +10</p>`;
}

function renameCharacter() {
  const profile = store.getProfile();
  showModal('Character name', `<form id="character-form"><label class="field"><span>Your character’s name</span><input class="input" id="character-name" value="${escape(profile.characterName)}" maxlength="24" required autocomplete="off"></label><p class="soft-note">The name shown in camp and quest encounters. Change it whenever you want.</p><button class="button full space-top" type="submit">${icon('check')}Save name</button><div id="character-form-error" role="alert"></div></form>`);
}
function townNotebook(id = '') {
  const people = id && CHARACTERS[id] ? [CHARACTERS[id]] : Object.values(CHARACTERS);
  showModal(id ? 'Contact dossier' : 'Greybridge codex', `<p class="muted tiny">The people who keep Greybridge running. Some will have more work for you.</p><div class="town-notebook">${people.map(person => `<article class="person-card"><div class="person-portrait">${characterSvg(DEFAULT_EQUIPMENT, { appearance: person.appearance, label: person.name })}</div><div><h3>${personName(person)}</h3><span class="eyebrow">${escape(person.role)}</span><p>${escape(person.bio || '')}</p><div class="person-quests">${LESSONS.filter(lesson => lesson.quest?.npcId === person.id).map(lesson => button('open-lesson', escape(lesson.title), 'outline small', 'arrow', `data-id="${escape(lesson.id)}"`)).join('')}</div></div></article>`).join('')}</div>`);
}

function questScene(lesson, { small = false, proud = false } = {}) {
  const profile = store.getProfile();
  const person = CHARACTERS[lesson.quest?.npcId];
  if (!person) return '';
  return `<div class="quest-scene ${small ? 'compact' : ''}" aria-label="${escape(`${profile.characterName} meets ${person.name} at ${lesson.quest.location}`)}"><span class="scene-location">${icon('pin')}${escape(lesson.quest.location)}</span>${sceneDecor(lesson.quest.location)}<div class="scene-person player">${characterSvg(profile.equipment, { label: profile.characterName, mood: proud ? 'proud' : 'happy' })}<span lang="${nameLanguage(profile.characterName)}">${escape(profile.characterName)}</span></div><div class="scene-person npc">${characterSvg(DEFAULT_EQUIPMENT, { appearance: person.appearance, label: person.name, mood: proud ? 'proud' : 'happy' })}<span lang="ko">${escape(person.name)}</span></div></div>`;
}
function questDialogue(lesson, dialogue) {
  if (!dialogue || (!dialogue.text && !dialogue.ko)) return '';
  const person = CHARACTERS[lesson.quest?.npcId];
  return `<div class="quest-dialogue"><div class="dialogue-top"><div class="dialogue-portrait">${person ? characterSvg(DEFAULT_EQUIPMENT, { appearance: person.appearance, label: person.name }) : ''}</div><span class="dialogue-speaker">${personName(person)}<span>${escape(person?.role || '')}</span></span></div>${dialogue.text ? `<p>${escape(dialogue.text)}</p>` : ''}${dialogue.ko ? `<div class="spoken-line"><p class="ko" lang="ko">${escape(dialogue.ko)}</p>${audioButton(dialogue.ko, 'Hear the dialogue')}</div><p class="dialogue-translation">${escape(dialogue.en)}</p>` : ''}</div>`;
}

function renderLearn(main) {
  if (lessonRun) return renderLesson(main);
  const lessons = lessonsWithReadiness();
  const done = lessons.filter(lesson => lesson.completed).length;
  const next = lessons.find(lesson => lesson.ready && !lesson.completed) || lessons.find(lesson => !lesson.completed) || lessons[0];
  main.innerHTML = `${intro('Greybridge · Chapter I', 'Quest board.', 'Supplies to recover. Routes to scout. People worth knowing. Ten contracts at the edge of the road.')}
    ${questScene(next, { small: true })}
    <div class="quest-board-heading"><div><h2>Contracts</h2><p>${done} of ${LESSONS.length} completed · Greybridge outpost</p></div>${coinLabel(store.getProfile().coins)}</div>
    <div class="lesson-list quest-list">${lessons.map((lesson, i) => {
      const person = CHARACTERS[lesson.quest?.npcId];
      return `<button class="lesson-card quest-card ${lesson.completed ? 'quest-completed' : ''}" data-action="open-lesson" data-id="${escape(lesson.id)}"><span class="quest-contact-art">${person ? characterSvg(DEFAULT_EQUIPMENT, { appearance: person.appearance, label: person.name }) : ''}<span class="quest-number">${lesson.completed ? icon('check') : String(LESSONS.findIndex(item => item.id === lesson.id) + 1).padStart(2, '0')}</span></span><div class="lesson-content"><span class="quest-place">${escape(lesson.quest?.location || 'Around town')}</span><h3>${escape(lesson.title)}</h3><p>${escape(lesson.quest?.objective || lesson.subtitle)}</p><div class="lesson-meta">${lesson.completed ? '<span class="check-pill">Completed · replay</span>' : lesson.ready ? '<span class="tag">Available</span>' : `<span class="tag neutral">${(lesson.missingLessonIds || []).length ? 'Prerequisite quest' : `${(lesson.missingVocabIds || []).length} words to practice`}</span>`}${!lesson.completed ? coinLabel(20) : ''}</div>${person ? `<span class="quest-host">${personName(person)} · ${escape(person.role)}</span>` : ''}</div>${icon('chevron')}</button>`;
    }).join('')}</div><p class="soft-note space-top">Four challenges per contract. First completions pay 20 coins. Collected vocabulary stays in your notebook for recall practice.</p>`;
}

function renderWords(main) {
  const stats = store.getStats();
  main.innerHTML = `${intro('Your field notes', 'Vocabulary.', 'Listen to a word, check its meaning, and track how well you recall it.')}
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
    main.innerHTML = `${intro('Reviews saved', 'Practice complete.', 'Your next reviews are scheduled. Due words return for another round.')}<div class="card" style="text-align:center"><div class="success-seal">${icon('leaf')}</div><div class="summary-large">${practice.correct}<span style="font-size:24px;color:var(--muted)"> / ${practice.count}</span></div><p class="muted space-top">recalled without revealing the answer</p>${button('restart-practice', 'Practice again', 'full space-top', 'arrow')}${button('go-words', 'See my vocabulary', 'outline full space-top', 'words')}</div><p class="soft-note space-top">Fast repeats are useful practice. Lasting mastery comes from successful reviews on different days.</p>`;
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
        ${practice.serviceError ? `<div class="inline-error" role="alert">${escape(practice.serviceError)}${isAndroid ? `<div class="button-row space-top">${button('speech-settings', 'Speech language settings', 'outline small', 'settings')}${button('input-mode', 'Use typed practice', 'outline small', 'keyboard', 'data-mode="typed"')}</div>` : ''}</div>` : ''}
        <button class="text-button space-top" data-action="reveal-answer">Reveal answer</button>` : `<div class="feedback ${practice.feedback?.correct ? '' : 'wrong'}" role="status"><strong>${practice.feedback?.correct ? 'That’s the word.' : practice.assisted ? 'A word to revisit.' : 'Review this word again.'}</strong><p class="answer ko" lang="ko">${escape(card.ko)}</p><p>${escape(card.en)}</p><p class="tiny">${escape(practice.feedback?.message || '')}</p>${button('play-answer', 'Hear the Korean', 'outline small', 'volume')}</div>${button('next-question', practice.count >= practice.target ? 'See this round' : 'Next word', 'full', 'arrow')}`}
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
  if (saved.coinsEarned) practice.feedback.message += ` First time mastered! +${saved.coinsEarned} coins for your character.`;
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
  if (!String(text || '').trim()) return;
  try { await native('speak', { text, lang, rate: rate || Number(store.getSettings().speechRate || 0.9) }); }
  catch (error) {
    if (isAndroid && ['VOICE_REQUIRED', 'TTS_UNAVAILABLE'].includes(error.code)) {
      showModal('Give Korean a voice', `<p class="grammar-text">${escape(error.message)}</p><div class="intro-steps"><p>Open your phone’s text-to-speech settings below.</p><p>Choose a speech engine that supports Korean, then download its Korean voice data.</p><p>Return here and tap a speaker again. Your quest stays where you left it.</p></div>${button('tts-settings', 'Open voice settings', 'full', 'volume')}<p class="soft-note space-top">Handwriting and translation models are separate from the phone’s spoken voices. Downloading those two models does not install a Korean voice.</p>`);
    } else handleError(error);
  }
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
  } catch (error) {
    if (writing.target === target && writing.revision === revision && error.code !== 'CANCELLED') {
      writing.feedback = `<div class="inline-error" role="alert"><strong>The handwriting service needs attention.</strong><p class="space-top">${escape(error.message || 'Try reading your strokes again.')}</p>${['MODEL_REQUIRED', 'INK_RECOGNITION_FAILED'].includes(error.code) ? button('prepare-model', 'Prepare handwriting model', 'outline full small space-top', 'download', 'data-model="ink"') : ''}<p class="pronunciation-note">Your drawing is still here. This is a service error, so no handwriting result was recorded.</p></div>`;
      if (route === 'write') $('#writing-feedback').innerHTML = writing.feedback;
    }
  }
  finally { if (buttonElement.isConnected) { buttonElement.disabled = false; buttonElement.innerHTML = `${icon('check')}Read my handwriting`; } }
}

function openLesson(id) {
  const lesson = lessonsWithReadiness().find(l => l.id === id); if (!lesson) return;
  const missing = (lesson.missingVocabIds || []).map(wordId => sourceById.get(wordId)).filter(Boolean);
  const newWords = (lesson.teachVocab || []).map(wordId => sourceById.get(wordId)).filter(Boolean);
  const previous = (lesson.missingLessonIds || []).map(lessonId => LESSONS.find(l => l.id === lessonId)).filter(Boolean);
  showModal(lesson.title, `${questScene(lesson, { small: true })}<p class="quest-objective">${escape(lesson.quest?.objective || lesson.subtitle)}</p><div class="quest-reward-note">${lesson.completed ? '<span class="check-pill">First-completion reward already collected</span>' : `${coinLabel(20)}<span>First-completion reward</span>`}</div><div class="divider"></div><h3 class="grammar-title" lang="ko">${escape(lesson.grammar.title)}</h3><p class="grammar-text">${escape(lesson.grammar.explanation)}</p>
    ${previous.length ? `<div class="soft-note space-top"><strong>Required contract</strong><p class="space-top">${previous.map(l => escape(l.title)).join(', ')}</p>${button('open-lesson', 'Open required contract', 'outline small space-top', 'arrow', `data-id="${escape(previous[0].id)}"`)}</div>` : ''}
    ${missing.length ? `<div class="soft-note space-top"><strong>A few words to practice</strong><p class="space-top">${missing.map(w => `<span lang="ko">${escape(w.ko)}</span>`).join(' · ')}</p><p class="space-top">Practice these first so the sentences have something familiar to build on.</p>${button('prepare-lesson-words', 'Collect & practice these words', 'secondary small space-top', 'mic', `data-id="${escape(id)}"`)}</div>` : ''}
    <div class="section-head"><h3>Words for this quest</h3></div>${newWords.map(w => `<div class="trail-card quest-word"><div><h3 lang="ko">${escape(w.ko)}</h3><p class="muted tiny">${escape(w.en)}</p></div>${audioButton(w.ko, `Hear ${w.ko}`)}</div>`).join('') || '<p class="muted tiny">A new way to use words you already have.</p>'}
    ${button('start-lesson', lesson.completed ? 'Replay contract' : 'Accept contract', 'full space-top', 'arrow', `data-id="${escape(id)}" ${!lesson.ready && !lesson.completed ? 'disabled' : ''}`)}<p class="pronunciation-note">Quest puzzles build understanding. Your vocabulary becomes mastered through separate recall reviews.</p>`);
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
  const header = `<div class="back-heading"><button class="icon-button" data-action="exit-lesson" aria-label="Back to quests">${icon('back')}</button><div><span class="eyebrow">Your quest</span><h2>${escape(lesson.title)}</h2></div>${coinLabel(store.getProfile().coins)}</div>`;
  if (index < 0) {
    main.innerHTML = `${header}${questScene(lesson)}${questDialogue(lesson, lesson.quest?.intro)}<div class="card quest-pattern"><span class="eyebrow">Field notes · grammar</span><h2 class="grammar-title" lang="ko">${escape(lesson.grammar.title)}</h2><p class="grammar-text">${escape(lesson.grammar.explanation)}</p>${lesson.grammar.examples.map((ex, i) => `<div class="example-block"><div class="spoken-line"><div lang="ko" class="ko">${escape(ex.ko)}</div>${audioButton(ex.ko, `Hear example ${i + 1}`)}</div><p>${escape(ex.en)}</p></div>`).join('')}${button('lesson-next', 'Continue quest', 'full', 'arrow')}</div>`;
    return;
  }
  if (index >= lesson.challenges.length) {
    const completed = !!store.getLessonProgress()[lesson.id];
    main.innerHTML = `${header}${questScene(lesson, { proud: true })}${questDialogue(lesson, lesson.quest?.outro)}<div class="card quest-finish"><span class="eyebrow">Contract fulfilled</span><h2>Quest complete.</h2><p class="muted space-top">${lessonRun.mistakes ? 'All four challenges are complete. Your vocabulary is ready for further practice.' : 'Four challenges cleared. Collect your reward and check the board.'}</p><div class="quest-completion-reward">${completed ? `${icon('check')}<span>Revisited · first reward already collected</span>` : `${coinLabel(20)}<span>For your first completion</span>`}</div>${button('finish-lesson', completed ? 'Return to quest board' : 'Finish quest & collect 20 coins', 'full space-top', 'check')}</div>`;
    return;
  }
  const challenge = lesson.challenges[index];
  const step = lesson.quest?.steps?.[index];
  const answerArea = challenge.type === 'order'
    ? `<p class="muted tiny">Build the sentence. Tap a piece to move it; tap its speaker to listen.</p><div class="sentence-tray token-tray">${lessonRun.tokens.length ? lessonRun.tokens.map((token, i) => `<button class="token" lang="ko" data-action="remove-token" data-index="${i}" ${lessonRun.feedback ? 'disabled' : ''}>${escape(token)}</button>`).join('') : '<span class="sentence-placeholder">Your sentence goes here</span>'}</div>${lessonRun.tokens.length ? `<div class="sentence-listen">${audioButton(lessonRun.tokens.join(' '), 'Hear your sentence')}<span>Hear your sentence</span></div>` : ''}<div class="token-tray available-tokens">${challenge.options.map((token, i) => `<div class="token-with-audio"><button class="token" lang="ko" data-action="add-token" data-index="${i}" ${lessonRun.tokens.includes(token) || lessonRun.feedback ? 'disabled' : ''}>${escape(token)}</button>${audioButton(token, `Hear ${token}`, 'token-audio')}</div>`).join('')}</div>`
    : `<div class="answer-options">${challenge.options.map((option, i) => `<div class="answer-option-row"><button class="answer-option ${lessonRun.choice === option ? 'selected' : ''}" data-action="lesson-choice" data-index="${i}" aria-pressed="${lessonRun.choice === option}" ${lessonRun.feedback ? 'disabled' : ''}>${escape(option)}</button>${audioButton(option, `Hear option ${i + 1}`)}</div>`).join('')}</div>`;
  const example = step?.after;
  main.innerHTML = `${header}${questScene(lesson, { small: true })}<div class="practice-head quest-progress"><span>Step ${index + 1} of ${lesson.challenges.length}</span><span>${escape(lesson.quest?.location || 'Around town')}</span></div><div class="progress-line"><span style="width:${index / lesson.challenges.length * 100}%"></span></div>${step?.text ? `<p class="quest-beat">${escape(step.text)}</p>` : ''}<h2 class="challenge-prompt">${escape(challenge.prompt)}</h2>${challenge.ko ? `<div class="spoken-line challenge-line"><p lang="ko" class="ko">${escape(challenge.ko)}</p>${audioButton(challenge.ko, 'Hear the question')}</div>` : ''}
    ${answerArea}
    ${lessonRun.feedback ? `<div class="feedback ${lessonRun.feedback.correct ? '' : 'wrong'}" role="status"><strong>${lessonRun.feedback.correct ? 'Correct.' : 'Check the answer.'}</strong><p>${escape(challenge.explanation)}</p>${!lessonRun.feedback.correct ? `<p class="answer">${escape(challenge.answer)}</p>` : ''}${example?.ko ? `<div class="feedback-example"><span class="eyebrow">Say it out loud</span><div class="spoken-line"><p class="ko" lang="ko">${escape(example.ko)}</p>${audioButton(example.ko, 'Hear the model sentence')}</div><p>${escape(example.en)}</p></div>` : ''}</div>${button(lessonRun.feedback.correct ? 'lesson-next' : 'lesson-retry', lessonRun.feedback.correct ? 'Continue quest' : 'Try again', 'full space-top', 'arrow')}` : button('check-lesson', 'Check this sentence', 'full space-top', 'check')}`;
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
  showModal('Settings', `<div class="soft-note">Your vocabulary, review history and lessons are saved on this phone. Export a backup before moving to another phone or uninstalling.</div>
    <section class="settings-section"><h3>Your pace</h3><label class="setting-row"><span>Daily review goal</span><select id="daily-goal">${[5, 10, 15, 20].map(n => `<option value="${n}" ${Number(settings.dailyGoal || 10) === n ? 'selected' : ''}>${n} words</option>`).join('')}</select></label><label class="setting-row"><span>Korean audio speed</span><select id="speech-rate">${[[0.75, 'Gentle'], [0.85, 'Natural'], [1, 'Full speed']].map(([n, name]) => `<option value="${n}" ${Number(settings.speechRate || 0.85) === n ? 'selected' : ''}>${name}</option>`).join('')}</select></label></section>
    <section class="settings-section"><h3>Korean on your phone</h3><p>Translation and handwriting need a one-time model download, roughly 50 MB together. This download can use your current mobile connection.</p><div class="setting-row"><span>Translation model</span><span class="status-badge ${capabilities.translationReady ? '' : 'pending'}">${capabilities.translationReady ? 'Ready' : 'Download needed'}</span></div><div class="setting-row"><span>Handwriting model</span><span class="status-badge ${capabilities.inkReady ? '' : 'pending'}">${capabilities.inkReady ? 'Ready' : 'Download needed'}</span></div>${button('prepare-model', 'Prepare both Korean models', 'secondary full space-top', 'download', 'data-model="all"')}<p>Speech recognition and spoken audio use your phone’s installed services. Speech may be processed online by that provider; no recordings are stored by this app. Offline language availability varies by phone.</p>${button('speech-settings', 'Phone speech settings', 'outline full small', 'settings')}${button('tts-settings', 'Korean voice settings', 'outline full small space-top', 'volume')}</section>
    <section class="settings-section"><h3>Keep your progress</h3><p>Backups contain your words, review history, quests, character, coins, and wardrobe. Import merges with your saved progress.</p><div class="button-row equal">${button('export-data', 'Export backup', 'outline small', 'download')}${button('import-data', 'Import backup', 'outline small', 'upload')}</div></section>
    <section class="settings-section"><h3>How words grow</h3><p><strong>Black:</strong> collected, not tested yet.<br><strong>Yellow:</strong> learning through recall.<br><strong>Green:</strong> successful reviews in both directions across multiple days. A miss brings a word back into learning.</p><p>Speech is vocabulary recall, not a pronunciation score. Typed answers count too. Lesson puzzles help understanding; they don’t automatically mark vocabulary mastered.</p></section>
    <section class="settings-section"><h3>App updates</h3><p>Installed version: ${escape(capabilities.version || 'browser preview')}.</p>${button('show-updates', 'Get app updates', 'outline full small', 'download')}</section>
    <section class="settings-section"><h3>About Pocket Korean</h3><p>Korean for the road ahead. Version ${escape(capabilities.version || '0.1.0')} · ${isAndroid ? capabilities.updateChannel === 'personal' ? 'Personal release' : 'Prototype' : 'Browser preview'}. No app account or API key is needed.</p><p>Google Translate powers automatic translations via ML Kit. These are suggestions and may be incorrect. The app is independent of Google.</p><p><button class="inline-link" data-action="translation-notice">Translation attribution & disclaimer</button></p><p class="tiny">${isAndroid ? 'Your progress is local to this installation.' : 'Browser preview: handwriting checking, translation and microphone practice require the installed Android app.'}</p></section>`, 'settings');
}
function showUpdates({ result = null, error = '', checking = false } = {}) {
  const personal = capabilities.updateChannel === 'personal';
  const status = checking ? '<div class="update-result" role="status"><span class="spinner"></span>Checking the latest release…</div>'
    : error ? `<div class="inline-error" role="alert">${escape(error)}</div>`
    : result ? `<div class="update-result" role="status"><strong>${!result.found ? 'No release has been published yet.' : result.available ? `Version ${escape(result.latestVersion)} is available.` : 'No newer release is available.'}</strong><p>${!result.found ? 'The first permanent release will appear here after signing is set up.' : result.available ? 'Download the installer, then open it on this phone.' : `Latest published release: ${escape(result.latestVersion)}.`}</p></div>` : '';
  showModal('App updates', `<span class="eyebrow">Pocket Korean · ${escape(capabilities.version || 'browser preview')}</span><p class="quest-objective">Check for the latest public release. Downloads open in your phone’s browser.</p>${status}<div class="soft-note space-top">${personal ? 'Personal releases use a permanent app identity. Future releases from this setup can update the app and keep your progress.' : 'This is a prototype build. Export a backup before replacing it. Permanent update signing needs a one-time setup by the repository owner.'}</div>${result?.found && result?.available ? button('download-update', 'Download update', 'full space-top', 'download') : button('check-updates', checking ? 'Checking…' : 'Check for updates', 'full space-top', 'download', checking ? 'disabled' : '')}<div class="button-row equal space-top">${button('open-updates', 'All releases', 'outline small', 'arrow')}${button('export-data', 'Export backup', 'outline small', 'download')}</div>`, 'updates');
}
async function checkAppUpdates() {
  const token = ++updateCheckToken;
  showUpdates({ checking: true });
  const revision = modalRevision;
  try {
    const result = await native('checkForUpdates');
    if (token === updateCheckToken && modalKind === 'updates' && modalRevision === revision) showUpdates({ result });
  } catch (error) {
    if (token === updateCheckToken && modalKind === 'updates' && modalRevision === revision) showUpdates({ error: error.message || 'Could not check for updates. Try again when connected.' });
  }
}
async function exportData() {
  try { await native('exportBackup', { content: store.exportData(), name: `pocket-korean-${new Date().toISOString().slice(0, 10)}.json` }); toast('Backup exported.'); }
  catch (error) { handleError(error); }
}
async function importData() {
  try { const result = await native('importBackup'); const merged = store.importData(result.content); practice = null; lessonRun = null; speechToken++; closeModal(); render(); toast(`Backup merged. ${merged.added} new words added.`); }
  catch (error) { handleError(error); }
}

const actions = {
  'show-updates': () => showUpdates(),
  'check-updates': checkAppUpdates,
  'download-update': () => native('openUpdates', { mode: 'download' }).catch(handleError),
  'open-updates': () => native('openUpdates').catch(handleError),
  'home-section': el => { homeSection = ['room', 'shop', 'wardrobe'].includes(el.dataset.section) ? el.dataset.section : 'room'; if (route !== 'home') navigate('home'); else renderHome($('#main')); },
  'shop-slot': el => { if (!['hat', 'outfit', 'body'].includes(el.dataset.slot)) return; shopSlot = el.dataset.slot; renderHome($('#main')); },
  'buy-item': el => { const result = safeMutation(() => store.buyItem(el.dataset.id)); if (!result) return; renderHome($('#main')); toast(result.purchased ? `${result.item.name} acquired and equipped.` : 'Outfit updated.'); },
  'equip-item': el => { if (!safeMutation(() => store.equipItem(el.dataset.id))) return; renderHome($('#main')); toast('Availabler next adventure.'); },
  'rename-character': renameCharacter,
  'town-notebook': () => townNotebook(),
  'meet-character': el => townNotebook(el.dataset.id),
  'play-korean': el => speak(el.dataset.text),
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
  'lesson-next': () => { lessonRun.index++; lessonRun.choice = ''; lessonRun.tokens = []; lessonRun.feedback = null; renderLesson($('#main')); window.scrollTo({ top: 0, behavior: 'instant' }); },
  'lesson-choice': el => { lessonRun.choice = lessonRun.lesson.challenges[lessonRun.index].options[Number(el.dataset.index)]; renderLesson($('#main')); },
  'add-token': el => { const token = lessonRun.lesson.challenges[lessonRun.index].options[Number(el.dataset.index)]; if (!lessonRun.tokens.includes(token)) lessonRun.tokens.push(token); renderLesson($('#main')); },
  'remove-token': el => { lessonRun.tokens.splice(Number(el.dataset.index), 1); renderLesson($('#main')); },
  'check-lesson': checkLesson,
  'lesson-retry': () => { lessonRun.feedback = null; lessonRun.choice = ''; lessonRun.tokens = []; renderLesson($('#main')); },
  'finish-lesson': () => {
    if (!lessonRun || lessonRun.index < lessonRun.lesson.challenges.length) return;
    const saved = safeMutation(() => store.completeLesson(lessonRun.lesson.id));
    if (!saved) return;
    lessonRun = null; render(); toast(saved.coinsEarned ? `Quest complete! +${saved.coinsEarned} coins. Spend them at the outfitter.` : 'Quest replay complete. Progress saved.');
  },
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
  if (event.target.id === 'character-form') {
    event.preventDefault();
    try { store.setCharacterName($('#character-name').value.trim()); closeModal(); render(); toast('A name to take on your journey.'); }
    catch (error) { $('#character-form-error').innerHTML = `<div class="inline-error">${escape(error.message)}</div>`; }
  }
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
  if (route !== 'home') { navigate('home'); return true; }
  return false;
};

try {
  store = createStore(localStorage, { key: 'pocketLabKorean.v1', seed: VOCAB });
  inputMode = store.getSettings().answerMode || 'voice';
  practiceDirection = store.getSettings().testDirection || 'mixed';
  updateHeader();
  $('#settings-button').addEventListener('click', showSettings);
  navigate(location.hash.slice(1) || 'home');
  native('capabilities').then(result => { capabilities = result; if (route === 'translate' || route === 'write') render(); }).catch(() => {});
} catch (error) {
  $('#main').innerHTML = `<div class="page-intro"><h1>Your notebook needs attention.</h1><p>${escape(error.message)}</p></div><div class="soft-note">Your saved data has not been reset. Close and reopen the app. If you have a backup, keep it safe while we repair the notebook.</div>`;
}
