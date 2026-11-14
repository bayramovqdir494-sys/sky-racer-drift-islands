import { sdk } from './sdk.js';
import { SAVE_KEY, defaultSave, todayKey, yesterdayKey, dailyMissionsFor } from './data.js';

let data = defaultSave();
let store = null;

export function getSave() { return data; }

export function initSave() {
  store = sdk.storage();
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = migrate(parsed);
    }
  } catch (e) { console.warn('[save] load failed', e); data = defaultSave(); }
  rolloverDaily(data);
  persist();
  return data;
}

function migrate(p) {
  const d = defaultSave();
  if (!p || typeof p !== 'object') return d;
  Object.assign(d, p);
  d.unlockedCars = Array.isArray(p.unlockedCars) && p.unlockedCars.length ? p.unlockedCars : ['hatch'];
  d.unlockedColors = Array.isArray(p.unlockedColors) && p.unlockedColors.length ? p.unlockedColors : ['red', 'blue'];
  d.upgrades = p.upgrades && typeof p.upgrades === 'object' ? p.upgrades : {};
  d.tracks = p.tracks && typeof p.tracks === 'object' ? p.tracks : {};
  d.settings = Object.assign({ audio: true }, p.settings || {});
  d.daily = Object.assign(d.daily, p.daily || {});
  d.ghosts = p.ghosts && typeof p.ghosts === 'object' ? p.ghosts : {};
  d.champs = p.champs && typeof p.champs === 'object' ? p.champs : {};
  return d;
}

export function rolloverDaily(s = data) {
  const today = todayKey();
  if (!s.daily || s.daily.day !== today) {
    const prev = s.daily && s.daily.day;
    const keepStreak = prev === yesterdayKey();
    s.daily = {
      day: today,
      streak: keepStreak ? (s.daily.streak || 0) : 0,
      claimed: false,
      missions: dailyMissionsFor(today),
      challenge: s.daily && s.daily.day === today ? s.daily.challenge : null
    };
  }
  if (!Array.isArray(s.daily.missions) || s.daily.missions.length !== 3) {
    s.daily.missions = dailyMissionsFor(today);
  }
}

export function persist() {
  try { store && store.setItem(SAVE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('[save] persist failed', e); }
}

export function mutate(fn) {
  fn(data);
  persist();
  return data;
}

export function addCoins(n) {
  data.coins = Math.max(0, (data.coins || 0) + Math.round(n));
  persist();
  return data.coins;
}

export function ensureCarUp(id) {
  if (!data.upgrades[id]) data.upgrades[id] = { speed: 0, handling: 0, nitro: 0 };
  return data.upgrades[id];
}

export function resetSave() {
  data = defaultSave();
  persist();
  return data;
}
