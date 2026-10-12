import { COSMETICS, DEFAULT_EQUIPMENT } from './data/customization.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : fallback;
const cosmetic = id => COSMETICS.find(item => item.id === id);

export function appearanceFor(equipment = DEFAULT_EQUIPMENT) {
  const body = cosmetic(equipment.body) || cosmetic(DEFAULT_EQUIPMENT.body);
  const outfit = cosmetic(equipment.outfit) || cosmetic(DEFAULT_EQUIPMENT.outfit);
  const hat = cosmetic(equipment.hat) || cosmetic(DEFAULT_EQUIPMENT.hat);
  return { body: body?.color, outfit: outfit?.color, outfitStyle: outfit?.style,
    accent: outfit?.accent, hat: hat?.style, hatColor: hat?.color, hatAccent: hat?.accent };
}

// Original geometric artwork. Every player and recurring townsperson uses the
// same renderer, so equipped clothing carries into the quest scenes.
export function characterSvg(equipment = DEFAULT_EQUIPMENT, { appearance, label = 'Your character', mood = 'happy' } = {}) {
  const a = { ...appearanceFor(equipment), ...(appearance || {}) };
  const skin = color(a.body, '#eddbb4'), cloth = color(a.outfit, '#2d654d');
  const accent = color(a.accent, '#e2b752'), hat = color(a.hatColor, '#b57356');
  const hatAccent = color(a.hatAccent, '#f6d67a');
  const outline = '#294b3b';
  let headwear = '';
  if (a.hat === 'beanie') headwear = `<path d="M43 58c0-29 16-40 37-40s37 11 37 40Z" fill="${hat}"/><rect x="39" y="49" width="82" height="17" rx="8" fill="${hatAccent}"/><circle cx="80" cy="17" r="10" fill="${hat}"/><path d="M57 54v7m15-7v7m16-7v7m15-7v7" stroke="${hat}" stroke-width="2" opacity=".45"/>`;
  if (a.hat === 'cap') headwear = `<path d="M43 57c0-25 16-37 37-37s37 12 37 37Z" fill="${hat}"/><path d="M44 53h79c12 0 19 5 19 10H84c-19 0-30-3-40-10Z" fill="${hatAccent}"/><path d="M82 25v23" stroke="${hatAccent}" stroke-width="3"/><circle cx="82" cy="19" r="4" fill="${hatAccent}"/>`;
  if (a.hat === 'wizard') headwear = `<path d="m43 59 33-51c2-3 5-3 7 0l34 51Z" fill="${hat}"/><ellipse cx="80" cy="61" rx="49" ry="10" fill="${hat}"/><path d="m80 29 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2-4.5-4.4 6.2-.9Z" fill="${hatAccent}"/><path d="M55 52h50" stroke="${hatAccent}" stroke-width="5"/>`;
  if (a.hat === 'flower-crown') headwear = `<path d="M44 50q36-21 72 0" fill="none" stroke="${hatAccent}" stroke-width="7" stroke-linecap="round"/>${[[-25,48],[0,40],[25,48]].map(([x,y]) => `<g transform="translate(${80+x} ${y})" fill="${hat}"><ellipse cy="-6" rx="5" ry="7"/><ellipse cy="6" rx="5" ry="7"/><ellipse cx="-6" rx="7" ry="5"/><ellipse cx="6" rx="7" ry="5"/><circle r="4" fill="#d8a945"/></g>`).join('')}`;
  const cape = a.outfitStyle === 'cape' ? `<path d="M53 101Q80 88 107 101l20 63q-47 16-94 0Z" fill="${accent}"/>` : '';
  const scarf = a.outfitStyle === 'scarf' ? `<path d="M54 105h52v15H54Z" fill="${accent}"/><path d="M87 111h14v35l-7 6-7-6Z" fill="${accent}"/><path d="M90 138h8m-8 5h8" stroke="${cloth}" stroke-width="2" opacity=".6"/>` : '';
  const hoodie = a.outfitStyle === 'hoodie' ? `<path d="M59 111q21 17 42 0M67 116v17m26-17v17" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><path d="M65 137h30v14H65Z" fill="${accent}" opacity=".35"/>` : '';
  const eyes = mood === 'proud'
    ? `<path d="m60 76 4-3 4 3m24 0 4-3 4 3" fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round"/>`
    : `<ellipse cx="64" cy="75" rx="3" ry="4" fill="${outline}"/><ellipse cx="96" cy="75" rx="3" ry="4" fill="${outline}"/>`;
  return `<svg class="character-svg" viewBox="0 0 160 190" role="img" aria-label="${escape(label)}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="80" cy="178" rx="49" ry="7" fill="#254933" opacity=".1"/>
    ${cape}<rect x="56" y="145" width="18" height="30" rx="9" fill="${skin}"/><rect x="86" y="145" width="18" height="30" rx="9" fill="${skin}"/>
    <rect x="50" y="165" width="26" height="12" rx="6" fill="${outline}"/><rect x="84" y="165" width="26" height="12" rx="6" fill="${outline}"/>
    <path d="M53 112q-12 10-12 28m66-28q12 10 12 28" fill="none" stroke="${skin}" stroke-width="15" stroke-linecap="round"/>
    <path d="M52 112q0-15 28-15t28 15l5 34q1 14-14 14H61q-15 0-14-14Z" fill="${cloth}"/>
    ${hoodie}${scarf}<circle cx="80" cy="70" r="38" fill="${skin}"/>
    <ellipse cx="51" cy="85" rx="6" ry="3" fill="#cc947f" opacity=".35"/><ellipse cx="109" cy="85" rx="6" ry="3" fill="#cc947f" opacity=".35"/>
    ${eyes}<path d="M74 86q6 6 12 0" fill="none" stroke="${outline}" stroke-width="2.5" stroke-linecap="round"/>
    ${headwear}</svg>`;
}

export function sceneDecor(location = '') {
  const indoors = !/outside/i.test(location) && /tavern|café|restaurant|kitchen|shop|library|inn|book/i.test(location);
  return indoors
    ? '<div class="scene-window"><i></i><i></i></div><div class="scene-shelf"><i></i><i></i><i></i></div><div class="scene-table"></div>'
    : '<div class="scene-sun"></div><div class="scene-cloud"></div><div class="scene-house"><i></i></div><div class="scene-tree"></div>';
}
