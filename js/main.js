import * as THREE from 'three';
import { sdk } from './sdk.js';
import { initSave, getSave, mutate, addCoins, persist, ensureCarUp, resetSave } from './save.js';
import { CARS, starForPlace, prizeForPlace, applyUpgrades } from './data.js';
import { getRecipes, buildTrack, bakeMinimap, totalStars } from './tracks.js';
import { initVehicles, makeCar, spinWheels } from './vehicles.js';
import { createFX, makeSky, makeLights } from './fx.js';
import { makeField, setupGrid, bindAIToTrack, stepRace, decorateTrack, updatePlaces, makeGhostMesh, sampleGhost, aiInput } from './race.js';
import * as UI from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.15, 600);
camera.position.set(0, 18, 28);

const world = new THREE.Group();
scene.add(world);

let quality = 'high';
let trackBuilt = null, sky = null, lights = null, props = null, fx = null;
let field = null, raceState = null;
let ghostMesh = null, ghostSamples = null, recordBuf = null;
let camShake = 0, slowMo = 0, lastCrash = null;
let mode = 'boot'; // boot, menu, countdown, race, pause, result
let orientHold = false;
let orientPausedFrom = null;
let countdownTick = null;
let selectedTrack = 'green';
let camPos = new THREE.Vector3(0, 16, 24);
let camLook = new THREE.Vector3();
const input = UI.bindInput({ left:0,right:0,gas:0,brake:0,drift:0,nitro:0 });
let challenge = null;
let resultCoins = 0, resultDoubled = false;
let lastHintAt = 0, raceClock = 0;
let audio = null;
let fpsAvg = 60, lastFpsT = 0, frames = 0;
let pageErrors = [];
window.addEventListener('error', ev => { pageErrors.push(String(ev.message || ev.error)); });
window.addEventListener('unhandledrejection', ev => { pageErrors.push('rej ' + String(ev.reason && ev.reason.message || ev.reason)); });

function setLoad(p, t) {
  document.getElementById('loadbar').style.width = Math.round(p * 100) + '%';
  if (t) document.getElementById('loadtxt').textContent = t;
}

function isPhoneLike() {
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  const coarse = window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
  const shortSide = Math.min(innerWidth, innerHeight);
  // Phones/tablets, or a touch viewport that is phone-sized. Desktop and wide windows stay clear.
  if (uaMobile) return true;
  if ((touch || coarse) && shortSide <= 520) return true;
  return false;
}

function needsRotateOverlay() {
  if (!isPhoneLike()) return false;
  if (innerWidth >= innerHeight) return false; // already landscape / wide window
  const portraitMQ = window.matchMedia('(orientation: portrait)').matches;
  return portraitMQ || innerHeight > innerWidth;
}

function tryLockLandscape() {
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === 'function') {
      const p = o.lock('landscape');
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) {}
}

function applyOrientation() {
  const el = document.getElementById('rotateOverlay');
  const need = needsRotateOverlay();
  if (el) {
    el.classList.toggle('on', need);
    el.setAttribute('aria-hidden', need ? 'false' : 'true');
  }
  document.body.classList.toggle('portrait-lock', need);
  if (need && !orientHold) {
    orientHold = true;
    if (mode === 'race' || mode === 'countdown' || mode === 'finish') {
      orientPausedFrom = mode;
      try { sdk.setPlaying(false); } catch (e) {}
    } else {
      orientPausedFrom = null;
    }
    try { engineAudio(0, false, false); } catch (e) {}
  } else if (!need && orientHold) {
    orientHold = false;
    // Countdown already reached GO while the phone was portrait — start now.
    if (mode === 'countdown' && !countdownTick) {
      UI.countdown(0);
      beginRacing();
    } else if (orientPausedFrom && mode !== 'pause' && mode !== 'result' && mode !== 'menu') {
      try { sdk.setPlaying(true); } catch (e) {}
    }
    orientPausedFrom = null;
  }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  applyOrientation();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 50));
try {
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq) {
    const onMq = () => resize();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMq);
    else if (typeof mq.addListener === 'function') mq.addListener(onMq);
  }
} catch (e) {}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', resize);
}

let didLockOrient = false;
function onFirstUserGesture() {
  if (didLockOrient) return;
  didLockOrient = true;
  tryLockLandscape();
}
document.addEventListener('pointerdown', onFirstUserGesture, { capture: true });
document.addEventListener('touchend', onFirstUserGesture, { capture: true });
document.addEventListener('click', onFirstUserGesture, { capture: true });
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) tryLockLandscape();
});

function applyAnisotropy(root, value) {
  if (!root) return;
  root.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (!m) continue;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
        const tex = m[key];
        if (tex && tex.anisotropy !== undefined) {
          tex.anisotropy = value;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
        }
      }
    }
  });
}

function applyQuality() {
  const low = quality === 'low', med = quality === 'med';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 0.85 : med ? 1.25 : 2));
  renderer.toneMappingExposure = low ? 1.12 : med ? 1.2 : 1.26;
  renderer.shadowMap.enabled = !low;
  if (lights && lights.sun) {
    lights.sun.castShadow = !low;
    const size = low ? 512 : med ? 1024 : 2048;
    if (lights.sun.shadow.mapSize.x !== size) {
      lights.sun.shadow.mapSize.set(size, size);
      if (lights.sun.shadow.map) {
        lights.sun.shadow.map.dispose();
        lights.sun.shadow.map = null;
      }
    }
    lights.sun.shadow.bias = -0.0006;
    lights.sun.shadow.normalBias = 0.04;
    lights.sun.shadow.radius = low ? 1 : med ? 2 : 3;
  }
  if (fx && fx.setQuality) fx.setQuality(quality);
  const maxAni = (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 8;
  const ani = Math.min(maxAni, low ? 2 : med ? 8 : 16);
  applyAnisotropy(world, ani);
  applyAnisotropy(scene, ani);
}

async function boot() {
  if (Math.min(innerWidth, innerHeight) <= 430) quality = 'med';
  setLoad(0.05, 'Connecting');
  await sdk.init();
  sdk.loadingStart();
  initSave();
  rolloverCh();
  setLoad(0.12, 'Loading cars');
  await initVehicles((p) => setLoad(0.12 + p * 0.7, 'Loading cars'));
  fx = createFX(scene);
  selectedTrack = getSave().lastTrack || 'green';
  setLoad(0.9, 'Building islands');
  await goMenu(true);
  setLoad(1, 'Ready');
  sdk.loadingStop();
  document.getElementById('loader').classList.add('done');
  mode = 'menu';
  UI.show('home');
  UI.refreshHome(selectedTrack);
  hookUI();
  installQA();
  applyOrientation();
  requestAnimationFrame(loop);
}

function rolloverCh() {
  const s = getSave();
  const recs = getRecipes();
  if (!s.daily.challenge || s.daily.challenge._needFill) {
    // filled in renderDaily
  }
}

function clearWorld() {
  while (world.children.length) world.remove(world.children[0]);
  if (sky && sky.parent) sky.parent.remove(sky);
  sky = null;
  if (field) {
    for (const r of field.racers) if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh);
  }
  if (ghostMesh && ghostMesh.parent) ghostMesh.parent.remove(ghostMesh);
  ghostMesh = null; ghostSamples = null; recordBuf = null;
  field = null;
  trackBuilt = null;
  props = null;
}

function buildWorld(trackId, opts = {}) {
  buildWorld._opts = opts;
  clearWorld();
  const rec = getRecipes().find(t => t.id === trackId) || getRecipes()[0];
  const track = buildTrack(rec);
  bakeMinimap(track, 160);
  trackBuilt = track;
  world.add(track.group);
  sky = makeSky(track.theme);
  scene.add(sky);
  // remove old lights
  scene.traverse(() => {});
  const stale = [];
  scene.children.forEach(o => { if (o.isLight) stale.push(o); });
  stale.forEach(o => scene.remove(o));
  lights = makeLights(track.theme, scene);
  applyQuality();
  props = decorateTrack(track, quality);
  world.add(props);
  const save = getSave();
  const bwOpts = opts || {};
  const mode = bwOpts.mode || 'race';
  const laps = bwOpts.laps || (mode === 'trial' ? 2 : 3);
  const aiCount = bwOpts.aiCount != null ? bwOpts.aiCount : (mode === 'trial' ? 0 : 6);
  field = makeField(trackId, save, { laps, aiCount, mode, champ: bwOpts.champ });
  bindAIToTrack(field.racers, rec, field.player);
  snapCam(track);
  for (const r of field.racers) world.add(r.mesh);
  setupGrid(field.racers, track, laps);
  updatePlaces(field.racers);
  if (fx) fx.reset();
  return track;
}

async function goMenu(fromBoot) {
  sdk.setPlaying(false);
  mode = 'menu';
  raceState = null;
  challenge = null;
  UI.setModeTag('');
  UI.setWrongWay(false);
  camShake = 0; slowMo = 0;
  if (!trackBuilt || fromBoot) buildWorld(selectedTrack);
  UI.show('home');
  UI.refreshHome(selectedTrack);
}

function hookUI() {
  document.getElementById('btnRace').onclick = () => startRace(selectedTrack);
  document.getElementById('btnTracks').onclick = () => {
    UI.renderTracks(
      id => { selectedTrack = id; mutate(s => s.lastTrack = id); UI.hideSheet('sheetTracks'); UI.refreshHome(id); startRace(id); },
      id => { selectedTrack = id; mutate(s => s.lastTrack = id); UI.hideSheet('sheetTracks'); startRace(id, { mode: 'trial', laps: 2, aiCount: 0 }); },
      (id, world) => { selectedTrack = id; mutate(s => s.lastTrack = id); UI.hideSheet('sheetTracks'); startRace(id, { mode: 'champ', laps: 3, aiCount: 5, champ: world.champ, worldId: world.id }); }
    );
    UI.showSheet('sheetTracks');
  };
  document.getElementById('btnGarage').onclick = () => { UI.renderGarage(() => UI.refreshHome(selectedTrack)); UI.showSheet('sheetGarage'); };
  document.getElementById('btnDaily').onclick = document.getElementById('btnDaily2').onclick = () => {
    UI.renderDaily((id, ch) => { UI.hideSheet('sheetDaily'); selectedTrack = id; challenge = ch; startRace(id); });
    UI.showSheet('sheetDaily');
  };
  document.getElementById('btnAudio').onclick = () => {
    mutate(s => s.settings.audio = !s.settings.audio);
    UI.refreshHome(selectedTrack);
  };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => UI.hideSheet(b.getAttribute('data-close')));
  document.getElementById('btnResume').onclick = () => { if (mode === 'pause') resumeRace(); };
  document.getElementById('btnQuit').onclick = () => { UI.hideSheet('pause'); goMenu(); };
  document.getElementById('pauseBtn').onclick = () => pauseRace();
  document.getElementById('btnRetry').onclick = () => { UI.hideSheet('result'); startRace(selectedTrack, { rematch: true }); };
  document.getElementById('btnToMenu').onclick = () => { UI.hideSheet('result'); maybeMidAd().then(() => goMenu()); };
  document.getElementById('btnDouble').onclick = () => doubleCoins();
}

function startRace(trackId, opts = {}) {
  selectedTrack = trackId || selectedTrack;
  mutate(s => s.lastTrack = selectedTrack);
  const track = buildWorld(selectedTrack, opts);
  const rec = track.rec;
  camShake = 0; slowMo = 0; lastCrash = null;
  ghostSamples = null; recordBuf = [];
  if (opts.mode === 'trial') {
    const g = (getSave().ghosts || {})[selectedTrack];
    if (g && g.samples && g.samples.length) {
      ghostSamples = g.samples;
      ghostMesh = makeGhostMesh(g.car || getSave().car, g.color || getSave().color);
      world.add(ghostMesh);
    }
    UI.setModeTag('Time Trial' + (ghostSamples ? '  •  Ghost on' : '  •  Set a ghost'));
  } else if (opts.mode === 'champ' && opts.champ) {
    UI.setModeTag('Champion  •  ' + opts.champ.name);
  } else {
    UI.setModeTag('');
  }
  UI.setWrongWay(false);
  raceState = {
    track, player: field.player, racers: field.racers, fx, acc: 0, phase: 'countdown',
    wind: rec.theme === 'storm' || rec.theme === 'cloud' || rec.theme === 'aurora'
      ? { t: 0, str: (track.theme.wind || 0) * 10, x: 0, z: 0 } : null,
    startAt: performance.now(),
    opts
  };
  setupGrid(field.racers, track, opts.laps || 3);
  raceClock = 0;
  resultDoubled = false;
  mode = 'countdown';
  UI.show('hud');
  UI.countdown('');
  input.gas = 0;
  const skip = opts.skipCountdown;
  if (skip) {
    beginRacing();
  } else {
    let n = 3;
    UI.countdown(n);
    beep(440, 0.1);
    countdownTick = setInterval(() => {
      if (orientHold) return;
      n--;
      if (mode !== 'countdown') { clearInterval(countdownTick); countdownTick = null; return; }
      if (n <= 0) { clearInterval(countdownTick); countdownTick = null; UI.countdown('GO'); beep(880, 0.18); setTimeout(() => { UI.countdown(0); if (mode === 'countdown' && !orientHold) beginRacing(); }, 280); }
      else { UI.countdown(n); beep(440, 0.1); }
    }, 1000);
  }
  // Tutorial hints fire from the race loop after GO, so they never cover the countdown.
}

function beginRacing() {
  mode = 'race';
  raceState.phase = 'race';
  sdk.setPlaying(true);
  if (field && field.player) snapChase(field.player);
}

function pauseRace() {
  if (mode !== 'race') return;
  mode = 'pause';
  raceState.phase = 'pause';
  sdk.setPlaying(false);
  UI.showSheet('pause');
}
function resumeRace() {
  UI.hideSheet('pause');
  mode = 'race';
  raceState.phase = 'race';
  sdk.setPlaying(true);
}

function finishPlayer() {
  if (mode === 'result') return;
  const p = field.player;
  updatePlaces(field.racers);
  const place = p.place;
  const finished = !!p.finished;
  const rec = trackBuilt.rec;
  const raceMode = (raceState && raceState.opts && raceState.opts.mode) || 'race';
  let stars = 0, coins = 0;
  if (raceMode === 'trial') {
    stars = 0;
    coins = finished ? 70 : 15;
    const prev = (getSave().ghosts || {})[rec.id];
    const isPB = finished && (!prev || p.finishTime < prev.time);
    if (isPB) coins += 50;
  } else if (raceMode === 'champ') {
    stars = 0;
    coins = (finished && place === 1) ? 450 : (finished ? 80 : 25);
  } else {
    stars = starForPlace(place, finished);
    coins = prizeForPlace(place, finished, rec.difficulty);
  }
  resultCoins = coins;
  mutate(s => {
    s.coins += coins;
    s.stats.races++;
    if (place === 1 && finished && raceMode !== 'trial') s.stats.wins++;
    const t = s.tracks[rec.id] || { stars: 0, bestTime: 0, plays: 0 };
    t.plays++;
    if (stars > t.stars) t.stars = stars;
    if (finished && (!t.bestTime || p.finishTime < t.bestTime)) t.bestTime = p.finishTime;
    s.tracks[rec.id] = t;
    s.tutorial = (s.tutorial || 0) + 1;
    if (raceMode === 'trial' && finished) {
      s.ghosts = s.ghosts || {};
      const prev = s.ghosts[rec.id];
      if (!prev || p.finishTime < prev.time) {
        s.ghosts[rec.id] = {
          time: p.finishTime, car: p.carId, color: p.colorId,
          samples: (recordBuf || []).slice(0, 900)
        };
      }
    }
    if (raceMode === 'champ' && finished && place === 1 && raceState.opts.worldId) {
      s.champs = s.champs || {};
      s.champs[raceState.opts.worldId] = { time: p.finishTime, date: Date.now() };
    }
  });
  UI.addMissionProgress('racesFinished', finished ? 1 : 0);
  if (finished && place === 1) UI.addMissionProgress('wins', 1);
  if (finished && place <= 3) UI.addMissionProgress('top3', 1);
  if (finished && !p.fell) UI.addMissionProgress('cleanFinish', 1);
  UI.setMissionValue('driftTime', p.driftAcc);
  UI.setMissionValue('nitroUses', p.nitroUses);
  UI.setMissionValue('jumps', p.jumps);
  UI.setMissionValue('boosts', p.boosts);
  // daily challenge
  const s = getSave();
  if (challenge && s.daily && s.daily.challenge && !s.daily.challenge.done) {
    const ch = s.daily.challenge;
    let ok = false;
    if (ch.mode === 0) ok = finished && place === 1;
    if (ch.mode === 1) ok = finished && place <= 3;
    if (ch.mode === 2) ok = finished && p.finishTime <= (ch.parTime || p.finishTime * ch.parMul || p.finishTime);
    if (ok) { ch.done = true; persist(); }
  }
  if (place === 1) sdk.happytime();
  sdk.setPlaying(false);
  mode = 'result';
  raceState.phase = 'finish';
  UI.showResult({ place: finished ? place : 0, stars, time: p.finishTime || (p.time + p.penalty), coins, adsOk: sdk.adsOk });
}

async function doubleCoins() {
  if (resultDoubled) return;
  const ok = await sdk.requestAd('rewarded', { pause: () => sdk.setPlaying(false) });
  if (ok) {
    addCoins(resultCoins);
    resultDoubled = true;
    document.getElementById('rCoins').textContent = '+' + (resultCoins * 2) + ' coins (doubled)';
    document.getElementById('btnDouble').classList.add('dis');
    UI.refreshWallet();
  } else {
    UI.toast('Ad not available');
  }
}

async function maybeMidAd() {
  if (getSave().stats.races < 1) return;
  if (!sdk.adsOk || sdk.env !== 'crazygames') return;
  try {
    await Promise.race([
      sdk.requestAd('midgame', {}),
      new Promise(res => setTimeout(res, 2500))
    ]);
  } catch (e) {}
}

function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function beep(freq, dur, vol = 0.06, type = 'triangle') {
  if (!getSave().settings.audio) return;
  try {
    const ctx = ensureAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type = type;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}

function sfxBurst(dur, vol, freq) {
  if (!getSave().settings.audio) return;
  try {
    const ctx = ensureAudio();
    const n = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = n;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

function sfxLand(hard) {
  beep(hard ? 85 : 130, hard ? 0.18 : 0.1, hard ? 0.1 : 0.06, 'sine');
  sfxBurst(hard ? 0.16 : 0.1, hard ? 0.08 : 0.045, hard ? 180 : 260);
}

function sfxNitro() {
  beep(220, 0.12, 0.05, 'sawtooth');
  beep(420, 0.16, 0.04, 'triangle');
  sfxBurst(0.14, 0.05, 900);
}

function sfxCrash(hard) {
  beep(hard ? 72 : 108, hard ? 0.16 : 0.11, hard ? 0.11 : 0.07, 'sine');
  beep(hard ? 165 : 210, 0.08, 0.04, 'square');
  sfxBurst(hard ? 0.22 : 0.14, hard ? 0.12 : 0.07, hard ? 150 : 230);
}

function setDriftScreech(on, intensity) {
  if (!getSave().settings.audio) {
    if (setDriftScreech.g) setDriftScreech.g.gain.value = 0;
    return;
  }
  try {
    const ctx = ensureAudio();
    if (!setDriftScreech.src) {
      const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = n; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2.2;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
      setDriftScreech.src = src; setDriftScreech.g = g; setDriftScreech.f = f;
    }
    const want = on ? 0.035 + intensity * 0.05 : 0;
    setDriftScreech.g.gain.value = want;
    if (on) setDriftScreech.f.frequency.value = 1100 + intensity * 800;
  } catch (e) {}
}

function engineAudio(speed, nit, drift) {
  if (!getSave().settings.audio) {
    if (engineAudio.g) engineAudio.g.gain.value = 0;
    setDriftScreech(false, 0);
    return;
  }
  try {
    const ctx = ensureAudio();
    if (!engineAudio.o) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 80;
      g.gain.value = 0;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      engineAudio.o = o; engineAudio.g = g;
    }
    engineAudio.o.frequency.value = 70 + speed * 8 + (nit ? 36 : 0);
    engineAudio.g.gain.value = mode === 'race' ? 0.03 + Math.min(0.05, speed * 0.002) + (nit ? 0.015 : 0) : 0;
    setDriftScreech(mode === 'race' && drift, Math.min(1, (speed || 0) / 28));
  } catch (e) {}
}

function chaseOffset(p) {
  // A little closer and lower than the original 9.2 / 3.7, but far enough
  // to clear the grid car behind the player and keep the road readable.
  const back = 8.25 + Math.min(2.8, (p.speed || 0) * 0.08);
  const height = 3.35 + (p.air ? 1.05 : 0);
  const ahead = 9.2 + (p.speed || 0) * 0.11;
  const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  const pos = p.pos.clone().addScaledVector(dir, -back);
  pos.y += height;
  const look = p.pos.clone().addScaledVector(dir, ahead);
  look.y += 0.65;
  return { pos, look, back, height, ahead };
}

function snapChase(p) {
  if (!p) return;
  const o = chaseOffset(p);
  camPos.copy(o.pos);
  camLook.copy(o.look);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function chaseCam(p, dt) {
  const o = chaseOffset(p);
  camPos.lerp(o.pos, 1 - Math.pow(0.0005, dt));
  camLook.lerp(o.look, 1 - Math.pow(0.00035, dt));
  camera.position.copy(camPos);
  if (camShake > 0) {
    camera.position.x += (Math.random() - 0.5) * camShake;
    camera.position.y += (Math.random() - 0.5) * camShake * 0.7;
    camera.position.z += (Math.random() - 0.5) * camShake * 0.4;
    camShake = Math.max(0, camShake - dt * 7.5);
  }
  camera.lookAt(camLook);
  camera.fov = lerp(camera.fov, p.nitOn ? 66 : 56 + p.speed * 0.10, 1 - Math.pow(0.05, dt));
  camera.updateProjectionMatrix();
}

function snapCam(track) {
  const s = track.atT(0.02);
  camPos.copy(s.pos).addScaledVector(s.up, 8).addScaledVector(s.right, 8).addScaledVector(s.tan, -14);
  camLook.copy(s.pos).addScaledVector(s.tan, 10).addScaledVector(s.up, 0.8);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function menuCam(dt) {
  if (!trackBuilt) return;
  const t = performance.now() * 0.00006;
  const s = trackBuilt.atT((0.02 + t * 0.12) % 1);
  const pos = s.pos.clone().addScaledVector(s.up, 8).addScaledVector(s.right, 7).addScaledVector(s.tan, -12);
  camPos.lerp(pos, 0.05);
  const look = s.pos.clone().addScaledVector(s.tan, 8).addScaledVector(s.up, 0.6);
  camLook.lerp(look, 0.05);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function lerp(a,b,t){ return a+(b-a)*t; }

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  if (now - lastFpsT > 1000) {
    fpsAvg = frames * 1000 / (now - lastFpsT);
    frames = 0; lastFpsT = now;
    const settled = mode !== 'race' || raceClock > 2.2;
    const qaLock = window.__qa && window.__qa.lockQuality;
    if (settled && !qaLock) {
      if (fpsAvg < 36 && quality !== 'low') {
        quality = quality === 'high' ? 'med' : 'low'; applyQuality();
      } else if (fpsAvg > 56 && quality === 'low') {
        quality = 'med'; applyQuality();
      } else if (fpsAvg > 58 && quality === 'med' && Math.min(innerWidth, innerHeight) > 430) {
        quality = 'high'; applyQuality();
      }
    }
  }
  if (sky && sky.userData.mat) sky.userData.mat.uniforms.time.value = now * 0.001;

  if (orientHold) {
    try { engineAudio(0, false, false); } catch (e) {}
    renderer.render(scene, camera);
    return;
  }

  if (mode === 'menu') menuCam(dt);
  if (mode === 'countdown' && field) chaseCam(field.player, dt);

  if ((mode === 'race' || mode === 'finish') && raceState) {
    if (slowMo > 0) slowMo = Math.max(0, slowMo - dt);
    const qaScale = (window.__qa && window.__qa.timeScale) || 1;
    const rdt = dt * ((slowMo > 0 && qaScale <= 1) ? 0.4 : 1) * qaScale;
    raceClock += rdt;
    const ev = stepRace(raceState, input.read(), rdt);
    const p = field.player;
    for (const e of ev) {
      if (e.type === 'respawn') UI.toast('+' + e.penalty.toFixed(1) + 's');
      if (e.type === 'cut') UI.toast('Cut blocked! +' + e.penalty.toFixed(1) + 's');
      if (e.type === 'land') {
        camShake = Math.min(1.15, 0.16 + (e.hard ? 0.5 : 0.16) + (e.bigAir ? 0.28 : 0) + Math.min(0.4, (e.airTime || 0) * 0.25));
        if (e.bigAir && (e.airTime || 0) > 0.65) slowMo = Math.max(slowMo, 0.5);
        if (qaScale <= 1) sfxLand(!!e.hard);
      }
      if (e.type === 'bigJump') slowMo = Math.max(slowMo, 0.62);
      if (e.type === 'crash') {
        lastCrash = { t: raceClock, hard: !!e.hard, impact: e.impact, kind: e.kind, player: !!e.player };
        if (e.player) {
          camShake = Math.min(1.05, 0.32 + (e.hard ? 0.42 : 0.18) + Math.min(0.25, (e.impact || 0) * 0.02));
          if (qaScale <= 1) sfxCrash(!!e.hard);
          try { if (navigator.vibrate) navigator.vibrate(e.hard ? [16, 24, 22] : 18); } catch (err) {}
        }
      }
    }
    if (p.nitOn && !engineAudio._wasNit && qaScale <= 1) sfxNitro();
    engineAudio._wasNit = !!p.nitOn;
    UI.setWrongWay(!!p.wrongWay);
    if ((raceState.opts || {}).mode === 'trial' && !p.finished) {
      if (!recordBuf) recordBuf = [];
      if (recordBuf._t == null || p.time - recordBuf._t >= 0.08) {
        recordBuf.push([+p.time.toFixed(3), +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2), +p.yaw.toFixed(3)]);
        recordBuf._t = p.time;
      }
    }
    if (ghostMesh && ghostSamples) {
      const g = sampleGhost(ghostSamples, p.time);
      if (g) {
        ghostMesh.position.set(g[1], g[2], g[3]);
        ghostMesh.rotation.set(0, g[4], 0);
        ghostMesh.visible = true;
      }
    }
    chaseCam(p, rdt);
    UI.updateHud(p, field.racers.length);
    UI.drawMini(trackBuilt, field.racers, p);
    if (fx) fx.update(rdt, camera, p.speed / Math.max(1, p.stats.top));
    engineAudio(p.speed, p.nitOn, p.drifting);

    const tut = getSave().tutorial || 0;
    if (tut < 2 && raceClock > 0.05 && raceClock < 3.5) UI.hint('Hold GAS to go  •  Steer with the arrows');
    else if (tut < 2 && raceClock > 4 && raceClock < 8) UI.hint('Hold DRIFT in corners to charge nitro');
    else if (tut < 2 && raceClock > 10 && raceClock < 14) UI.hint('Tap NITRO on a straight or before a long jump');

    if (mode === 'race' && (field.player.finished || field.racers.every(r => r.finished))) {
      // slight delay so the player sees the line
      if (!finishPlayer._wait) {
        finishPlayer._wait = true;
        setTimeout(() => { finishPlayer._wait = false; finishPlayer(); }, field.player.finished ? 450 : 200);
      }
    }
  } else {
    engineAudio(0, false, false);
  }

  // debug overlay
  const dbg = document.getElementById('dbg');
  if (dbg && (location.search.includes('debug') || window.__qaDebug)) {
    dbg.style.display = 'block';
    const info = renderer.info;
    const p = field && field.player;
    dbg.textContent = `fps ${fpsAvg.toFixed(0)}  calls ${info.render.calls}  tris ${info.render.triangles}
tier ${quality}  mode ${mode}
${p ? `t ${p.t.toFixed(3)} lap ${p.lap} P${p.place} spd ${p.speed.toFixed(1)} air ${p.air?1:0} nit ${p.nitro.toFixed(2)}` : ''}`;
  }

  renderer.render(scene, camera);
}

function installQA() {
  window.__qa = {
    get mode() { return mode; },
    get errors() { return pageErrors.slice(); },
    get drawCalls() { return renderer.info.render.calls; },
    get triangles() { return renderer.info.render.triangles; },
    get fps() { return fpsAvg; },
    state() {
      const p = field && field.player;
      return {
        mode, track: selectedTrack, coins: getSave().coins, save: getSave(),
        player: p && {
          t: p.t, lap: p.lap, place: p.place, speed: p.speed, air: p.air, nitro: p.nitro,
          finished: p.finished, time: p.time, penalty: p.penalty, pos: p.pos.toArray(),
          cp: p.cp, fallCount: p.fallCount, jumps: p.jumps, driftAcc: p.driftAcc, wrongWay: !!p.wrongWay, yaw: p.yaw
        },
        places: field && field.racers.map(r => ({ name: r.name, place: r.place, t: r.t, lap: r.lap, finished: r.finished, progress: r.progress, champ: !!(r.ai && r.ai.champ) })),
        errors: pageErrors.slice(),
        calls: renderer.info.render.calls
      };
    },
    startRace(id, opts = {}) { selectedTrack = id || selectedTrack; startRace(selectedTrack, opts); },
    giveCoins(n = 1000) { addCoins(n); UI.refreshWallet(); return getSave().coins; },
    unlockAll() {
      mutate(s => {
        s.unlockedCars = CARS.map(c => c.id);
        s.unlockedColors = ['red','blue','yellow','lime','orange','purple','white','black','cyan','pink'];
        getRecipes().forEach(r => { s.tracks[r.id] = s.tracks[r.id] || { stars: 3, bestTime: 60, plays: 1 }; s.tracks[r.id].stars = 3; });
        s.coins += 5000;
      });
      UI.refreshHome(selectedTrack);
    },
    teleport(t, lat = 0) {
      const p = field.player; const s = trackBuilt.atT(t);
      p.t = t; p.pos.copy(s.pos).addScaledVector(s.right, lat); p.yaw = Math.atan2(s.tan.x, s.tan.z);
      p.vel.set(Math.sin(p.yaw)*p.speed, 0, Math.cos(p.yaw)*p.speed); p.air = false;
    },
    setSpeed(v) {
      if (!field) return;
      const p = field.player;
      p.speed = v;
      p.vel.set(Math.sin(p.yaw) * v, p.air ? p.vel.y : 0, Math.cos(p.yaw) * v);
    },
    setNitro(v) { if (field) field.player.nitro = v; },
    live() {
      const p = field && field.player;
      if (!p) return null;
      const q = p.lastQuery || (trackBuilt && trackBuilt.query(p.pos.x, p.pos.y, p.pos.z));
      return {
        t: p.t, lap: p.lap, cp: p.cp, spd: p.speed, air: !!p.air, airTime: p.airTime || 0,
        falls: p.fallCount, jumps: p.jumps, nit: p.nitro, fin: !!p.finished, time: p.time,
        place: p.place, ww: !!p.wrongWay, yaw: p.yaw, reason: p.fallReason || '',
        pos: p.pos.toArray(), vel: p.vel.toArray(),
        q: q && {
          valid: q.valid, kind: q.kind, t: q.t, onR: q.onRoad, onI: q.onIsland, inG: q.inGap,
          h: q.height, lat: q.absLat, dist: q.dist, rh: q.roadHalf, ih: q.islandHalf, sc: !!q.shortcut
        }
      };
    },
    gaps() {
      if (!trackBuilt) return [];
      return trackBuilt.rec.gaps.map(g => {
        const a = trackBuilt.atT(g.from), b = trackBuilt.atT(g.to);
        const dx=a.pos.x-b.pos.x, dy=a.pos.y-b.pos.y, dz=a.pos.z-b.pos.z;
        return { from:g.from, to:g.to, needNitro:!!g.needNitro, chord:+Math.hypot(dx,dy,dz).toFixed(2),
                 path:+(((g.to-g.from+1)%1)*trackBuilt.length).toFixed(1), length:+trackBuilt.length.toFixed(1) };
      });
    },
    setYaw(y) { if (field) field.player.yaw = y; },
    inspect(t) {
      if (!trackBuilt) return null;
      const s = trackBuilt.atT(t);
      const q = trackBuilt.query(s.pos.x, s.pos.y + 0.5, s.pos.z);
      return {
        t, length: trackBuilt.length, cps: trackBuilt.checkpoints,
        pos: s.pos.toArray(), kind: s.kind, roadHalf: s.roadHalf, islandHalf: s.islandHalf,
        q: { valid:q.valid, kind:q.kind, onRoad:q.onRoad, onIsland:q.onIsland, inGap:q.inGap, height:q.height, absLat:q.absLat, t:q.t }
      };
    },
    timeScale: 1,
    lockQuality: false,
    get orientHold() { return !!orientHold; },
    needsRotate() { return needsRotateOverlay(); },
    isPhoneLike() { return isPhoneLike(); },
    applyOrientation() { applyOrientation(); return { hold: !!orientHold, need: needsRotateOverlay(), phone: isPhoneLike() }; },
    get quality() { return quality; },
    setQuality(q) { quality = q; applyQuality(); return quality; },
    renderInfo() {
      return {
        quality, fps: fpsAvg,
        pixelRatio: renderer.getPixelRatio(),
        exposure: renderer.toneMappingExposure,
        shadows: renderer.shadowMap.enabled,
        shadowSize: lights && lights.sun ? lights.sun.shadow.mapSize.x : 0,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        camBack: field && field.player ? +chaseOffset(field.player).back.toFixed(2) : null,
        colliders: trackBuilt && trackBuilt.colliders ? trackBuilt.colliders.length : 0
      };
    },
    nearestCollider(kind) {
      if (!trackBuilt || !trackBuilt.colliders || !field) return null;
      const p = field.player;
      let best = null, bd = 1e9;
      for (const c of trackBuilt.colliders) {
        if (kind && c.kind !== kind) continue;
        const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best && { x: best.x, y: best.y, z: best.z, r: best.r, h: best.h, kind: best.kind, dist: bd };
    },
    lastCrash() { return lastCrash; },
    snapChase() { if (field) snapChase(field.player); },
    ramProp(kind) {
      if (!trackBuilt || !trackBuilt.colliders || !field) return null;
      const p = field.player;
      let best = null, bestScore = 1e9;
      for (const col of trackBuilt.colliders) {
        if (kind && col.kind !== kind) continue;
        const q = trackBuilt.query(col.x, col.y + 0.5, col.z);
        if (!q || !q.valid || !q.onIsland || q.inGap) continue;
        if (q.t < 0.08 || q.t > 0.92) continue;
        const score = Math.abs(q.t - 0.25);
        if (score < bestScore) { bestScore = score; best = { col, q }; }
      }
      if (!best) {
        const c = this.nearestCollider(kind);
        if (!c) return null;
        best = { col: c, q: trackBuilt.query(c.x, c.y + 0.5, c.z) };
      }
      const c = best.col, q = best.q;
      const s = (q && q.t != null) ? trackBuilt.atT(q.t) : null;
      let nx, nz, px, pz, py;
      if (s && s.right) {
        const side = Math.sign((q && q.lateral) || 1) || 1;
        const approachLat = side * Math.min(s.islandHalf - 0.8, Math.max(s.roadHalf + 0.7, Math.abs((q && q.absLat) || (s.roadHalf + 2)) - c.r - 1.6));
        px = s.pos.x + s.right.x * approachLat;
        pz = s.pos.z + s.right.z * approachLat;
        py = s.pos.y + 0.3;
        nx = c.x - px; nz = c.z - pz;
        const d = Math.hypot(nx, nz) || 1; nx /= d; nz /= d;
      } else {
        nx = 1; nz = 0; px = c.x - (c.r + 2); pz = c.z; py = c.y + 0.35;
      }
      p.pos.set(px, py, pz);
      p.yaw = Math.atan2(nx, nz);
      p.t = (q && q.t) || p.t;
      p.speed = 24;
      p.vel.set(Math.sin(p.yaw) * 24, 0, Math.cos(p.yaw) * 24);
      p.air = false; p.crashCool = 0; p.crashSlip = 0; p.invuln = 0;
      lastCrash = null;
      snapChase(p);
      return { x: c.x, y: c.y, z: c.z, r: c.r, h: c.h, kind: c.kind, t: q && q.t };
    },
    advance(sec) {
      if (!raceState || !field) return null;
      let left = Math.max(0, +sec || 0);
      if (orientHold) return window.__qa.live && window.__qa.live();
      while (left > 0 && !orientHold && (mode === 'race' || mode === 'finish') && !field.racers.every(r => r.finished)) {
        const chunk = Math.min(0.4, left);
        const evs = stepRace(raceState, input.read(), chunk);
        raceClock += chunk;
        if (evs) {
          for (const e of evs) {
            if (e.type === 'crash') lastCrash = { t: raceClock, hard: !!e.hard, impact: e.impact, kind: e.kind, player: !!e.player };
          }
        }
        left -= chunk;
      }
      const p = field.player;
      if (p) UI.updateHud(p, field.racers.length);
      if (p && p.finished && mode === 'race') finishPlayer();
      return window.__qa.live && window.__qa.live();
    },
    resetSave() { return resetSave(); },
    forceFall() { if (field) { field.player.pos.y = -5; field.player.air = true; field.player.vel.y = -10; } },
    finishNow() {
      const p = field.player;
      p.finished = true; p.finishTime = p.time + p.penalty; p.lap = p.lapsTotal;
      finishPlayer();
    },
    autopilot(on = true) { window.__qa.auto = on; },
    claimDaily() { document.getElementById('btnClaim') && document.getElementById('btnClaim').click(); },
    goMenu() { goMenu(); },
    screenshotName() { return 'qa'; }
  };
  // autopilot: reuse AI on player
  const origRead = input.read;
  input.read = () => {
    if (window.__qa && window.__qa.forceInput) return window.__qa.forceInput;
    if (window.__qa && window.__qa.auto && field && trackBuilt && mode === 'race' && !field.player.finished) {
      // Center-line look-ahead + early nitro: stable on jumps. In-game AI still uses aiInput.
      const look = 16 / trackBuilt.length;
      let ug = null, ugDt = 1;
      for (const g of trackBuilt.rec.gaps) {
        let dt = g.from - field.player.t; if (dt < -0.5) dt += 1;
        if (dt >= 0 && dt < ugDt) { ugDt = dt; ug = g; }
      }
      const pl = field.player;
      // Follow the center line on the ground; only aim at the far lip once airborne
      const aimT = (pl.air && ug)
        ? ((ug.to + 0.015) % 1)
        : ((pl.t + look) % 1 + 1) % 1;
      const fut = trackBuilt.atT(aimT);
      const to = fut.pos.clone().sub(pl.pos); to.y = 0;
      const want = Math.atan2(to.x, to.z);
      let d = want - pl.yaw; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2;
      const q = pl.lastQuery;
      if (q && typeof q.lateral === 'number' && !pl.air) d += Math.max(-0.55, Math.min(0.55, -q.lateral * 0.14));
      const gapMeters = ug ? ugDt * trackBuilt.length : 1e9;
      const nearJump = !!(ug && gapMeters < 24 && !pl.air);
      const needCharge = !nearJump && !pl.air && pl.nitro < 0.55 && pl.speed > 12;
      const steer = Math.max(-1, Math.min(1, d * (pl.air ? 0.95 : 1.55) + (needCharge ? 0.28 : 0)));
      return {
        steer,
        gas: 1,
        brake: !nearJump && !pl.air && Math.abs(d) > 0.95 ? 1 : 0,
        drift: !!(needCharge || (!nearJump && !pl.air && Math.abs(d) > 0.5 && pl.speed > 11)),
        nitro: !!(nearJump || pl.air)
      };
    }
    return origRead();
  };
}

boot().catch(err => {
  console.error(err);
  document.getElementById('loadtxt').textContent = 'Error: ' + (err && err.message || err);
});
