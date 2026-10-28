import { Rarity } from './config';

export interface GemDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly flavor: string;
}

/** v1 roster: 24 gems (8 Quartz, 7 Amethyst, 5 Emerald, 3 Ruby, 1 Diamond). */
export const ROSTER: readonly GemDef[] = [
  // Quartz
  { id: 'pebble', name: 'Pebble', rarity: 'quartz', flavor: 'Small, round, and proud of it.' },
  { id: 'frost', name: 'Frost', rarity: 'quartz', flavor: 'Chills out so you don’t have to.' },
  { id: 'honey', name: 'Honey', rarity: 'quartz', flavor: 'Sweet as a sunny afternoon.' },
  { id: 'dewdrop', name: 'Dewdrop', rarity: 'quartz', flavor: 'Wakes up before the moss does.' },
  { id: 'mochi', name: 'Mochi', rarity: 'quartz', flavor: 'Soft on the outside, softer inside.' },
  { id: 'pip', name: 'Pip', rarity: 'quartz', flavor: 'The tiniest gem with the biggest hello.' },
  { id: 'biscuit', name: 'Biscuit', rarity: 'quartz', flavor: 'Crumbly, cozy, and always warm.' },
  { id: 'sprout', name: 'Sprout', rarity: 'quartz', flavor: 'Dreams of growing into a boulder.' },
  // Amethyst
  { id: 'plum', name: 'Plum', rarity: 'amethyst', flavor: 'Hums a tune only caves can hear.' },
  { id: 'bluebell', name: 'Bluebell', rarity: 'amethyst', flavor: 'Rings softly when you smile.' },
  { id: 'lilac', name: 'Lilac', rarity: 'amethyst', flavor: 'Smells like the first spring rain.' },
  { id: 'twilight', name: 'Twilight', rarity: 'amethyst', flavor: 'Naps from dusk until dusk.' },
  { id: 'wisp', name: 'Wisp', rarity: 'amethyst', flavor: 'Floats a little when nobody looks.' },
  { id: 'mauve', name: 'Mauve', rarity: 'amethyst', flavor: 'Collects stories in its facets.' },
  { id: 'starling', name: 'Starling', rarity: 'amethyst', flavor: 'Sparkles just to say good morning.' },
  // Emerald
  { id: 'fern', name: 'Fern', rarity: 'emerald', flavor: 'Unfurls a little every time you visit.' },
  { id: 'clover', name: 'Clover', rarity: 'emerald', flavor: 'Believes every day is a lucky one.' },
  { id: 'moss', name: 'Moss', rarity: 'emerald', flavor: 'Gives the best hugs in the cave.' },
  { id: 'jade', name: 'Jade', rarity: 'emerald', flavor: 'Calm, steady, and secretly silly.' },
  { id: 'sprig', name: 'Sprig', rarity: 'emerald', flavor: 'Always smells like fresh tea.' },
  // Ruby
  { id: 'ember', name: 'Ember', rarity: 'ruby', flavor: 'Keeps the whole mine toasty.' },
  { id: 'cherry', name: 'Cherry', rarity: 'ruby', flavor: 'Blushes at every compliment.' },
  { id: 'blaze', name: 'Blaze', rarity: 'ruby', flavor: 'Small spark, enormous heart.' },
  // Diamond
  { id: 'halo', name: 'Halo', rarity: 'diamond', flavor: 'Turns every shadow into a rainbow.' },
];

export function gemsOfRarity(roster: readonly GemDef[], rarity: Rarity): GemDef[] {
  return roster.filter((g) => g.rarity === rarity);
}

export function findGem(roster: readonly GemDef[], id: string): GemDef | undefined {
  return roster.find((g) => g.id === id);
}
