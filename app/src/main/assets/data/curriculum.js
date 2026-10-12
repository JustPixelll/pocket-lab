/**
 * Small, authored beginner curriculum. Korean is always written in Korean script.
 * Pronunciation strings are reading hints, never spellings or speech-test answers.
 * Audio should speak `ko`, not the pronunciation hint.
 * Source and editorial limits are documented in docs/curriculum-sources.md.
 */

export const CURRICULUM_VERSION = 1;

/** A reusable fictional cast. Registry IDs stay independent of saved player style. */
export const CHARACTERS = {
  townkeeper: {
    id: 'townkeeper', name: '다온', role: 'Town keeper',
    bio: 'Keeps spare maps at the welcome desk and likes to make newcomers feel expected. Often has a small, practical errand to talk through.',
    appearance: {
      body: '#F5D4B3', outfit: '#477764', outfitStyle: 'scarf', accent: '#E7B563',
      hat: 'beanie', hatColor: '#365F4F', hatAccent: '#F4DFB3',
    },
  },
  courier: {
    id: 'courier', name: '하루', role: 'Courier',
    bio: 'Knows every shortcut but still writes the next route on a little card. Always has time for a quick introduction between deliveries.',
    appearance: {
      body: '#EABEA4', outfit: '#5B83B4', outfitStyle: 'hoodie', accent: '#F2C45F',
      hat: 'cap', hatColor: '#334966', hatAccent: '#F2C45F',
    },
  },
  cook: {
    id: 'cook', name: '보리', role: 'Café cook',
    bio: 'Runs the café counter and believes even a tiny adventure deserves a proper snack. Keeps a warm seat ready for another short conversation.',
    appearance: {
      body: '#F2D49C', outfit: '#D18B73', outfitStyle: 'tee', accent: '#6B9275',
      hat: 'beanie', hatColor: '#F6EDD9', hatAccent: '#C77F65',
    },
  },
  bookseller: {
    id: 'bookseller', name: '소담', role: 'Bookshop owner',
    bio: 'Keeps a bookshop near the café, with labels on almost everything. Turns everyday questions into reasons to open another book.',
    appearance: {
      body: '#D8B6A4', outfit: '#8A77A8', outfitStyle: 'scarf', accent: '#E0C596',
      hat: 'flower-crown', hatColor: '#486F54', hatAccent: '#E9BE61',
    },
  },
  rival: {
    id: 'rival', name: '나래', role: 'Friendly rival',
    bio: 'Loves little games and theatrical hats. Treats practice as a friendly rematch and always checks the supplies first.',
    appearance: {
      body: '#D9C1A1', outfit: '#6B9F9A', outfitStyle: 'hoodie', accent: '#EFB577',
      hat: 'wizard', hatColor: '#775A91', hatAccent: '#F4CE74',
    },
  },
};

export const CURRICULUM_SOURCES = [
  { id: 'dictionary', title: 'National Institute of Korean Language: Korean–English Learners’ Dictionary', url: 'https://krdict.korean.go.kr/eng/mainAction', purpose: 'Dictionary reference for meanings, usage, and pronunciation; examples in this app are authored separately.' },
  { id: 'language-sound', title: 'Dictionary entry: 한국어', url: 'https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=26910', purpose: '한국어 pronunciation and meaning.' },
  { id: 'school-sound', title: 'Dictionary entry: 학교', url: 'https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=73276', purpose: '학교 pronunciation.' },
  { id: 'key-sound', title: 'Dictionary search: 열쇠', url: 'https://krdict.korean.go.kr/eng/dicMarinerSearch/search?mainSearchWord=%EC%97%B4%EC%87%A0&nation=eng', purpose: 'Both standard vowel pronunciations of 열쇠.' },
  { id: 'together-sound', title: 'National Institute of Korean Language: 같이 pronunciation', url: 'https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=327454', purpose: '같이 is pronounced 가치.' },
  { id: 'delicious-sound', title: 'Dictionary entry: 맛있다', url: 'https://krdict.korean.go.kr/m/eng/searchResultView?ParaWordNo=70811&nation=eng&nationCode=6', purpose: 'Accepted pronunciation variants and inflected forms of 맛있다.' },
  { id: 'good-sound', title: 'National Institute of Korean Language: 좋아 pronunciation', url: 'https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=317245', purpose: 'The ㅎ sound is absent in 좋아.' },
  { id: 'copula', title: 'National Institute of Korean Language: 이에요 and 예요', url: 'https://korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=308945', purpose: 'The vowel-ending contraction 예요 and consonant-ending 이에요.' },
  { id: 'topic', title: 'Dictionary entry: 은', url: 'https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=86111', purpose: 'Topic, contrast, and emphasis uses of the particle.' },
  { id: 'object', title: 'Dictionary entry: 을', url: 'https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaWordNo=86355&nation=eng', purpose: 'Object marking; not a claim that every English object maps to this particle.' },
  { id: 'destination', title: 'National Institute of Korean Language: 학교에 가다', url: 'https://m.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=318644', purpose: '에 as a destination marker with 가다.' },
  { id: 'counting', title: 'National Institute of Korean Language: 한국어 첫걸음', url: 'https://korean.go.kr/common/download.do%3Bfront%3D5F080AC99A51E3FBDDED6C1224B875FB?c_file_name=c4b897e3-3c46-4c8b-bf5d-b28abbe3a789_1.pdf&file_path=etcData&o_file_name=%EC%B2%AB%EA%B1%B8%EC%9D%8C.pdf', purpose: 'Number forms before counters: 하나 → 한 개; 둘 → 두 개.' },
];

const entry = (id, ko, en, pronunciation, partOfSpeech, tags, exampleKo, exampleEn, extra = {}) => ({
  id, ko, en, pronunciation, partOfSpeech, tags,
  acceptedKo: [ko],
  acceptedEn: [en],
  example: { ko: exampleKo, en: exampleEn },
  starter: false,
  source: 'curated',
  sourceIds: ['dictionary'],
  note: '',
  ...extra,
});

/** Exactly twelve initially active cards; familiarity never assigns mastery. */
export const VOCAB = [
  entry('korean', '한국어', 'Korean language', '한구거', 'noun', ['language'],
    '한국어를 배워요.', 'I am learning Korean.', {
      starter: true, acceptedEn: ['Korean language', 'Korean', 'the Korean language'],
      note: 'The language. Keep the spelling 한국어; the reading hint shows the linked sounds.', sourceIds: ['dictionary', 'language-sound'],
    }),
  entry('alphabet', '한글', 'Korean alphabet', '한글', 'noun', ['language'],
    '한글을 배워요.', 'I am learning the Korean alphabet.', {
      starter: true, acceptedEn: ['Korean alphabet', 'the Korean alphabet', 'Korean writing system', 'the Korean writing system'],
      note: 'The writing system, rather than the language itself. The spelling is 한글.',
    }),
  entry('sleep', '자다', 'to sleep', '자다', 'verb', ['daily'],
    '지금 자요.', 'I am going to sleep now.', {
      starter: true, acceptedEn: ['to sleep', 'sleep'],
      note: 'Dictionary form. The everyday polite form is 자요.', politeForm: '자요',
    }),
  entry('good-night', '안녕히 주무세요', 'good night', '안녕히 주무세요', 'expression', ['greetings', 'daily'],
    '안녕히 주무세요.', 'Sleep well.', {
      starter: true, acceptedEn: ['good night', 'goodnight', 'sleep well', 'have a good night'],
      note: 'A respectful bedtime wish. 주무시다 is the respectful form of 자다; use this wish for the other person.',
    }),
  entry('thanks', '감사합니다', 'thank you', '감사함니다', 'expression', ['greetings'],
    '감사합니다.', 'Thank you.', {
      starter: true, acceptedKo: ['감사합니다', '고맙습니다'], acceptedEn: ['thank you', 'thanks', 'thank you very much'],
      note: 'A formal polite expression. The written ㅂ before ㄴ is pronounced ㅁ; write 합니다, even when you hear 함니다.',
    }),
  entry('now', '지금', 'now', '지금', 'noun/adverb', ['time'],
    '지금 물을 마셔요.', 'I am drinking water now.', {
      starter: true, acceptedEn: ['now', 'right now', 'at the moment'],
    }),
  entry('today', '오늘', 'today', '오늘', 'noun/adverb', ['time'],
    '오늘 학교에 가요.', 'I am going to school today.', { starter: true }),
  entry('hello', '안녕하세요', 'hello', '안녕하세요', 'expression', ['greetings'],
    '안녕하세요.', 'Hello.', {
      starter: true, acceptedEn: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening'],
      note: 'An everyday polite greeting that works at different times of day.',
    }),
  entry('yes', '네', 'yes', '네', 'interjection', ['greetings'],
    '네, 감사합니다.', 'Yes, thank you.', {
      starter: true, acceptedKo: ['네', '예'], acceptedEn: ['yes', 'yep', 'yeah'],
      note: 'A polite yes. In a conversation it can also show that you are listening. Negative questions need special care; these drills use straightforward positive prompts.',
    }),
  entry('no', '아니요', 'no', '아니요', 'interjection', ['greetings'],
    '아니요, 괜찮아요.', 'No, it is okay.', {
      starter: true,
      note: 'A polite no. Do not confuse this response with 아니에요, which can mean “is not”.',
    }),
  entry('sorry', '죄송해요', 'I am sorry', '죄송해요', 'expression', ['greetings'],
    '죄송해요.', 'I am sorry.', {
      acceptedKo: ['죄송해요', '죄송합니다'], acceptedEn: ['I am sorry', "I'm sorry", 'sorry', 'I apologize', 'I apologise'],
      note: 'A respectful apology. 죄송합니다 is a more formal alternative.',
    }),
  entry('okay', '괜찮아요', 'it is okay', '괜차나요', 'expression', ['greetings'],
    '네, 괜찮아요.', 'Yes, it is okay.', {
      acceptedEn: ['it is okay', "it's okay", 'it is ok', "it's ok", 'okay', 'ok', 'I am fine', "I'm fine", 'fine', 'all right', 'alright'],
      note: 'Depending on the situation: it is okay, I am fine, or no thank you. The ㅎ is not pronounced in this form.',
    }),
  entry('please-give', '주세요', 'please give me', '주세요', 'expression', ['cafe', 'requests'],
    '물 주세요.', 'Please give me water.', {
      starter: true, acceptedEn: ['please give me', 'please give', 'give me please', 'please'],
      note: 'Put the thing you want before 주세요. This is a request to give something, not a universal translation of every English “please”.',
    }),
  entry('again', '다시', 'again', '다시', 'adverb', ['language', 'daily'],
    '책을 다시 봐요.', 'I look at the book again.', { acceptedEn: ['again', 'once more'] }),
  entry('slowly', '천천히', 'slowly', '천천히', 'adverb', ['language', 'daily'],
    '천천히 먹어요.', 'I eat slowly.', { acceptedEn: ['slowly', 'at a slow pace'] }),
  entry('i', '저', 'I (polite)', '저', 'pronoun', ['people'],
    '저는 학생이에요.', 'I am a student.', {
      acceptedEn: ['I', 'me', 'I polite', 'I (polite)'],
      note: 'A humble first-person pronoun. 저 + 는 becomes 저는. 저 + 가 becomes 제가.',
    }),
  entry('name', '이름', 'name', '이름', 'noun', ['people'],
    '제 이름은 니키예요.', 'My name is Niki.', {
      acceptedEn: ['name', 'a name'], note: '제 means “my” politely. 이름은 attaches the topic particle 은 to 이름.',
    }),
  entry('student', '학생', 'student', '학쌩', 'noun', ['people', 'language'],
    '저는 학생이에요.', 'I am a student.', { acceptedEn: ['student', 'a student', 'pupil', 'a pupil'] }),
  entry('friend', '친구', 'friend', '친구', 'noun', ['people', 'play'],
    '친구가 여기 있어요.', 'My friend is here.', {
      acceptedEn: ['friend', 'a friend'],
      note: 'Often a friend of a similar age. Korean can leave “my” unstated when context makes it clear.',
    }),
  entry('person', '사람', 'person', '사람', 'noun', ['people'],
    '저는 오스트리아 사람이에요.', 'I am Austrian.', { acceptedEn: ['person', 'a person', 'human', 'a human'] }),
  entry('korea', '한국', 'South Korea', '한국', 'proper noun', ['places', 'people'],
    '한국에 가요.', 'I am going to South Korea.', {
      acceptedKo: ['한국', '대한민국'], acceptedEn: ['South Korea', 'Korea', 'Republic of Korea', 'the Republic of Korea'],
      note: 'Common everyday name for South Korea. In some contexts it is also translated simply as “Korea”.',
    }),
  entry('austria', '오스트리아', 'Austria', '오스트리아', 'proper noun', ['places', 'people'],
    '저는 오스트리아 사람이에요.', 'I am Austrian.'),
  entry('water', '물', 'water', '물', 'noun', ['cafe', 'food'],
    '물 주세요.', 'Water, please.', { starter: true, acceptedEn: ['water', 'some water'] }),
  entry('coffee', '커피', 'coffee', '커피', 'noun', ['cafe', 'food'],
    '커피 주세요.', 'Coffee, please.', { acceptedEn: ['coffee', 'a coffee', 'some coffee'] }),
  entry('tea', '차', 'tea', '차', 'noun', ['cafe', 'food'],
    '차를 마셔요.', 'I drink tea.', {
      acceptedEn: ['tea', 'some tea'], note: 'This card means the drink. The same written word can also mean a vehicle in a different context.',
    }),
  entry('milk', '우유', 'milk', '우유', 'noun', ['cafe', 'food'],
    '우유 주세요.', 'Milk, please.', { acceptedEn: ['milk', 'some milk'] }),
  entry('rice', '밥', 'cooked rice; meal', '밥', 'noun', ['food'],
    '밥을 먹어요.', 'I am eating a meal.', {
      acceptedEn: ['rice', 'cooked rice', 'meal', 'a meal', 'cooked rice; meal'],
      note: 'Cooked rice, or a meal more generally. Uncooked rice is 쌀.',
    }),
  entry('bread', '빵', 'bread', '빵', 'noun', ['cafe', 'food'],
    '빵을 먹어요.', 'I eat bread.', { acceptedEn: ['bread', 'some bread', 'a bread roll', 'a roll', 'a bun', 'bun'] }),
  entry('apple', '사과', 'apple', '사과', 'noun', ['food'],
    '사과가 있어요.', 'I have an apple.', {
      acceptedEn: ['apple', 'an apple'], note: 'This card means the fruit. An unrelated word written 사과 means an apology.',
    }),
  entry('english', '영어', 'English language', '영어', 'noun', ['language'],
    '영어를 배워요.', 'I am learning English.', { acceptedEn: ['English', 'English language', 'the English language'] }),
  entry('here', '여기', 'here', '여기', 'pronoun', ['places'],
    '문이 여기 있어요.', 'The door is here.', { acceptedEn: ['here', 'this place'] }),
  entry('where', '어디', 'where', '어디', 'pronoun', ['places', 'questions'],
    '카페가 어디에 있어요?', 'Where is the café?'),
  entry('home', '집', 'home; house', '집', 'noun', ['places', 'daily'],
    '집에 있어요.', 'I am at home.', { acceptedEn: ['home', 'house', 'a house', 'home; house'] }),
  entry('school', '학교', 'school', '학꾜', 'noun', ['places'],
    '학교에 가요.', 'I am going to school.', {
      acceptedEn: ['school', 'a school'], sourceIds: ['dictionary', 'school-sound'],
      note: 'The second ㄱ is pronounced as a tense sound, shown as ㄲ in the reading hint.',
    }),
  entry('cafe', '카페', 'café', '카페', 'noun', ['places', 'cafe'],
    '카페에 있어요.', 'I am at the café.', { acceptedEn: ['café', 'cafe', 'a cafe', 'a café', 'coffee shop', 'a coffee shop'] }),
  entry('this', '이거', 'this thing', '이거', 'pronoun', ['questions', 'items'],
    '이거 뭐예요?', 'What is this?', {
      acceptedKo: ['이거', '이것'], acceptedEn: ['this', 'this thing', 'this one'],
      note: 'A common spoken form of 이것. It refers to a thing; it is not the word 이 placed directly before a noun.',
    }),
  entry('book', '책', 'book', '책', 'noun', ['items', 'language'],
    '책을 봐요.', 'I look at a book.', { acceptedEn: ['book', 'a book'] }),
  entry('game', '게임', 'game', '게임', 'noun', ['play'],
    '같이 게임을 해요.', 'Let us play a game together.', { acceptedEn: ['game', 'a game', 'video game', 'a video game'] }),
  entry('sword', '검', 'sword', '검', 'noun', ['play', 'items'],
    '검이 있어요.', 'I have a sword.', {
      acceptedEn: ['sword', 'a sword'], note: 'A useful word in fantasy games. 칼 is a broader word for a blade or knife and can also mean a sword in context.',
    }),
  entry('shield', '방패', 'shield', '방패', 'noun', ['play', 'items'],
    '방패가 있어요.', 'I have a shield.', { acceptedEn: ['shield', 'a shield'] }),
  entry('door', '문', 'door', '문', 'noun', ['play', 'items'],
    '문이 여기 있어요.', 'The door is here.', { acceptedEn: ['door', 'a door', 'gate', 'a gate'] }),
  entry('key', '열쇠', 'key', '열쐬', 'noun', ['play', 'items'],
    '열쇠가 없어요.', 'I do not have a key.', {
      acceptedEn: ['key', 'a key'], pronunciationVariants: ['열쐬', '열쒜'], sourceIds: ['dictionary', 'key-sound'],
      note: 'A key for a lock. Both 열쐬 and 열쒜 are standard pronunciation variants.',
    }),
  entry('bag', '가방', 'bag', '가방', 'noun', ['items'],
    '가방에 책이 있어요.', 'There is a book in the bag.', { acceptedEn: ['bag', 'a bag', 'backpack', 'a backpack'] }),
  entry('good', '좋아요', 'it is good', '조아요', 'expression', ['play', 'greetings'],
    '네, 좋아요.', 'Yes, sounds good.', {
      acceptedEn: ['it is good', "it's good", 'good', 'nice', 'sounds good', 'it is nice', "it's nice"],
      note: 'A polite form of 좋다. It can be a positive response to a suggestion. 좋아해요 is a different form meaning “like”.', sourceIds: ['dictionary', 'good-sound'],
    }),
  entry('have', '있어요', 'have; there is', '이써요', 'expression', ['items', 'places'],
    '열쇠가 있어요.', 'I have a key.', {
      acceptedEn: ['have', 'I have it', 'there is', 'there are', 'it exists', 'exists', 'have; there is', 'I have'],
      note: 'A polite form of 있다. It expresses existence or possession depending on the sentence. It does not mean “have to”.',
    }),
  entry('not-have', '없어요', 'do not have; there is not', '업써요', 'expression', ['items', 'places'],
    '검이 없어요.', 'I do not have a sword.', {
      acceptedEn: ['do not have', "don't have", 'I do not have it', "I don't have it", 'there is not', "there isn't", 'there are not', "there aren't", 'does not exist', "doesn't exist", 'do not have; there is not'],
      note: 'A polite form of 없다. It expresses absence or not having something.',
    }),
  entry('eat', '먹다', 'to eat', '먹따', 'verb', ['food', 'daily'],
    '밥을 먹어요.', 'I eat a meal.', {
      acceptedEn: ['to eat', 'eat'], politeForm: '먹어요', note: 'Dictionary form. Use 먹어요 in an everyday polite sentence.',
    }),
  entry('drink', '마시다', 'to drink', '마시다', 'verb', ['food', 'daily'],
    '물을 마셔요.', 'I drink water.', {
      acceptedEn: ['to drink', 'drink'], politeForm: '마셔요', note: 'Dictionary form. The everyday polite form is 마셔요.',
    }),
  entry('go', '가다', 'to go', '가다', 'verb', ['places', 'daily'],
    '집에 가요.', 'I am going home.', {
      acceptedEn: ['to go', 'go'], politeForm: '가요', note: 'Dictionary form. The everyday polite form is 가요.',
    }),
  entry('come', '오다', 'to come', '오다', 'verb', ['places', 'daily'],
    '친구가 와요.', 'A friend is coming.', {
      acceptedEn: ['to come', 'come'], politeForm: '와요', note: 'Dictionary form. The everyday polite form is 와요. Direction is relative to the speaker or the situation.',
    }),
  entry('see', '보다', 'to see; to look at', '보다', 'verb', ['language', 'daily'],
    '책을 봐요.', 'I look at a book.', {
      acceptedEn: ['to see', 'see', 'to look', 'look', 'to look at', 'look at', 'to watch', 'watch', 'to see; to look at'],
      politeForm: '봐요', note: 'Dictionary form. The everyday polite form is 봐요. With a book it can mean looking at or reading it in context.',
    }),
  entry('do', '하다', 'to do', '하다', 'verb', ['play', 'daily'],
    '게임을 해요.', 'I play a game.', {
      acceptedEn: ['to do', 'do'], politeForm: '해요', note: 'Dictionary form. The everyday polite form is 해요. 게임을 해요 means “play a game”.',
    }),
  entry('learn', '배우다', 'to learn', '배우다', 'verb', ['language'],
    '한국어를 배워요.', 'I am learning Korean.', {
      acceptedEn: ['to learn', 'learn'], politeForm: '배워요', note: 'Dictionary form. The everyday polite form is 배워요.',
    }),
  entry('tomorrow', '내일', 'tomorrow', '내일', 'noun/adverb', ['time'],
    '내일 학교에 가요.', 'I am going to school tomorrow.'),
  entry('together', '같이', 'together', '가치', 'adverb', ['play', 'people'],
    '같이 게임을 해요.', 'Let us play a game together.', {
      acceptedKo: ['같이', '함께'], acceptedEn: ['together'],
      note: '같이 is pronounced 가치. The spelling remains 같이.', sourceIds: ['dictionary', 'together-sound'],
    }),
  entry('more', '더', 'more', '더', 'adverb', ['food', 'requests'],
    '물 더 주세요.', 'More water, please.', { acceptedEn: ['more', 'some more'] }),
  entry('delicious', '맛있어요', 'it is delicious', '마시써요', 'expression', ['food'],
    '빵이 맛있어요.', 'The bread is delicious.', {
      acceptedEn: ['it is delicious', "it's delicious", 'delicious', 'tasty', 'it is tasty', "it's tasty", 'it tastes good', 'tastes good'],
      pronunciationVariants: ['마시써요', '마디써요'], sourceIds: ['dictionary', 'delicious-sound'],
      note: 'A polite form of 맛있다. Both 마시써요 and 마디써요 follow accepted standard pronunciation variants.',
    }),
  entry('what', '뭐', 'what', '뭐', 'pronoun', ['questions'],
    '이거 뭐예요?', 'What is this?', {
      acceptedKo: ['뭐', '무엇'], note: 'A common spoken form of 무엇. 뭐예요? asks “What is it?” politely.',
    }),
  entry('one', '하나', 'one', '하나', 'number', ['numbers', 'items'],
    '사과 한 개 주세요.', 'One apple, please.', {
      acceptedEn: ['one', '1'], note: 'A native Korean number. Before the counter 개, use 한: 한 개.', sourceIds: ['dictionary', 'counting'],
    }),
  entry('two', '둘', 'two', '둘', 'number', ['numbers', 'items'],
    '사과 두 개 주세요.', 'Two apples, please.', {
      acceptedEn: ['two', '2'], note: 'A native Korean number. Before the counter 개, use 두: 두 개.', sourceIds: ['dictionary', 'counting'],
    }),
];

export const VOCAB_BY_ID = Object.fromEntries(VOCAB.map(word => [word.id, word]));

const choose = (id, prompt, answer, options, explanation, vocabIds, ko) => ({
  id, type: 'choose', prompt, answer, options, explanation, vocabIds, ...(ko ? { ko } : {}),
});
const order = (id, prompt, answer, options, explanation, vocabIds, acceptedAnswers = []) => ({
  id, type: 'order', prompt, answer, options, explanation, vocabIds, acceptedAnswers,
});

// Story text supplies a situation, not an extra quiz answer. Render `after` only
// after checking a challenge, as a model line rather than a fixed NPC quotation.
const sceneBeat = (text, ko, en) => ({ text, after: { ko, en } });
const QUEST_SCENES = {
  'first-hello': {
    location: 'Town welcome desk', npcId: 'townkeeper',
    objective: 'Make a first connection and borrow a little map.',
    intro: {
      text: 'The town keeper straightens a stack of maps as your character reaches the welcome desk. There is time for a small conversation before you choose where to go.',
      ko: '', en: '',
    },
    outro: {
      text: 'A folded map slides across the desk. The town feels a little less unfamiliar, and the keeper gives you a reassuring smile.',
      ko: '네, 괜찮아요.', en: 'Yes, it is okay.',
    },
    steps: [
      sceneBeat('The keeper looks up. This is your first chance to start the conversation.', '안녕하세요.', 'Hello.'),
      sceneBeat('A map is waiting for you. Give the exchange a friendly finish.', '감사합니다.', 'Thank you.'),
      sceneBeat('Before you leave, the keeper gives a short reply. Work out what it means.', '네, 감사합니다.', 'Yes, thank you.'),
      sceneBeat('Your bag catches the edge of the desk. A small accident needs a polite response.', '죄송해요.', 'I am sorry.'),
    ],
  },
  'name-badge': {
    location: 'Courier’s corner', npcId: 'courier',
    objective: 'Help the courier put your introduction on a name badge.',
    intro: {
      text: 'The courier is sorting blank name badges next to a bag of letters. A little introduction will help put yours in the right place.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'Your badge has a place on the board. The courier tucks the remaining cards away and waves you onward.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('The courier points to the student line on the badge. Try the introduction that belongs there.', '저는 학생이에요.', 'I am a student.'),
      sceneBeat('A badge for a friend is next. Choose an ending that fits, then compare it with another introduction.', '저는 니키예요.', 'I am Niki.'),
      sceneBeat('The next space tells people where you are from. Put the pieces of your introduction together.', '저는 오스트리아 사람이에요.', 'I am Austrian.'),
      sceneBeat('The courier reads the completed badge aloud. Check the name line before it goes on the board.', '제 이름은 니키예요.', 'My name is Niki.'),
    ],
  },
  'cafe-stop': {
    location: 'Café counter', npcId: 'cook',
    objective: 'Place a small order and recognize what another visitor requests.',
    intro: {
      text: 'The cook is also looking after the café counter. Your character finds a place beside a warm loaf and a row of cups.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The order is ready. The cook leaves room on the counter for your next visit.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('Start with a simple order before the counter gets busy.', '물 주세요.', 'Water, please.'),
      sceneBeat('Someone nearby places an order of their own. Work out what they chose.', '우유 주세요.', 'Milk, please.'),
      sceneBeat('Now place your next order. Put the item and the polite request in a useful order.', '커피 주세요.', 'Coffee, please.'),
      sceneBeat('There is one more drink label to recognize before you sit down.', '차', 'Tea.'),
    ],
  },
  inventory: {
    location: 'Town equipment shelf', npcId: 'townkeeper',
    objective: 'Help the keeper check a practice bag and its equipment.',
    intro: {
      text: 'The town keeper has set aside a practice bag and a few pieces of wooden equipment. Your character can help check what is ready.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The keeper puts the list beside the shelf. Everything has a label, including the gaps.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('Check the small item in your character’s hand and report what you have.', '열쇠가 있어요.', 'I have a key.'),
      sceneBeat('One entry on the list is missing. Read the note before you mark the empty space.', '검이 없어요.', 'I do not have a sword.'),
      sceneBeat('The next item needs a complete label. Choose the piece that makes the description fit.', '방패가 있어요.', 'I have a shield.'),
      sceneBeat('Give the keeper one clear update about your own bag.', '저는 열쇠가 있어요.', 'I have a key.'),
    ],
  },
  'find-the-cafe': {
    location: 'Outside the bookshop', npcId: 'bookseller',
    objective: 'Find a destination and make sense of a few location notes.',
    intro: {
      text: 'The bookshop owner is arranging a small display outside the shop. Your character stops for directions and discovers that everyday objects make a useful little map.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'With the route clear, the bookseller returns to the display. You know where to ask when another question comes along.',
      ko: '네, 괜찮아요.', en: 'Yes, it is okay.',
    },
    steps: [
      sceneBeat('You have a destination in mind. Ask for the part of the map you still need.', '카페가 어디에 있어요?', 'Where is the café?'),
      sceneBeat('A note mentions a misplaced item. Read it closely before deciding where to look.', '가방에 열쇠가 있어요.', 'There is a key in the bag.'),
      sceneBeat('Your character has found the entrance. Put the pieces together to tell someone where it is.', '문이 여기 있어요.', 'The door is here.'),
      sceneBeat('The bookseller reads a short message from a neighbor. Work out the location in the message.', '집에 있어요.', 'I am at home.'),
    ],
  },
  'lunch-break': {
    location: 'Café kitchen', npcId: 'cook',
    objective: 'Describe a few everyday actions during a lunch break.',
    intro: {
      text: 'The café counter is quieter now, and the cook has a small lunch break to share. Your character can try a little conversation while the food is still warm.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The cook gathers the plates with a smile. A little conversation has made an ordinary lunch into useful practice.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('Begin with the drink beside the plate. Choose a sentence for the action.', '물을 마셔요.', 'I drink water.'),
      sceneBeat('Read the next line as if it were your character’s quick lunch update.', '밥을 먹어요.', 'I eat a meal.'),
      sceneBeat('Write a tiny note about today’s lunch. Keep the action at the end.', '저는 오늘 빵을 먹어요.', 'I eat bread today.'),
      sceneBeat('The cook is waiting to hear what you thought. Choose a comment that fits.', '빵이 맛있어요.', 'The bread is delicious.'),
    ],
  },
  'small-plan': {
    location: 'Village postbox', npcId: 'courier',
    objective: 'Help organize a few short plans and messages.',
    intro: {
      text: 'The courier has two route cards on the bench: one for the present trip and one for the next day. Your character helps put a few short updates in the right place.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The route cards are in order. The courier closes the book, and your character has a short plan ready for another day.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('The courier asks you to check the next day’s route before it goes into the bag.', '내일 학교에 가요.', 'I am going to school tomorrow.'),
      sceneBeat('Make a short update for the trip happening today.', '저는 오늘 집에 가요.', 'I am going home today.'),
      sceneBeat('A message about the end of the day is tucked between the route cards. Read what the sender is doing.', '지금 자요.', 'I am going to sleep now.'),
      sceneBeat('The last note is from a friend. Work out what is about to happen.', '친구가 와요.', 'A friend is coming.'),
    ],
  },
  'play-together': {
    location: 'Game table', npcId: 'rival',
    objective: 'Make room for a friend in the next game.',
    intro: {
      text: 'Your friendly rival has set up a tiny game at the table. Winning can wait; first your character needs to invite someone into the next round.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The rival makes room at the table. You have enough words to start a round, and there will always be time for a rematch.',
      ko: '네, 좋아요.', en: 'Yes, sounds good.',
    },
    steps: [
      sceneBeat('There is an empty place across the table. Use your words to bring a friend into the game.', '같이 게임을 해요.', 'Let us play a game together.'),
      sceneBeat('No need to wait for another day. Put the invitation together for this moment.', '지금 같이 게임을 해요.', 'Let us play a game together now.'),
      sceneBeat('This time the invitation comes to you. Choose a friendly response.', '네, 좋아요.', 'Yes, sounds good.'),
      sceneBeat('Read the invitation as a whole before the pieces start moving.', '같이 게임을 해요.', 'Let us play a game together.'),
    ],
  },
  'language-mission': {
    location: 'Bookshop window', npcId: 'bookseller',
    objective: 'Ask about an object and share what you are learning.',
    intro: {
      text: 'The bookshop owner has placed an unfamiliar object beside a few handwritten signs. Your character can ask one small question and leave with a useful sentence about learning.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The bookseller leaves a bookmark beside your notebook. You can return to the same small sentences whenever the signs feel unfamiliar again.',
      ko: '감사합니다.', en: 'Thank you.',
    },
    steps: [
      sceneBeat('Point to the object on the counter. Choose the question that helps you identify it.', '이거 뭐예요?', 'What is this?'),
      sceneBeat('Now give a short answer about the object. Let the ending fit its name.', '책이에요.', 'It is a book.'),
      sceneBeat('Tell the bookseller what you are learning.', '저는 한국어를 배워요.', 'I am learning Korean.'),
      sceneBeat('Before closing the notebook, read the reminder on its last page.', '책을 다시 봐요.', 'Look at the book again.'),
    ],
  },
  'pack-the-quest': {
    location: 'Picnic packing bench', npcId: 'rival',
    objective: 'Count a few supplies and make a final request.',
    intro: {
      text: 'The rival is packing a small picnic bag beside the game table. Your character can help count a few things and make one last request before a break outside.',
      ko: '안녕하세요.', en: 'Hello.',
    },
    outro: {
      text: 'The bag is ready for a quiet break. The rival saves the game pieces for another day; the useful words can come with you.',
      ko: '네, 감사합니다.', en: 'Yes, thank you.',
    },
    steps: [
      sceneBeat('Begin with the first item label. Choose the number form that belongs with the counter.', '한 개', 'One item.'),
      sceneBeat('Put the request for fruit into a clear sentence.', '사과 두 개 주세요.', 'Two apples, please.'),
      sceneBeat('Read the inventory note before deciding how many keys are packed.', '열쇠 한 개가 있어요.', 'I have one key.'),
      sceneBeat('There is one more thing to request before leaving the counter.', '물 더 주세요.', 'More water, please.'),
    ],
  },
};

export const LESSONS = [
  {
    id: 'first-hello', title: 'First hello', subtitle: 'Meet the keeper of your little language town.', icon: 'chat',
    quest: QUEST_SCENES['first-hello'],
    prerequisiteVocab: [], prerequisiteLessons: [],
    teachVocab: ['hello', 'yes', 'no', 'thanks', 'sorry', 'okay', 'good-night'],
    sourceIds: ['dictionary'],
    grammar: {
      title: 'Polite phrases you can use whole',
      explanation: 'Begin with complete expressions: 안녕하세요 to greet someone, 감사합니다 to thank them, and 죄송해요 to apologize. These are polite forms. You do not need to build every ending yet. Use 안녕히 주무세요 as a respectful wish when the other person is going to sleep.',
      examples: [
        { ko: '안녕하세요.', en: 'Hello.' },
        { ko: '네, 감사합니다.', en: 'Yes, thank you.' },
        { ko: '안녕히 주무세요.', en: 'Sleep well.' },
      ],
    },
    challenges: [
      choose('hello-1', 'You meet the town keeper. Choose a polite hello.', '안녕하세요.', ['감사합니다.', '안녕하세요.', '아니요.', '죄송해요.'], '안녕하세요 is a polite greeting.', ['hello']),
      choose('hello-2', 'The keeper gives you a map. Thank them.', '감사합니다.', ['죄송해요.', '아니요.', '감사합니다.', '안녕히 주무세요.'], '감사합니다 expresses thanks. The sound hint is 감사함니다, but that is not the spelling.', ['thanks']),
      choose('hello-3', 'What does this short reply mean?', 'Yes.', ['No.', 'Yes.', 'Good night.', 'Sorry.'], '네 is a polite yes in this straightforward exchange.', ['yes'], '네.'),
      choose('hello-4', 'You accidentally bump into the keeper. What fits?', '죄송해요.', ['안녕히 주무세요.', '감사합니다.', '네.', '죄송해요.'], '죄송해요 is a respectful apology.', ['sorry']),
    ],
  },
  {
    id: 'name-badge', title: 'Your name badge', subtitle: 'Tell the town a little about yourself.', icon: 'words',
    quest: QUEST_SCENES['name-badge'],
    prerequisiteVocab: ['hello'], prerequisiteLessons: ['first-hello'],
    teachVocab: ['i', 'name', 'student', 'friend', 'person', 'austria', 'korea'],
    sourceIds: ['dictionary', 'copula', 'topic'],
    grammar: {
      title: '저는 …이에요 / …예요',
      explanation: '저는 sets “I” as the topic: as for me. Use a noun followed by 이에요 to identify someone or something. After a noun ending in a vowel, the usual shorter form is 예요: 학생이에요, 친구예요. The ending attaches directly to the noun. 은/는 marks a topic, and can also express contrast; it is not simply another word for “is”.',
      examples: [
        { ko: '저는 학생이에요.', en: 'I am a student.' },
        { ko: '저는 니키예요.', en: 'I am Niki.' },
        { ko: '저는 오스트리아 사람이에요.', en: 'I am Austrian.' },
      ],
    },
    challenges: [
      choose('badge-1', 'Say: I am a student.', '저는 학생이에요.', ['저는 학생이에요.', '저는 친구예요.', '저는 오스트리아 사람이에요.', '안녕하세요.'], '학생 means student. It ends in a consonant, so use 학생이에요.', ['i', 'student']),
      choose('badge-2', 'Which ending completes 친구___ in an everyday polite introduction?', '예요', ['예요', '가요', '먹어요', '주세요'], '친구 ends in a vowel. 친구예요 means “is a friend”.', ['friend']),
      order('badge-3', 'Build: I am Austrian.', '저는 오스트리아 사람이에요.', ['사람이에요.', '저는', '오스트리아'], '오스트리아 사람 means an Austrian person. 사람 ends in a consonant, so add 이에요.', ['i', 'austria', 'person']),
      choose('badge-4', 'What does this sentence tell you?', 'My name is Niki.', ['I am going to Korea.', 'My name is Niki.', 'My friend is a student.', 'Thank you.'], '제 means my; 이름은 introduces the name as the topic.', ['name'], '제 이름은 니키예요.'),
    ],
  },
  {
    id: 'cafe-stop', title: 'Your café stop', subtitle: 'Order something after your first conversation.', icon: 'coffee',
    quest: QUEST_SCENES['cafe-stop'],
    prerequisiteVocab: ['thanks'], prerequisiteLessons: ['first-hello'],
    teachVocab: ['water', 'coffee', 'tea', 'milk', 'bread', 'please-give'],
    sourceIds: ['dictionary'],
    grammar: {
      title: 'Something + 주세요',
      explanation: 'Name the thing you want, then add 주세요: 물 주세요. This is a polite request for someone to give you something. Korean often leaves out “me” when it is clear. 주세요 does not replace every kind of English “please”; this pattern is for requesting the named thing.',
      examples: [
        { ko: '물 주세요.', en: 'Water, please.' },
        { ko: '커피 주세요.', en: 'Coffee, please.' },
        { ko: '빵 주세요.', en: 'Bread, please.' },
      ],
    },
    challenges: [
      choose('cafe-1', 'Order water.', '물 주세요.', ['빵 주세요.', '커피 주세요.', '물 주세요.', '우유 주세요.'], '물 is water. Put it before 주세요.', ['water', 'please-give']),
      choose('cafe-2', 'What did the customer request?', 'Milk.', ['Tea.', 'Bread.', 'Water.', 'Milk.'], '우유 means milk.', ['milk'], '우유 주세요.'),
      order('cafe-3', 'Build a polite request for coffee.', '커피 주세요.', ['주세요.', '커피'], 'The requested item comes before 주세요.', ['coffee', 'please-give']),
      choose('cafe-4', 'Which drink is 차 here?', 'Tea.', ['Coffee.', 'Tea.', 'Milk.', 'Water.'], '차 means tea in this café context.', ['tea']),
    ],
  },
  {
    id: 'inventory', title: 'Inventory check', subtitle: 'Collect the gear for a very small adventure.', icon: 'game',
    quest: QUEST_SCENES.inventory,
    prerequisiteVocab: ['water', 'please-give', 'i'], prerequisiteLessons: ['name-badge', 'cafe-stop'],
    teachVocab: ['sword', 'shield', 'key', 'bag', 'door', 'have', 'not-have'],
    sourceIds: ['dictionary', 'key-sound'],
    grammar: {
      title: '이/가 있어요 · 이/가 없어요',
      explanation: '있어요 can describe something that exists or that you have. 없어요 describes its absence. For this pattern, put 이 after a noun ending in a consonant and 가 after a noun ending in a vowel: 검이, 방패가. Korean does not need a separate word for “a” in these sentences.',
      examples: [
        { ko: '열쇠가 있어요.', en: 'I have a key.' },
        { ko: '검이 없어요.', en: 'I do not have a sword.' },
        { ko: '방패가 있어요.', en: 'I have a shield.' },
      ],
    },
    challenges: [
      choose('inventory-1', 'Tell the keeper: I have a key.', '열쇠가 있어요.', ['열쇠가 없어요.', '검이 있어요.', '열쇠가 있어요.', '방패가 없어요.'], '열쇠 is key; 있어요 says you have it.', ['key', 'have']),
      choose('inventory-2', 'What is missing from the inventory?', 'A sword.', ['A key.', 'A sword.', 'A shield.', 'A bag.'], '검 is sword. 없어요 means it is not there or you do not have it.', ['sword', 'not-have'], '검이 없어요.'),
      choose('inventory-3', 'Choose the form that follows 방패 in this pattern.', '가 있어요', ['이 있어요', '가 있어요', '을 먹어요', '를 마셔요'], '방패 ends in a vowel, so this pattern uses 가: 방패가 있어요.', ['shield', 'have']),
      order('inventory-4', 'Build: I have a key.', '저는 열쇠가 있어요.', ['있어요.', '열쇠가', '저는'], '저는 sets the topic. 열쇠가 있어요 says a key is present for that person. Changing the order before 있어요 can shift the emphasis.', ['i', 'key', 'have'], ['열쇠가 저는 있어요.']),
    ],
  },
  {
    id: 'find-the-cafe', title: 'Find the café', subtitle: 'A little map, a door, and a useful question.', icon: 'pin',
    quest: QUEST_SCENES['find-the-cafe'],
    prerequisiteVocab: ['have', 'key'], prerequisiteLessons: ['inventory'],
    teachVocab: ['here', 'where', 'home', 'school', 'cafe', 'this'],
    sourceIds: ['dictionary'],
    grammar: {
      title: 'Place + 에 있어요',
      explanation: 'Use 에 after a place to say where someone or something is: 집에 있어요. 어디에 있어요? asks where it is. 에 stays attached to the place word. This is a location pattern with 있어요; describing where an action happens often uses a different particle, 에서.',
      examples: [
        { ko: '카페가 어디에 있어요?', en: 'Where is the café?' },
        { ko: '집에 있어요.', en: 'I am at home.' },
        { ko: '가방에 열쇠가 있어요.', en: 'There is a key in the bag.' },
      ],
    },
    challenges: [
      choose('map-1', 'Ask where the café is.', '카페가 어디에 있어요?', ['카페가 어디에 있어요?', '카페가 없어요.', '커피 주세요.', '열쇠가 있어요.'], '어디 means where. 어디에 있어요? asks about a location.', ['cafe', 'where', 'have']),
      choose('map-2', 'Where is the key?', 'In the bag.', ['At school.', 'In the bag.', 'At the café.', 'At home.'], '가방에 means in or at the bag in this location sentence.', ['bag', 'key'], '가방에 열쇠가 있어요.'),
      order('map-3', 'Build: The door is here.', '문이 여기 있어요.', ['있어요.', '문이', '여기'], '여기 means here. 문이 tells us what is here. Either can come first, with a small change in emphasis.', ['door', 'here', 'have'], ['여기 문이 있어요.']),
      choose('map-4', 'What does this tell you?', 'I am at home.', ['I have a house.', 'I am at home.', 'The school is here.', 'Where is the café?'], '집에 names the location. Context supplies the unstated “I” in this reply.', ['home', 'have'], '집에 있어요.'),
    ],
  },
  {
    id: 'lunch-break', title: 'Lunch break', subtitle: 'A tiny meal before the next quest.', icon: 'coffee',
    quest: QUEST_SCENES['lunch-break'],
    prerequisiteVocab: ['water', 'bread', 'i'], prerequisiteLessons: ['name-badge', 'cafe-stop'],
    teachVocab: ['rice', 'apple', 'eat', 'drink', 'delicious', 'more'],
    sourceIds: ['dictionary', 'object', 'delicious-sound'],
    grammar: {
      title: 'What you eat or drink: 을/를',
      explanation: 'In these sentences, 을/를 marks the thing being eaten or drunk. Use 을 after a consonant and 를 after a vowel: 밥을, 물을, 사과를. Learn the polite forms 먹어요 and 마셔요 with their dictionary forms 먹다 and 마시다. The action comes at the end.',
      examples: [
        { ko: '밥을 먹어요.', en: 'I eat a meal.' },
        { ko: '물을 마셔요.', en: 'I drink water.' },
        { ko: '빵이 맛있어요.', en: 'The bread is delicious.' },
      ],
    },
    challenges: [
      choose('lunch-1', 'Say: I drink water.', '물을 마셔요.', ['물을 먹어요.', '물을 마셔요.', '빵을 먹어요.', '사과를 먹어요.'], '마셔요 means drink in a polite sentence. 물 ends in a consonant, so use 물을.', ['water', 'drink']),
      choose('lunch-2', 'What are you doing in this sentence?', 'Eating a meal.', ['Drinking water.', 'Going home.', 'Eating a meal.', 'Learning Korean.'], '밥 can mean cooked rice or a meal. 먹어요 is the polite form of 먹다.', ['rice', 'eat'], '밥을 먹어요.'),
      order('lunch-3', 'Build: I eat bread today.', '저는 오늘 빵을 먹어요.', ['먹어요.', '빵을', '저는', '오늘'], '먹어요 ends the sentence. 오늘 gives the time, while 빵을 names the thing being eaten. Their order before the verb can change for emphasis.', ['i', 'today', 'bread', 'eat'], [
        '오늘 저는 빵을 먹어요.', '저는 빵을 오늘 먹어요.', '오늘 빵을 저는 먹어요.', '빵을 저는 오늘 먹어요.', '빵을 오늘 저는 먹어요.',
      ]),
      choose('lunch-4', 'You enjoyed the bread. Choose the matching comment.', '빵이 맛있어요.', ['빵이 없어요.', '물 더 주세요.', '빵이 맛있어요.', '집에 있어요.'], '맛있어요 describes food that tastes good. It does not use the object pattern from 먹어요.', ['bread', 'delicious']),
    ],
  },
  {
    id: 'small-plan', title: 'A tiny plan', subtitle: 'Today, tomorrow, and a place to go.', icon: 'clock',
    quest: QUEST_SCENES['small-plan'],
    prerequisiteVocab: ['school', 'home', 'today'], prerequisiteLessons: ['find-the-cafe'],
    teachVocab: ['go', 'come', 'today', 'tomorrow', 'now', 'sleep'],
    sourceIds: ['dictionary', 'destination'],
    grammar: {
      title: 'Destination + 에 가요',
      explanation: 'Use a place plus 에 가요 to say where you are going. Time words such as 오늘, 내일, and 지금 can come earlier in the sentence without adding 에 to them here. A present polite form can describe a planned action when a time word makes the timing clear. 가다 becomes 가요; 오다 becomes 와요; 자다 becomes 자요.',
      examples: [
        { ko: '내일 학교에 가요.', en: 'I am going to school tomorrow.' },
        { ko: '오늘 집에 가요.', en: 'I am going home today.' },
        { ko: '지금 자요.', en: 'I am going to sleep now.' },
      ],
    },
    challenges: [
      choose('plan-1', 'Which sentence plans a trip to school tomorrow?', '내일 학교에 가요.', ['오늘 집에 가요.', '내일 학교에 가요.', '학교에 있어요.', '지금 자요.'], '내일 sets tomorrow as the time; 학교에 is the destination.', ['tomorrow', 'school', 'go']),
      order('plan-2', 'Build: I am going home today.', '저는 오늘 집에 가요.', ['가요.', '저는', '집에', '오늘'], '집에 names the destination and 오늘 gives the time. 가요 comes at the end. The earlier pieces can move to change the emphasis.', ['i', 'today', 'home', 'go'], [
        '오늘 저는 집에 가요.', '저는 집에 오늘 가요.', '오늘 집에 저는 가요.', '집에 저는 오늘 가요.', '집에 오늘 저는 가요.',
      ]),
      choose('plan-3', 'What does this bedtime update mean?', 'I am going to sleep now.', ['I am going to school.', 'I am coming tomorrow.', 'I am going to sleep now.', 'Sleep well.'], '자요 describes the speaker’s action here. 안녕히 주무세요 would be a respectful wish for someone else.', ['now', 'sleep'], '지금 자요.'),
      choose('plan-4', 'Your friend says this. What is happening?', 'A friend is coming.', ['A friend is coming.', 'A friend is sleeping.', 'A friend has a key.', 'A friend is at school.'], '와요 is the everyday polite form of 오다.', ['friend', 'come'], '친구가 와요.'),
    ],
  },
  {
    id: 'play-together', title: 'Play together', subtitle: 'Invite a friend to your first Korean mini quest.', icon: 'game',
    quest: QUEST_SCENES['play-together'],
    prerequisiteVocab: ['have', 'eat'], prerequisiteLessons: ['inventory', 'lunch-break'],
    teachVocab: ['game', 'together', 'do', 'good'],
    sourceIds: ['dictionary', 'object', 'together-sound', 'good-sound'],
    grammar: {
      title: '같이 … 해요',
      explanation: '게임을 해요 means play a game. 하다 takes the polite form 해요. In an invitation, 같이 게임을 해요 can mean “Let us play a game together”. Context and intonation matter: the same polite form can also describe what people do. 좋아요 is a natural positive response to the invitation.',
      examples: [
        { ko: '같이 게임을 해요.', en: 'Let us play a game together.' },
        { ko: '지금 같이 게임을 해요.', en: 'Let us play a game together now.' },
        { ko: '네, 좋아요.', en: 'Yes, sounds good.' },
      ],
    },
    challenges: [
      choose('play-1', 'Invite your friend to play together.', '같이 게임을 해요.', ['게임이 없어요.', '같이 게임을 해요.', '게임 주세요.', '지금 자요.'], '같이 adds together; 게임을 해요 is play a game. Here the context makes this an invitation.', ['together', 'game', 'do']),
      order('play-2', 'Build: Let us play a game together now.', '지금 같이 게임을 해요.', ['게임을', '해요.', '지금', '같이'], 'Put the action at the end. 지금, 같이, and 게임을 can move before it to change emphasis. 같이 is spelled this way even though its reading hint is 가치.', ['now', 'together', 'game', 'do'], [
        '지금 게임을 같이 해요.', '같이 지금 게임을 해요.', '같이 게임을 지금 해요.', '게임을 지금 같이 해요.', '게임을 같이 지금 해요.',
      ]),
      choose('play-3', 'Accept the invitation politely.', '네, 좋아요.', ['아니요, 없어요.', '네, 좋아요.', '죄송해요.', '어디에 있어요?'], '좋아요 can mean sounds good as a response to a suggestion.', ['yes', 'good']),
      choose('play-4', 'Which complete meaning fits this invitation?', 'Let us play a game together.', ['I have a game.', 'Where is the game?', 'Let us play a game together.', 'Please give me a game.'], 'The invitation combines 같이 with 게임을 해요.', ['together', 'game', 'do'], '같이 게임을 해요.'),
    ],
  },
  {
    id: 'language-mission', title: 'Read the little signs', subtitle: 'Ask what something is, then learn one new thing.', icon: 'learn',
    quest: QUEST_SCENES['language-mission'],
    prerequisiteVocab: ['korean', 'student', 'eat', 'this'], prerequisiteLessons: ['name-badge', 'lunch-break', 'find-the-cafe'],
    teachVocab: ['korean', 'alphabet', 'english', 'learn', 'see', 'book', 'again', 'slowly', 'what'],
    sourceIds: ['dictionary', 'copula', 'object', 'language-sound'],
    grammar: {
      title: '이거 뭐예요?',
      explanation: '이거 뭐예요? asks “What is this?” in everyday polite speech. 이거 is a spoken form of 이것, and 뭐 is a spoken form of 무엇. You can answer with a noun and the identification ending you already met: 책이에요, 한국어예요. For your own learning, the new verb 배우다 becomes 배워요.',
      examples: [
        { ko: '이거 뭐예요?', en: 'What is this?' },
        { ko: '책이에요.', en: 'It is a book.' },
        { ko: '저는 한국어를 배워요.', en: 'I am learning Korean.' },
      ],
    },
    challenges: [
      choose('language-1', 'Ask what the object is.', '이거 뭐예요?', ['이거 뭐예요?', '카페가 어디에 있어요?', '한국어를 배워요.', '네, 좋아요.'], '뭐 asks what; 어디 asks where.', ['this', 'what']),
      choose('language-2', 'The object is a book. Give a short polite answer.', '책이에요.', ['책예요.', '책이에요.', '책가 있어요.', '책을 해요.'], '책 ends in a consonant, so the identification ending is 이에요.', ['book']),
      order('language-3', 'Build: I am learning Korean.', '저는 한국어를 배워요.', ['배워요.', '저는', '한국어를'], '한국어 is the language being learned, so it takes 를. 배워요 is the polite form of 배우다. Putting 한국어를 first can give it extra emphasis.', ['i', 'korean', 'learn'], ['한국어를 저는 배워요.']),
      choose('language-4', 'Which meaning fits this reminder?', 'Look at the book again.', ['Play a game together.', 'Drink the water slowly.', 'Look at the book again.', 'Go to school tomorrow.'], '다시 means again. 봐요 is the polite form of 보다; here it is used as a reminder.', ['book', 'again', 'see'], '책을 다시 봐요.'),
    ],
  },
  {
    id: 'pack-the-quest', title: 'Pack the next quest', subtitle: 'Two apples, one key, and enough Korean to set off.', icon: 'words',
    quest: QUEST_SCENES['pack-the-quest'],
    prerequisiteVocab: ['apple', 'key', 'please-give', 'have'], prerequisiteLessons: ['inventory', 'lunch-break'],
    teachVocab: ['one', 'two', 'more'],
    sourceIds: ['dictionary', 'counting'],
    grammar: {
      title: '하나 → 한 개 · 둘 → 두 개',
      explanation: '하나 and 둘 are native Korean numbers. Before the item counter 개, use 한 and 두: 한 개, 두 개. Put the item before the number-and-counter group: 사과 두 개. 개 works for the items here; Korean has other counters for people, cups, books, and more, so do not use it for everything.',
      examples: [
        { ko: '사과 한 개 주세요.', en: 'One apple, please.' },
        { ko: '사과 두 개 주세요.', en: 'Two apples, please.' },
        { ko: '열쇠 한 개가 있어요.', en: 'I have one key.' },
      ],
    },
    challenges: [
      choose('pack-1', 'Choose the correct form for one item with 개.', '한 개', ['하나 개', '한 개', '둘 개', '두 개'], '하나 changes to 한 before this counter. 두 개 means two items.', ['one']),
      order('pack-2', 'Build a polite request for two apples.', '사과 두 개 주세요.', ['주세요.', '개', '사과', '두'], 'The order is item, number, counter, request. 둘 becomes 두 before 개.', ['apple', 'two', 'please-give']),
      choose('pack-3', 'How many keys are in the inventory?', 'One.', ['None.', 'One.', 'Two.', 'The sentence does not say.'], '한 개 specifies one item. 있어요 says it is present.', ['key', 'one', 'have'], '열쇠 한 개가 있어요.'),
      choose('pack-4', 'You need more water before leaving. What fits?', '물 더 주세요.', ['물을 마셔요.', '물 더 주세요.', '물은 없어요.', '물이에요.'], '더 means more. Add it before 주세요 in this short request.', ['water', 'more', 'please-give']),
    ],
  },
];

/**
 * @param {{id: string, stage?: 'new'|'learning'|'mastered', status?: 'new'|'learning'|'mastered'}[]} cards Active cards only.
 * @param {string[]|Set<string>} completedIds Successfully completed lesson IDs.
 * @returns {Array<object>} Lessons with their readiness and missing prerequisites.
 * A newly added card is not evidence of learning; stage/status must be learning/mastered.
 * Completed lessons remain replayable even if the learner later removes a card.
 */
export function recommendLessons(cards = [], completedIds = []) {
  const activeCards = Array.isArray(cards) ? cards : [];
  const known = new Set(activeCards
    .filter(card => card && ['learning', 'mastered'].includes(card.stage ?? card.status))
    .map(card => card.id));
  const completed = new Set(completedIds || []);

  return LESSONS.map((lesson, index) => {
    const missingVocabIds = lesson.prerequisiteVocab.filter(id => !known.has(id));
    const missingLessonIds = lesson.prerequisiteLessons.filter(id => !completed.has(id));
    const isCompleted = completed.has(lesson.id);
    const knownCount = lesson.prerequisiteVocab.length - missingVocabIds.length;
    const ready = isCompleted || (missingVocabIds.length === 0 && missingLessonIds.length === 0);
    const reason = isCompleted
      ? 'Ready to replay'
      : ready
        ? (knownCount ? `Builds on ${knownCount} words you have started learning` : 'Your first small step')
        : missingLessonIds.length
          ? `Finish ${missingLessonIds.map(id => LESSONS.find(item => item.id === id)?.title || id).join(' and ')}`
          : `Practice ${missingVocabIds.map(id => VOCAB_BY_ID[id]?.ko || id).join(', ')}`;
    return {
      ...lesson, ready, completed: isCompleted, missingVocabIds, missingLessonIds, knownCount, reason,
      _rank: isCompleted ? 2 : ready ? 0 : 1,
      _missing: missingVocabIds.length + missingLessonIds.length,
      _index: index,
    };
  })
    .sort((a, b) => a._rank - b._rank || a._missing - b._missing || a._index - b._index)
    .map(({ _rank, _missing, _index, ...lesson }) => lesson);
}
