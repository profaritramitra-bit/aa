/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ResourceType = 'gold' | 'elixir' | 'dark_elixir' | 'gems';

export type BuildingCategory = 'defense' | 'resource' | 'storage' | 'army' | 'utility';

export type BuildingType =
  | 'town_hall'
  | 'gold_mine'
  | 'elixir_collector'
  | 'gold_storage'
  | 'elixir_storage'
  | 'cannon'
  | 'archer_tower'
  | 'mortar'
  | 'wall'
  | 'barracks';

export interface BuildingState {
  id: string;
  type: BuildingType;
  x: number; // grid coords 0 to 15
  y: number; // grid coords 0 to 15
  level: number;
  hp: number;
  maxHp: number;
  lastCollectedAt?: number; // for producers
}

export interface BuildingMeta {
  type: BuildingType;
  name: string;
  category: BuildingCategory;
  description: string;
  width: number; // grid size
  height: number; // grid size
  costType: 'gold' | 'elixir';
  baseCost: number;
  maxLevel: number;
  levelMultiplier: number;
  // Stats per level (level indexed, 0-based index corresponds to level - 1)
  statsByLevel: {
    hp: number;
    // Specific stats
    dps?: number;
    range?: number;
    rate?: number; // production rate per hour
    capacity?: number; // storage or producer cap
  }[];
}

export type TroopType = 'barbarian' | 'archer' | 'giant' | 'wizard' | 'dragon';

export interface TroopStats {
  type: TroopType;
  name: string;
  description: string;
  cost: number;
  trainingTime: number; // in seconds
  hp: number;
  dps: number;
  speed: number; // tiles per second
  range: number; // tiles
  favoriteTarget: 'any' | 'defenses' | 'resources';
  housingSpace: number;
  color: string;
}

export interface TroopInstance {
  id: string;
  type: TroopType;
  x: number; // float position
  y: number; // float position
  hp: number;
  maxHp: number;
  targetBuildingId: string | null;
  state: 'marching' | 'attacking' | 'dead';
  lastAttackAt: number; // simulation game tick timestamp
}

export interface ProjectileInstance {
  id: string;
  type: 'cannonball' | 'arrow' | 'fireball' | 'mortar_shell';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetTroopId: string;
  speed: number; // tiles per update
  damage: number;
  splashRadius?: number; // for mortar
}

export interface FloatingText {
  id: string;
  text: string;
  x: number; // grid float coordinates
  y: number;
  color: string;
  alpha: number;
  life: number; // countdown
}

export interface BattleParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ClanMessage {
  id: string;
  sender: string;
  role: 'Leader' | 'Co-Leader' | 'Elder' | 'Member';
  avatar: string;
  message: string;
  time: string;
}

export interface OpponentBase {
  id: string;
  name: string;
  theme: string;
  backstory: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  townHallLevel: number;
  goldReward: number;
  elixirReward: number;
  buildings: BuildingState[];
}

export interface BaseAuditResult {
  rating: string; // A+, B, F, etc.
  strengths: string[];
  weaknesses: string[];
  strategicAdvice: string;
}

// Stats constants for all structures
export const BUILDING_METADATA: Record<BuildingType, BuildingMeta> = {
  town_hall: {
    type: 'town_hall',
    name: 'Town Hall',
    category: 'utility',
    description: 'The heart of your village. Upgrading unlocks new structures and upgrades.',
    width: 2,
    height: 2,
    costType: 'gold',
    baseCost: 1000,
    maxLevel: 5,
    levelMultiplier: 3.5,
    statsByLevel: [
      { hp: 1500, capacity: 5000 },
      { hp: 2000, capacity: 15000 },
      { hp: 2800, capacity: 50000 },
      { hp: 3800, capacity: 150000 },
      { hp: 5000, capacity: 500000 },
    ],
  },
  gold_mine: {
    type: 'gold_mine',
    name: 'Gold Mine',
    category: 'resource',
    description: 'Digs deep into the earth to harvest precious gold reserves.',
    width: 1,
    height: 1,
    costType: 'elixir',
    baseCost: 150,
    maxLevel: 5,
    levelMultiplier: 2.2,
    statsByLevel: [
      { hp: 400, rate: 200, capacity: 500 },
      { hp: 520, rate: 500, capacity: 1500 },
      { hp: 680, rate: 1000, capacity: 4000 },
      { hp: 880, rate: 2000, capacity: 10000 },
      { hp: 1100, rate: 3500, capacity: 25000 },
    ],
  },
  elixir_collector: {
    type: 'elixir_collector',
    name: 'Elixir Collector',
    category: 'resource',
    description: 'Pumps raw Elixir from ley lines beneath your village.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 150,
    maxLevel: 5,
    levelMultiplier: 2.2,
    statsByLevel: [
      { hp: 400, rate: 200, capacity: 500 },
      { hp: 520, rate: 500, capacity: 1500 },
      { hp: 680, rate: 1000, capacity: 4000 },
      { hp: 880, rate: 2000, capacity: 10000 },
      { hp: 1100, rate: 3500, capacity: 25000 },
    ],
  },
  gold_storage: {
    type: 'gold_storage',
    name: 'Gold Storage',
    category: 'storage',
    description: 'Safely stores accumulated gold coins to fund future construction.',
    width: 1,
    height: 1,
    costType: 'elixir',
    baseCost: 300,
    maxLevel: 5,
    levelMultiplier: 2.5,
    statsByLevel: [
      { hp: 800, capacity: 5000 },
      { hp: 1200, capacity: 20000 },
      { hp: 1800, capacity: 75000 },
      { hp: 2700, capacity: 250000 },
      { hp: 4000, capacity: 1000000 },
    ],
  },
  elixir_storage: {
    type: 'elixir_storage',
    name: 'Elixir Storage',
    category: 'storage',
    description: 'Secure, glass-vessel vats for preserving trained fluid essences.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 300,
    maxLevel: 5,
    levelMultiplier: 2.5,
    statsByLevel: [
      { hp: 800, capacity: 5000 },
      { hp: 1200, capacity: 20000 },
      { hp: 1800, capacity: 75000 },
      { hp: 2700, capacity: 250000 },
      { hp: 4000, capacity: 1000000 },
    ],
  },
  cannon: {
    type: 'cannon',
    name: 'Cannon',
    category: 'defense',
    description: 'A heavy, iron artillery piece. Excellent at crushing single land units.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 250,
    maxLevel: 5,
    levelMultiplier: 2.4,
    statsByLevel: [
      { hp: 450, dps: 12, range: 6 },
      { hp: 580, dps: 20, range: 6.5 },
      { hp: 750, dps: 32, range: 7 },
      { hp: 970, dps: 48, range: 7.5 },
      { hp: 1250, dps: 70, range: 8 },
    ],
  },
  archer_tower: {
    type: 'archer_tower',
    name: 'Archer Tower',
    category: 'defense',
    description: 'Provides long-range protective watch covers. Can target land or air targets.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 400,
    maxLevel: 5,
    levelMultiplier: 2.4,
    statsByLevel: [
      { hp: 400, dps: 15, range: 8 },
      { hp: 520, dps: 24, range: 8.5 },
      { hp: 680, dps: 38, range: 9 },
      { hp: 880, dps: 55, range: 9.5 },
      { hp: 1150, dps: 80, range: 10 },
    ],
  },
  mortar: {
    type: 'mortar',
    name: 'Mortar',
    category: 'defense',
    description: 'Launches heavy shells to deal explosive splash damage. Blind at close range.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 800,
    maxLevel: 5,
    levelMultiplier: 2.6,
    statsByLevel: [
      { hp: 400, dps: 6, range: 10 }, // Range is actually min 3, max 10
      { hp: 500, dps: 10, range: 10.5 },
      { hp: 630, dps: 16, range: 11 },
      { hp: 800, dps: 24, range: 11.5 },
      { hp: 1000, dps: 36, range: 12 },
    ],
  },
  wall: {
    type: 'wall',
    name: 'Wall',
    category: 'defense',
    description: 'Thick fortifications to slow down enemy marchers.',
    width: 1,
    height: 1,
    costType: 'gold',
    baseCost: 50,
    maxLevel: 5,
    levelMultiplier: 3.0,
    statsByLevel: [
      { hp: 1000 },
      { hp: 1800 },
      { hp: 3000 },
      { hp: 5000 },
      { hp: 8000 },
    ],
  },
  barracks: {
    type: 'barracks',
    name: 'Barracks',
    category: 'army',
    description: 'Enlists and trains courageous recruits to form raiding regiments.',
    width: 1,
    height: 1,
    costType: 'elixir',
    baseCost: 200,
    maxLevel: 5,
    levelMultiplier: 2.5,
    statsByLevel: [
      { hp: 350 },
      { hp: 450 },
      { hp: 580 },
      { hp: 750 },
      { hp: 1000 },
    ],
  },
};

// Troop configurations
export const TROOP_METADATA: Record<TroopType, TroopStats> = {
  barbarian: {
    type: 'barbarian',
    name: 'Barbarian',
    description: 'A fearless warrior with a glorious mustache. Charges into melee range.',
    cost: 50,
    trainingTime: 3,
    hp: 120,
    dps: 18,
    speed: 1.5,
    range: 0.5,
    favoriteTarget: 'any',
    housingSpace: 1,
    color: '#fbbf24', // golden yellow
  },
  archer: {
    type: 'archer',
    name: 'Archer',
    description: 'Long-range sharp-shooter dressed in green. Attacks safely behind lines.',
    cost: 80,
    trainingTime: 5,
    hp: 60,
    dps: 15,
    speed: 1.8,
    range: 4,
    favoriteTarget: 'any',
    housingSpace: 1,
    color: '#ec4899', // pinkish arrow
  },
  giant: {
    type: 'giant',
    name: 'Giant',
    description: 'Heavy fist brawler who targets defenses first. Absorbs massive fire.',
    cost: 250,
    trainingTime: 12,
    hp: 650,
    dps: 22,
    speed: 1.0,
    range: 0.5,
    favoriteTarget: 'defenses',
    housingSpace: 5,
    color: '#b45309', // brown skin/jacket
  },
  wizard: {
    type: 'wizard',
    name: 'Wizard',
    description: 'Conjures magical fireballs for explosive ranged splash damage.',
    cost: 400,
    trainingTime: 20,
    hp: 180,
    dps: 45,
    speed: 1.4,
    range: 3.5,
    favoriteTarget: 'any',
    housingSpace: 4,
    color: '#3b82f6', // blue coat
  },
  dragon: {
    type: 'dragon',
    name: 'Dragon',
    description: 'A winged terror of the skies. Breathes streams of molten fire over walls.',
    cost: 2500,
    trainingTime: 60,
    hp: 2400,
    dps: 160,
    speed: 1.2,
    range: 2.5,
    favoriteTarget: 'any',
    housingSpace: 20,
    color: '#ef4444', // red hot
  },
};

// Initial starting layout for the player
export const INITIAL_VILLAGE: BuildingState[] = [
  { id: 'th1', type: 'town_hall', x: 7, y: 7, level: 1, hp: 1500, maxHp: 1500 },
  { id: 'gm1', type: 'gold_mine', x: 4, y: 5, level: 1, hp: 400, maxHp: 400, lastCollectedAt: Date.now() },
  { id: 'ec1', type: 'elixir_collector', x: 10, y: 5, level: 1, hp: 400, maxHp: 400, lastCollectedAt: Date.now() },
  { id: 'gs1', type: 'gold_storage', x: 5, y: 7, level: 1, hp: 800, maxHp: 800 },
  { id: 'es1', type: 'elixir_storage', x: 9, y: 7, level: 1, hp: 800, maxHp: 800 },
  { id: 'c1', type: 'cannon', x: 7, y: 5, level: 1, hp: 450, maxHp: 450 },
  { id: 'at1', type: 'archer_tower', x: 7, y: 10, level: 1, hp: 400, maxHp: 400 },
  { id: 'b1', type: 'barracks', x: 10, y: 9, level: 1, hp: 350, maxHp: 350 },
  // Protective walls around Town Hall
  { id: 'w1', type: 'wall', x: 6, y: 6, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w2', type: 'wall', x: 7, y: 6, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w3', type: 'wall', x: 8, y: 6, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w4', type: 'wall', x: 9, y: 6, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w5', type: 'wall', x: 6, y: 9, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w6', type: 'wall', x: 7, y: 9, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w7', type: 'wall', x: 8, y: 9, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w8', type: 'wall', x: 9, y: 9, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w9', type: 'wall', x: 6, y: 7, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w10', type: 'wall', x: 6, y: 8, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w11', type: 'wall', x: 9, y: 7, level: 1, hp: 1000, maxHp: 1000 },
  { id: 'w12', type: 'wall', x: 9, y: 8, level: 1, hp: 1000, maxHp: 1000 },
];
