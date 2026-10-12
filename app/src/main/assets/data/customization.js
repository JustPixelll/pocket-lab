/** Small, offline cosmetic catalogue. IDs and prices are part of saved purchase receipts. */
export const COSMETIC_SLOTS = Object.freeze(['hat', 'outfit', 'body']);
export const DEFAULT_CHARACTER_NAME = '콩이';
export const DEFAULT_EQUIPMENT = Object.freeze({
  hat: 'hat-none', outfit: 'outfit-tee', body: 'body-cream',
});

export const COSMETICS = Object.freeze([
  { id: 'hat-none', slot: 'hat', name: 'No hat', price: 0, style: 'none', color: '#2D654D', accent: '#F0D18D' },
  { id: 'hat-beanie', slot: 'hat', name: 'Cozy beanie', price: 20, style: 'beanie', color: '#D79573', accent: '#B97256' },
  { id: 'hat-cap', slot: 'hat', name: 'Explorer cap', price: 30, style: 'cap', color: '#5C83AB', accent: '#395F85' },
  { id: 'hat-wizard', slot: 'hat', name: 'Little wizard', price: 80, style: 'wizard', color: '#66548B', accent: '#F0CF72' },
  { id: 'hat-flower-crown', slot: 'hat', name: 'Flower crown', price: 60, style: 'flower-crown', color: '#E7AEAA', accent: '#759B6B' },
  { id: 'outfit-tee', slot: 'outfit', name: 'Everyday tee', price: 0, style: 'tee', color: '#EBDEC6', accent: '#CFB68E' },
  { id: 'outfit-scarf', slot: 'outfit', name: 'Golden scarf', price: 20, style: 'scarf', color: '#D79758', accent: '#B6783F' },
  { id: 'outfit-hoodie', slot: 'outfit', name: 'Garden hoodie', price: 40, style: 'hoodie', color: '#7C9F91', accent: '#537B6C' },
  { id: 'outfit-cape', slot: 'outfit', name: 'Adventure cape', price: 60, style: 'cape', color: '#879CB9', accent: '#F0D18D' },
  { id: 'body-cream', slot: 'body', name: 'Warm cream', price: 0, style: 'solid', color: '#F0D6AF', accent: '#D6AD80' },
  { id: 'body-sand', slot: 'body', name: 'Golden sand', price: 0, style: 'solid', color: '#C6916C', accent: '#AA7353' },
  { id: 'body-cocoa', slot: 'body', name: 'Warm cocoa', price: 0, style: 'solid', color: '#815442', accent: '#5F3C31' },
  { id: 'body-mint', slot: 'body', name: 'Mint leaf', price: 20, style: 'solid', color: '#BFD6B5', accent: '#8FB184' },
  { id: 'body-peach', slot: 'body', name: 'Peach blossom', price: 20, style: 'solid', color: '#E8B9AB', accent: '#CC9184' },
  { id: 'body-lavender', slot: 'body', name: 'Lavender cloud', price: 30, style: 'solid', color: '#CCBEDE', accent: '#A38CBA' },
].map(item => Object.freeze(item)));

export const COSMETIC_BY_ID = Object.freeze(Object.fromEntries(COSMETICS.map(item => [item.id, item])));
