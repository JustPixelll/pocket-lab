/** Offline travel equipment catalogue. IDs and prices are part of saved purchase receipts. */
export const COSMETIC_SLOTS = Object.freeze(['hat', 'outfit', 'body']);
export const DEFAULT_CHARACTER_NAME = '콩이';
export const DEFAULT_EQUIPMENT = Object.freeze({
  hat: 'hat-none', outfit: 'outfit-tee', body: 'body-cream',
});

export const COSMETICS = Object.freeze([
  { id: 'hat-none', slot: 'hat', name: 'No hat', price: 0, style: 'none', color: '#34463B', accent: '#C39A63' },
  { id: 'hat-beanie', slot: 'hat', name: 'Wool cap', price: 20, style: 'beanie', color: '#79634B', accent: '#4E4133' },
  { id: 'hat-cap', slot: 'hat', name: 'Scout cap', price: 30, style: 'cap', color: '#4D624B', accent: '#A7794F' },
  { id: 'hat-wizard', slot: 'hat', name: "Mage's hat", price: 80, style: 'wizard', color: '#303842', accent: '#BB8D53' },
  { id: 'hat-flower-crown', slot: 'hat', name: 'Wildflower circlet', price: 60, style: 'flower-crown', color: '#D3BC87', accent: '#536548' },
  { id: 'outfit-tee', slot: 'outfit', name: 'Travel tunic', price: 0, style: 'tee', color: '#C5AD86', accent: '#80654A' },
  { id: 'outfit-scarf', slot: 'outfit', name: 'Ranger wrap', price: 20, style: 'scarf', color: '#B27749', accent: '#684832' },
  { id: 'outfit-hoodie', slot: 'outfit', name: 'Trail coat', price: 40, style: 'hoodie', color: '#435846', accent: '#2A3E32' },
  { id: 'outfit-cape', slot: 'outfit', name: "Adventurer's cloak", price: 60, style: 'cape', color: '#4A4540', accent: '#B78A52' },
  { id: 'body-cream', slot: 'body', name: 'Parchment', price: 0, style: 'solid', color: '#DFC3A1', accent: '#A97A54' },
  { id: 'body-sand', slot: 'body', name: 'Sandstone', price: 0, style: 'solid', color: '#B98155', accent: '#895735' },
  { id: 'body-cocoa', slot: 'body', name: 'Umber', price: 0, style: 'solid', color: '#76513D', accent: '#4D3328' },
  { id: 'body-mint', slot: 'body', name: 'Forest', price: 20, style: 'solid', color: '#78856A', accent: '#495A40' },
  { id: 'body-peach', slot: 'body', name: 'Copper', price: 20, style: 'solid', color: '#B37855', accent: '#7B4D36' },
  { id: 'body-lavender', slot: 'body', name: 'Slate', price: 30, style: 'solid', color: '#78818A', accent: '#505964' },
].map(item => Object.freeze(item)));

export const COSMETIC_BY_ID = Object.freeze(Object.fromEntries(COSMETICS.map(item => [item.id, item])));
