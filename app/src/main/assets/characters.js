import { COSMETICS, DEFAULT_EQUIPMENT } from './data/customization.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const cosmetic = id => COSMETICS.find(item => item.id === id);

export function appearanceFor(equipment = DEFAULT_EQUIPMENT) {
  const body = cosmetic(equipment.body) || cosmetic(DEFAULT_EQUIPMENT.body);
  const outfit = cosmetic(equipment.outfit) || cosmetic(DEFAULT_EQUIPMENT.outfit);
  const hat = cosmetic(equipment.hat) || cosmetic(DEFAULT_EQUIPMENT.hat);
  return { body: body?.color, outfit: outfit?.color, outfitStyle: outfit?.style,
    accent: outfit?.accent, hat: hat?.style, hatColor: hat?.color, hatAccent: hat?.accent,
    archetype: 'wayfarer', expression: 'focused', signatureProp: 'satchel' };
}

// Original vector art: angular travel clothes, readable equipment, and distinct
// role silhouettes. The same equipment renderer is used in camp and every quest.
export function characterSvg(equipment = DEFAULT_EQUIPMENT, { appearance, label = 'Your character', mood = 'ready' } = {}) {
  const a = { ...appearanceFor(equipment), ...(appearance || {}) };
  const skin = color(a.body, '#DFC3A1'), cloth = color(a.outfit, '#C5AD86');
  const accent = color(a.accent, '#80654A'), hat = color(a.hatColor, '#34463B');
  const hatAccent = color(a.hatAccent, '#C39A63');
  const ink = '#252D2B', leather = '#654B36', brass = '#C29B5F';
  const roles = ['wayfarer', 'quartermaster', 'scout', 'provisioner', 'archivist', 'delver'];
  const role = roles.includes(a.archetype) ? a.archetype : 'wayfarer';
  const expression = mood === 'proud' ? 'satisfied' : a.expression;
  const hair = role === 'archivist' ? '#C8C1AF' : role === 'scout' ? '#703E2D' : '#343330';
  const isCloak = a.outfitStyle === 'cape' || ['scout', 'archivist', 'delver'].includes(role);
  const cloak = isCloak ? `<path d="M54 88 37 101 26 164l27-7 21 9 37-3 24 8-21-74-20-12Z" fill="${cloth}"/><path d="m42 107-9 49 20-8 9-56m46 9 16 58-15-6" fill="${ink}" opacity=".22"/>` : '';
  const longHair = ['scout', 'archivist', 'delver'].includes(role)
    ? `<path d="M99 40q24 4 15 31l10 35-18-7-7-31Z" fill="${hair}"/>` : '';
  const roll = ['scout', 'wayfarer'].includes(role) ? `<g transform="rotate(13 112 99)"><rect x="104" y="87" width="17" height="45" rx="5" fill="#73816A"/><path d="M106 98h13m-13 23h13" stroke="${leather}" stroke-width="4"/><path d="M108 91h9" stroke="#B8BDA0" stroke-width="2"/></g>` : '';
  const sword = role === 'delver' ? `<g transform="rotate(24 113 120)"><path d="M109 62h8v102l-4 11-4-11Z" fill="#424D4E"/><path d="M111 66h2v92" stroke="#B3B4A3" stroke-width="2"/><path d="M101 76h24" stroke="${brass}" stroke-width="5"/><rect x="109" y="51" width="8" height="23" rx="2" fill="${leather}"/><path d="M109 54h8m-8 7h8" stroke="#C9B087" stroke-width="2"/></g>` : '';
  let headwear = '';
  if (a.hat === 'beanie') headwear = `<path d="M50 49q-2-32 34-32l23 11 4 23Z" fill="${hat}"/><path d="m49 43 59-2 4 14-62 3Z" fill="${hatAccent}"/><path d="m58 47 1 6m8-7 1 6m8-7 1 6m8-7 1 6m8-7 1 6" stroke="${hat}" stroke-width="2"/>`;
  if (a.hat === 'cap') headwear = `<path d="m49 50 9-25 41-7 18 27-22 9Z" fill="${hat}"/><path d="m48 48 63-6 21 10-32 7-48-2Z" fill="${hatAccent}"/><path d="m98 26 8-15-1 25" fill="#D6C69B"/><path d="m68 30 4 12" stroke="${hatAccent}" stroke-width="2"/>`;
  if (a.hat === 'wizard') headwear = `<path d="m49 48 25-44 21 8-5 9 25 26Z" fill="${hat}"/><path d="m42 45 68-3 22 12-39 10-61-10Z" fill="${hat}"/><path d="m55 42 45-5 8 9-55 5Z" fill="${hatAccent}"/><path d="m78 16 2 4 5 1-4 3 1 5-4-2-4 2 1-5-3-3 4-1Z" fill="#D9C89F"/>`;
  if (a.hat === 'flower-crown') headwear = `<path d="M50 44q30-11 61 0" fill="none" stroke="${hatAccent}" stroke-width="5"/>${[[-22,42],[0,37],[22,42]].map(([x,y]) => `<g transform="translate(${80+x} ${y})" fill="${hat}"><path d="m0-7 3 4 5 1-4 4-1 5-4-3-5 1 1-5-3-4 5-1Z"/><circle r="2" fill="${brass}"/></g>`).join('')}`;
  const coat = a.outfitStyle === 'hoodie' ? `<path d="m61 93 19 24 19-24 10 54-29 13-28-13Z" fill="${cloth}"/><path d="m61 93 12 24 7-6 7 6 12-24M80 112v43" fill="none" stroke="${accent}" stroke-width="4"/><path d="m57 139 15-3m17 0 15 3" stroke="${brass}" stroke-width="2"/>` : '';
  const wrap = a.outfitStyle === 'scarf' ? `<path d="m53 88 21-7 30 8-10 18-34-5Z" fill="${accent}"/><path d="m59 97 11 3-8 31-11-9Z" fill="${accent}"/><path d="m65 90 28 8m-35 17 8 2" stroke="${cloth}" stroke-width="2"/>` : '';
  const shoulder = role === 'quartermaster' || role === 'delver'
    ? `<path d="m49 90 17 1-5 18-19-4Z" fill="#666F67"/><path d="m47 94 14 2m-15 4 13 2" stroke="#9EA38D" stroke-width="2"/><circle cx="57" cy="101" r="2" fill="${brass}"/>` : '';
  const apron = role === 'provisioner' ? `<path d="M68 94h24l12 54-24 7-24-7Z" fill="#C7B38E"/><path d="M66 121h28v16H66Z" fill="#AA8B66"/><path d="m68 94-3-8m27 8 3-8" stroke="#C7B38E" stroke-width="4"/>` : '';
  const strap = !['provisioner', 'archivist'].includes(role) ? `<path d="m97 91-43 48" stroke="${leather}" stroke-width="7"/><path d="m83 109 5 5" stroke="${brass}" stroke-width="5"/>` : '';
  const props = {
    satchel: `<path d="m40 125 23 4-4 28-25-5Z" fill="${leather}"/><path d="m39 126 23 4-3 9-22-4Z" fill="#896747"/><path d="m49 135-1 7" stroke="${brass}" stroke-width="3"/>`,
    ledger: `<g transform="rotate(-8 112 132)"><rect x="99" y="114" width="25" height="35" rx="2" fill="#583C31"/><path d="M104 114v35m3-5h15" stroke="#C5A877" stroke-width="2"/><path d="M110 128h11" stroke="${brass}" stroke-width="3"/></g>`,
    compass: `<path d="M111 103v22" stroke="${leather}" stroke-width="2"/><circle cx="116" cy="134" r="12" fill="${brass}"/><circle cx="116" cy="134" r="8" fill="#DAD1AF"/><path d="m119 128-7 11 1-8Z" fill="#873F32"/><circle cx="116" cy="134" r="2" fill="${ink}"/>`,
    ladle: `<path d="m120 86-3 49" stroke="#9CA59B" stroke-width="5"/><ellipse cx="121" cy="83" rx="10" ry="6" fill="#687B74"/><ellipse cx="121" cy="81" rx="8" ry="4" fill="#303E39"/><path d="m115 127 6 1" stroke="${skin}" stroke-width="8"/>`,
    scroll: `<g transform="rotate(-13 113 130)"><path d="M101 111h22v35h-22Z" fill="#D6C7A0"/><ellipse cx="112" cy="111" rx="11" ry="4" fill="#AC9672"/><ellipse cx="112" cy="146" rx="11" ry="4" fill="#E8DABD"/><path d="M106 122h11m-11 5h8m-8 5h11" stroke="#8A7958" stroke-width="1.5"/><path d="M100 137h24" stroke="#884A38" stroke-width="4"/></g>`,
    sword: `<path d="m106 127 9 3-5 10-8-4Z" fill="${leather}"/>`,
  };
  const brows = expression === 'stern' ? 'm61 61 13 3m13 0 13-3' : expression === 'smirk' || expression === 'skeptical' ? 'm61 59 13 1m13 4 13-5' : 'm62 62 12-1m13 0 12 1';
  const mouth = expression === 'smirk' ? 'M75 82q9 2 15-4' : expression === 'stern' ? 'M74 82h14' : expression === 'satisfied' ? 'M73 80q8 6 16-1' : 'M76 82q5 2 11-1';
  const glasses = role === 'archivist' ? `<g fill="none" stroke="${brass}" stroke-width="2"><circle cx="67" cy="69" r="8"/><circle cx="94" cy="69" r="8"/><path d="M75 69h11m-27-1-7-3m50 3 7-3"/></g>` : '';
  const facialDetail = role === 'quartermaster' ? `<path d="m60 77 5 9 15 7 17-8 5-10-8 10-14 3-15-6Z" fill="${hair}" opacity=".42"/><path d="m94 49 6 5" stroke="#B8B5A4" stroke-width="4"/>` : role === 'delver' ? `<path d="m99 72-5 7" stroke="#9A6550" stroke-width="1.4"/>` : '';
  return `<svg class="character-svg" data-archetype="${role}" data-hat="${escape(a.hat)}" viewBox="0 0 160 190" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="80" cy="179" rx="49" ry="6" fill="#101B19" opacity=".25"/>
    ${longHair}${cloak}${roll}${sword}
    <path d="m61 139 16 1-3 33H58Zm23 1 16-1 4 34H86Z" fill="#4F5144"/>
    <path d="M57 163h19l-1 17H50v-7Zm28 0h18l7 10v7H85Z" fill="${ink}"/><path d="M56 168h19m11 0h18" stroke="${leather}" stroke-width="4"/>
    <path d="m51 92-9 17-8 24 12 5 15-31m39-15 15 14 8 26-12 5-16-29" fill="${cloth}"/>
    <path d="m36 124 13 5m58-1 13-5" stroke="${accent}" stroke-width="8"/>
    <path d="m34 132 12 4-3 12-11-4m78-7 11-4 4 11-11 4" fill="${skin}"/>
    <path d="m55 91 17-8h17l17 8 7 51-16 12H63l-15-12Z" fill="${cloth}"/>
    <path d="m70 89 10 14 11-14M80 103v38" fill="none" stroke="${accent}" stroke-width="2.5"/>
    ${coat}${apron}${shoulder}${strap}<path d="M51 131h58v8H51Z" fill="${leather}"/><rect x="75" y="130" width="12" height="10" rx="1" fill="${brass}"/><rect x="78" y="132" width="6" height="6" fill="${leather}"/>
    <path d="M71 75h19v16l-10 7-9-7Z" fill="${skin}"/>
    ${wrap}<path d="M50 59h8v16h-7Zm53 0h8l-1 16h-7Z" fill="${skin}"/>
    <path d="M54 48q0-25 27-25 26 0 26 25v23q-3 17-26 23-23-6-27-23Z" fill="${skin}"/>
    <path d="M51 62V43q-1-22 28-24l20 6 11 13 1 23-11-11-5-15-11 13-19-3-8 16Z" fill="${hair}"/>
    <path d="${brows}" fill="none" stroke="${hair}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M64 68h7m19 0h7" stroke="${ink}" stroke-width="2"/><ellipse cx="68" cy="70" rx="2" ry="3" fill="${ink}"/><ellipse cx="93" cy="70" rx="2" ry="3" fill="${ink}"/>
    <path d="m82 70-2 6h4" fill="none" stroke="#8F6650" stroke-width="1.3" opacity=".55"/>
    <path d="${mouth}" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>
    ${facialDetail}${glasses}${headwear}${props[a.signatureProp] || props.satchel}
  </svg>`;
}

export function sceneDecor(location = '') {
  const camp = /camp/i.test(location);
  const archive = /archive|archivist|library|book/i.test(location);
  const kitchen = /kitchen|cook|canteen|provision|mess/i.test(location);
  const indoors = !/outside|gate|road|trail|camp|yard|watch|steps/i.test(location) && (archive || kitchen || /quartermaster|guild|hall|office|store|tavern|inn|café|cafe|counter|lodge|post|kettle|room/i.test(location));
  const wall = indoors ? `<path d="M0 0h480v226H0Z" fill="#35403A"/><path d="M0 58h480M0 130h480M0 199h480M71 0v58m111 0v72m-143 0v69M324 0v58m80 0v72m-91 0v69" stroke="#455048" stroke-width="2" opacity=".55"/><path d="M197 145V65a43 43 0 0 1 86 0v80Z" fill="#192C2B" stroke="#71745C" stroke-width="10"/><path d="M206 136V67a34 34 0 0 1 68 0v69Z" fill="#9B9F7B"/><path d="M240 29v111m-37-40h73" stroke="#5A614D" stroke-width="6"/><path d="M73 43h39v93l-20-13-19 13Z" fill="#896644"/><path d="m81 70 12-13 11 13-11 17Z" fill="#C7A461"/>` : `<path d="M0 0h480v280H0Z" fill="#203D3D"/><circle cx="369" cy="53" r="28" fill="#BDAB79"/><path d="M0 134 66 67l64 49 90-81 115 102 66-61 79 75v108H0Z" fill="#35534B"/><path d="m0 189 111-67 95 37 99-38 175 66v93H0Z" fill="#29483E"/><path d="m24 182 24-77 25 77H58v37H38v-37m343 4 27-105 30 105h-21v40h-19v-40" fill="#172F2B"/><path d="M139 173v-53h13v-13h17v13h11v53Zm18-34h9v15h-9Z" fill="#657060" opacity=".6"/><path d="M328 42q7-5 12 0 5-5 11 0m-35 22q6-4 10 0 4-4 8 0" fill="none" stroke="#152F2D" stroke-width="2"/>`;
  let furnishings = '';
  if (camp) furnishings = '<path d="m22 224 48-78 50 78Z" fill="#987E54"/><path d="m70 146 10 78H46Z" fill="#554C38"/><path d="M20 226h103" stroke="#C0A475" stroke-width="4"/><path d="m357 232 37-8m-34-3 34 13" stroke="#473C2C" stroke-width="7"/><path d="M370 226q-12-18 4-32 0 12 10 13 11 13-1 20Z" fill="#C89450"/><path d="M375 225q-4-8 4-15 8 10 1 15Z" fill="#E9C57E"/>';
  else if (archive) furnishings = '<path d="M343 57h87v132h-87Z" fill="#242F29"/><path d="M340 99h94m-94 46h94m-90 47V50m85 142V50" stroke="#877553" stroke-width="6"/><path d="M353 67h12v30h-12Zm18-8h13v38h-13Zm20 9h10v29h-10Zm15-3h14v32h-14ZM350 113h13v30h-13Zm18 1h11v29h-11Zm18-7h16v36h-16Zm22 6h12v30h-12Z" fill="#947457"/><path d="M372 64v29m21 23v22" stroke="#BEAA78" stroke-width="3"/>';
  else if (kitchen) furnishings = '<path d="M341 184v-60a38 38 0 0 1 76 0v60Z" fill="#252C24" stroke="#74715A" stroke-width="9"/><path d="M363 179q-18-19 3-37 2 11 12 16 10-2 12-13 19 17 5 34Z" fill="#B47D41"/><path d="M365 86h32v20q-16 8-32 0Z" fill="#4A5549"/><path d="M378 41v39" stroke="#8E957E" stroke-width="3"/>';
  else if (indoors) furnishings = '<path d="M342 150h66v68h-66ZM370 105h61v46h-61Z" fill="#756547"/><path d="m343 153 63 61m-63 0 63-61m-35-44 57 39M347 178h57m-49-26v62m40-62v62" stroke="#494B36" stroke-width="4"/><path d="M47 189h55v8H47Z" fill="#A1885C"/>';
  else furnishings = '<path d="M35 202v-48h30v-12h47v12h22v48Z" fill="#6A725B"/><path d="M74 202v-29q12-17 25 0v29Z" fill="#283F35"/><path d="M56 152v-28h11v29m-4-28 22-7v17Z" fill="#A28750"/><path d="m220 221 32-22 56 22-30 19Z" fill="#7A795B"/>';
  return `<svg class="scene-backdrop" viewBox="0 0 480 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${wall}<path d="M0 222q124-21 247 1t233-3v60H0Z" fill="#585E46"/><path d="M0 254q187-14 480 0" fill="none" stroke="#7A7856" opacity=".3" stroke-width="2"/>${furnishings}</svg>`;
}
