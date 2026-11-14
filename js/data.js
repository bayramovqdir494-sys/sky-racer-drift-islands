export const SAVE_KEY = 'skyRacerSaveV1';
export const GAME_TITLE = 'Sky Racer';
export const GAME_SUB = 'Drift Islands';

export const COLORS = [
  { id: 'red',    name: 'Crimson',  hex: 0xe23a2f, cost: 0 },
  { id: 'blue',   name: 'Azure',    hex: 0x2f7bff, cost: 0 },
  { id: 'yellow', name: 'Solar',    hex: 0xffc526, cost: 200 },
  { id: 'lime',   name: 'Volt',     hex: 0x7dff3a, cost: 200 },
  { id: 'orange', name: 'Blaze',    hex: 0xff7a18, cost: 350 },
  { id: 'purple', name: 'Nebula',   hex: 0xb44bff, cost: 400 },
  { id: 'white',  name: 'Ghost',    hex: 0xf2f4f8, cost: 500 },
  { id: 'black',  name: 'Shadow',   hex: 0x1a1d24, cost: 600 },
  { id: 'cyan',   name: 'Ion',      hex: 0x2ee6ff, cost: 800 },
  { id: 'pink',   name: 'Nova',     hex: 0xff4fa3, cost: 800 }
];

// acc / top / handling / nitro / drift / air — base stats before upgrades
export const CARS = [
  { id: 'hatch',  name: 'Sky Hatch',   price: 0,    acc: 16.5, top: 28.5, handling: 1.04, nitro: 1.16, drift: 1.00, air: 1.00, desc: 'Balanced starter. Forgiving and easy to land.' },
  { id: 'coupe',  name: 'Aero Coupe',  price: 800,  acc: 18.2, top: 32.0, handling: 0.98, nitro: 1.22, drift: 0.96, air: 1.00, desc: 'Faster on the straights. Needs a cleaner line.' },
  { id: 'pickup', name: 'Ridge Pickup',price: 1000, acc: 15.4, top: 27.5, handling: 1.12, nitro: 1.12, drift: 0.90, air: 1.05, desc: 'Planted and stable. Great for rough landings.' },
  { id: 'muscle', name: 'Thunder V8',  price: 1400, acc: 17.4, top: 31.2, handling: 0.90, nitro: 1.18, drift: 1.28, air: 0.96, desc: 'King of drift. Charges nitro faster in slides.' },
  { id: 'buggy',  name: 'Cloud Buggy', price: 1800, acc: 17.8, top: 29.4, handling: 1.16, nitro: 1.14, drift: 1.06, air: 1.32, desc: 'Light in the air. Best jump control.' },
  { id: 'police', name: 'Ion Interceptor', price: 2500, acc: 19.6, top: 33.8, handling: 1.02, nitro: 1.34, drift: 1.02, air: 1.04, desc: 'Serious nitro punch and strong acceleration.' },
  { id: 'super',  name: 'Apex GT',     price: 4000, acc: 22.4, top: 38.2, handling: 1.14, nitro: 1.38, drift: 1.12, air: 1.10, desc: 'Top machine. Fast, sharp, and unforgiving.' }
];

export const UPGRADE_COST = [150, 300, 520, 820, 1250];
export const UPGRADE_MAX = 5;
export const UPGRADE_GAIN = 0.045; // +4.5% per level

export const DAILY_REWARDS = [60, 90, 130, 190, 260, 380, 600];

export const AI_NAMES = ['Ace', 'Nitro', 'Vega', 'Raven', 'Blaze', 'Drift', 'Kite', 'Sable'];
export const AI_COLORS = [0x2f7bff, 0xffc526, 0xb44bff, 0x1a1d24, 0xff7a18, 0x2ee6ff, 0x7dff3a, 0xff4fa3];

export const WORLDS = [
  { id: 'isles', name: 'Sky Isles', tracks: ['green', 'canyon'], champTrack: 'canyon',
    champ: { name: 'Isle King', car: 'muscle', color: 'orange', skill: 0.98, speedMul: 1.06 } },
  { id: 'wilds', name: 'Wild Frontiers', tracks: ['frost', 'ember'], champTrack: 'ember',
    champ: { name: 'Ember Fox', car: 'police', color: 'red', skill: 1.02, speedMul: 1.08 } },
  { id: 'night', name: 'Night Circuit', tracks: ['neon', 'cloud'], champTrack: 'cloud',
    champ: { name: 'Nova', car: 'super', color: 'pink', skill: 1.08, speedMul: 1.10 } },
  { id: 'apex', name: 'Apex League', tracks: ['storm', 'aurora'], champTrack: 'aurora',
    champ: { name: 'Aurora One', car: 'super', color: 'cyan', skill: 1.14, speedMul: 1.13 } }
];

export function worldOf(trackId) {
  return WORLDS.find(w => w.tracks.includes(trackId)) || null;
}

export function worldUnlocked(save, world) {
  if (!world) return false;
  return world.tracks.every(id => ((save.tracks && save.tracks[id]) || {}).stars >= 1);
}


export const MISSION_POOL = [
  { id: 'finish',   text: 'Finish a race',              key: 'racesFinished', need: 1,  reward: 80 },
  { id: 'win',      text: 'Win a race',                 key: 'wins',          need: 1,  reward: 150 },
  { id: 'top3',     text: 'Finish in the top 3',        key: 'top3',          need: 1,  reward: 100 },
  { id: 'drift',    text: 'Drift for 25 seconds',       key: 'driftTime',     need: 25, reward: 90 },
  { id: 'nitro',    text: 'Use nitro 5 times',          key: 'nitroUses',     need: 5,  reward: 80 },
  { id: 'jumps',    text: 'Land 4 jumps',               key: 'jumps',         need: 4,  reward: 90 },
  { id: 'boosts',   text: 'Hit 6 boost pads',           key: 'boosts',        need: 6,  reward: 80 },
  { id: 'nodnf',    text: 'Finish without falling',     key: 'cleanFinish',   need: 1,  reward: 120 }
];

export function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(d = new Date()) {
  const p = new Date(d.getTime() - 86400000);
  return todayKey(p);
}

export function hashDay(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function dailyMissionsFor(day) {
  const h = hashDay(day + ':missions');
  const pool = MISSION_POOL.slice();
  const out = [];
  for (let i = 0; i < 3; i++) {
    const idx = (h + i * 17) % pool.length;
    out.push({ ...pool.splice(idx % pool.length, 1)[0], progress: 0, claimed: false });
  }
  return out;
}

export function dailyChallengeFor(day, trackCount) {
  const h = hashDay(day + ':challenge');
  const trackIndex = h % Math.max(1, Math.min(trackCount, 6)); // first 6 tracks rotate
  const mode = (h >>> 8) % 3; // 0 win, 1 top3, 2 time
  return {
    trackIndex,
    mode, // 0 = finish 1st, 1 = top 3, 2 = beat par time
    parMul: 1.08 + ((h >>> 16) % 12) / 100, // used if mode 2
    reward: mode === 0 ? 280 : mode === 1 ? 180 : 200,
    claimed: false,
    done: false
  };
}

export function defaultSave() {
  const day = todayKey();
  return {
    v: 1,
    coins: 400,
    car: 'hatch',
    color: 'red',
    unlockedCars: ['hatch'],
    unlockedColors: ['red', 'blue'],
    upgrades: {},
    tracks: {}, // id -> { stars, bestTime, plays }
    lastTrack: 'green',
    tutorial: 0, // races completed (hints for first two)
    daily: {
      day,
      streak: 0,
      claimed: false,
      missions: dailyMissionsFor(day),
      challenge: null // filled once tracks are known
    },
    stats: { races: 0, wins: 0, playTime: 0 },
    settings: { audio: true },
    ghosts: {},
    champs: {}
  };
}

export function applyUpgrades(base, up) {
  const u = up || { speed: 0, handling: 0, nitro: 0 };
  const gs = 1 + (u.speed || 0) * UPGRADE_GAIN;
  const gh = 1 + (u.handling || 0) * UPGRADE_GAIN;
  const gn = 1 + (u.nitro || 0) * UPGRADE_GAIN;
  return {
    acc: base.acc * gs,
    top: base.top * gs,
    handling: base.handling * gh,
    nitro: base.nitro * gn,
    drift: base.drift * (1 + (u.handling || 0) * UPGRADE_GAIN * 0.5),
    air: base.air
  };
}

export function starForPlace(place, finished) {
  if (!finished) return 0;
  if (place === 1) return 3;
  if (place <= 3) return 2;
  return 1;
}

export function prizeForPlace(place, finished, difficulty) {
  if (!finished) return 15 + difficulty * 2;
  const base = [0, 180, 120, 85, 60, 45, 35, 25][place] || 25;
  return Math.round(base * (1 + (difficulty - 1) * 0.08));
}
