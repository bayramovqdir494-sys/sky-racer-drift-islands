import * as THREE from 'three';
import { CARS, AI_NAMES, AI_COLORS, applyUpgrades, starForPlace, prizeForPlace } from './data.js';
import { makeCar, spinWheels, setCarFX, makeProp } from './vehicles.js';
import { ensureCarUp } from './save.js';

const GRAVITY = 42;
const STEP = 1 / 60;
const MAX_STEPS = 3;
const MAX_STEPS_FAST = 180;

function wrap01(t) { t = t % 1; if (t < 0) t += 1; return t; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function yawOf(tan) { return Math.atan2(tan.x, tan.z); }

export function createRacer(spec) {
  const r = {
    id: spec.id,
    name: spec.name,
    isPlayer: !!spec.isPlayer,
    ai: spec.ai || null,
    carId: spec.carId,
    colorId: spec.colorId,
    stats: spec.stats,
    mesh: spec.mesh,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    roll: 0,
    steer: 0,
    steerIn: 0,
    speed: 0,
    air: false,
    airTime: 0,
    drift: 0,
    drifting: false,
    nitro: 0.35,
    nitOn: false,
    t: 0,
    lap: 1,
    lapsTotal: spec.laps || 3,
    cp: 0,
    finished: false,
    finishTime: 0,
    place: 0,
    invuln: 0,
    boostT: 0,
    fallCount: 0,
    jumpLand: 0,
    lastBoostT: -1,
    penalty: 0,
    time: 0,
    progress: 0,
    wrot: 0,
    lastQuery: null,
    hints: { gas: false, drift: false, jump: false },
    crashCool: 0,
    crashSlip: 0,
    joltPitch: 0,
    joltRoll: 0,
    stuckT: 0,
    // mission counters local
    driftAcc: 0,
    nitroUses: 0,
    jumps: 0,
    boosts: 0,
    fell: false
  };
  return r;
}

function placeOnTrack(racer, track, t, lateral = 0, speed = 0) {
  const s = track.atT(wrap01(t));
  racer.t = wrap01(t);
  racer.pos.copy(s.pos).addScaledVector(s.right, lateral).addScaledVector(s.up, 0.02);
  racer.yaw = yawOf(s.tan);
  racer.pitch = 0; racer.roll = 0;
  racer.speed = speed;
  racer.vel.set(Math.sin(racer.yaw) * speed, 0, Math.cos(racer.yaw) * speed);
  racer.air = false; racer.airTime = 0;
  racer.lastQuery = null;
}

export function setupGrid(racers, track, laps) {
  const startT = 0.985;
  // two columns, staggered
  racers.forEach((r, i) => {
    const row = Math.floor(i / 2);
    const col = (i % 2) === 0 ? -1 : 1;
    const t = wrap01(startT - row * 0.012);
    const lat = col * 2.4;
    placeOnTrack(r, track, t, lat, 0);
    r.lap = 1;
    r.lapsTotal = laps;
    r.cp = 0;
    r.finished = false;
    r.finishTime = 0;
    r.time = 0;
    r.penalty = 0;
    r.nitro = r.isPlayer ? 0.4 : 0.25 + Math.random() * 0.2;
    r.invuln = 0.4;
    r.fallCount = 0;
    r.driftAcc = 0; r.nitroUses = 0; r.jumps = 0; r.boosts = 0; r.fell = false;
  });
}

function occupied(pos, self, racers, min = 2.6) {
  if (!racers) return false;
  for (const o of racers) {
    if (o === self) continue;
    const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z;
    if (dx * dx + dz * dz < min * min) return true;
  }
  return false;
}

function respawn(racer, track, penalty, racers) {
  const cps = track.checkpoints;
  let t = cps[racer.cp] ?? 0;
  // Never spawn in a gap, off the island, or without run-up to the next jump
  for (let k = 0; k < 70; k++) {
    const s0 = track.atT(t);
    const q0 = track.query(s0.pos.x, s0.pos.y + 0.6, s0.pos.z);
    let nearGap = false;
    for (const g of track.rec.gaps) {
      let dt = g.from - t; if (dt < -0.5) dt += 1;
      if (dt >= 0 && dt < 0.05) { nearGap = true; break; }
    }
    if (s0.kind !== 'gap' && q0.valid && q0.onIsland && !q0.inGap && !nearGap) break;
    t = wrap01(t + 0.01);
  }
  const s = track.atT(t);
  const lats = [0, 2.5, -2.5, 4.0, -4.0, 1.3, -1.3, 5.2, -5.2];
  let placed = false;
  const tmp = new THREE.Vector3();
  for (const lat of lats) {
    const maxLat = Math.max(0.4, s.roadHalf - 0.6);
    const use = clamp(lat, -maxLat, maxLat);
    tmp.copy(s.pos).addScaledVector(s.right, use).addScaledVector(s.up, 0.4);
    if (!occupied(tmp, racer, racers, 2.6)) {
      racer.pos.copy(tmp);
      placed = true;
      break;
    }
  }
  if (!placed) {
    // last resort: a bit further along the track
    const s2 = track.atT(wrap01(t + 0.02));
    racer.pos.copy(s2.pos).addScaledVector(s2.up, 0.5);
  }
  racer.yaw = yawOf(s.tan);
  racer.pitch = racer.roll = 0;
  racer.speed = racer.stats.top * 0.62;
  racer.vel.set(Math.sin(racer.yaw) * racer.speed, 0, Math.cos(racer.yaw) * racer.speed);
  racer.air = false; racer.airTime = 0;
  racer._jumpFrom = racer._jumpTo = null;
  racer.nitro = Math.max(racer.nitro, 0.38);
  racer.drift = 0; racer.drifting = false; racer.wrongWay = false;
  racer.invuln = 0.95;
  racer.penalty += penalty;
  racer.fallCount++;
  racer.fell = true;
  racer.t = t;
}

function upcomingGap(track, t, look = 0.12) {
  const rec = track.rec;
  for (const g of rec.gaps) {
    let dt = g.from - t;
    if (dt < -0.5) dt += 1;
    if (dt >= 0 && dt < look) return { gap: g, dt, dist: dt * track.length };
  }
  return null;
}

function gapNear(track, t, look = 0.04) {
  const rec = track.rec;
  for (const g of rec.gaps) {
    let inside = false;
    if (g.from <= g.to) inside = t >= g.from && t < g.to;
    else inside = t >= g.from || t < g.to;
    if (inside) return { gap: g, dt: 0, dist: 0, inside: true };
    let dt = g.from - t;
    if (dt < -0.5) dt += 1;
    if (dt >= 0 && dt < look) return { gap: g, dt, dist: dt * track.length, inside: false };
  }
  return null;
}

function gapMetrics(track, g) {
  const a = track.atT(g.from);
  const b = track.atT(g.to);
  const chord = a.pos.distanceTo(b.pos);
  return { a, b, chord, dy: b.pos.y - a.pos.y };
}

function launchImpulse(racer, track, ug, q) {
  const gm = gapMetrics(track, ug.gap);
  const need = !!(ug.gap && ug.gap.needNitro);
  const boost = racer.nitOn || racer.boostT > 0;
  const vx = Math.max(racer.speed, 10);
  const tNeed = Math.max(0.38, gm.chord / vx);
  const margin = 1.8 + (need ? 1.4 : 0.4);
  let vyNeed = (gm.dy + margin) / tNeed + 0.5 * GRAVITY * tNeed;
  vyNeed = Math.max(8, Math.min(42, vyNeed));
  const pitch = Math.max(0.24, (q && q.rampPitch) || 0.24);
  let vy = racer.speed * pitch * 2.25 + 6.0;
  if (need && boost) {
    vy = Math.max(vy, vyNeed * 1.05);
    racer.speed *= 1.08;
  } else if (need && !boost) {
    // Noticeably short on the long / uphill nitro gaps, but still a real jump
    vy = Math.min(Math.max(vy * 0.72, 8), vyNeed * 0.80);
    racer.speed *= 0.90;
  } else {
    // Early tracks: always enough height if the car is mostly lined up
    vy = Math.max(vy, vyNeed);
  }
  racer.air = true;
  racer.airTime = 0;
  racer.vel.y = vy;
  racer.pos.y += 0.3;
  // Arcade: jump toward the next island, not off a hairpin tangent into the void
  const land = gm.b;
  const toX = land.pos.x - racer.pos.x, toZ = land.pos.z - racer.pos.z;
  if (toX * toX + toZ * toZ > 1) {
    const want = Math.atan2(toX, toZ);
    racer.yaw += angDiff(want, racer.yaw) * 0.78;
    const hs = Math.max(racer.speed, Math.hypot(racer.vel.x, racer.vel.z));
    racer.vel.x = Math.sin(racer.yaw) * hs;
    racer.vel.z = Math.cos(racer.yaw) * hs;
    racer.speed = hs;
  }
  racer.bigAir = need || (gm.chord > 22);
  racer._jumpFrom = ug.gap.from;
  racer._jumpTo = ug.gap.to;
  racer._jumpChord = gm.chord;
  return racer.bigAir;
}

export function aiInput(racer, track, player, dt) {
  const skill = racer.ai.skill;
  const q = racer.lastQuery;
  if (!q || !q.valid) return { gas: 1, brake: 0, steer: 0, drift: 0, nitro: 0 };
  const look = (11 + skill * 18) / track.length;
  const future = track.atT(wrap01(racer.t + look));
  const near = track.atT(wrap01(racer.t + look * 0.45));
  // racing line: hug the inside of the upcoming bend
  const csign = Math.sin(angDiff(yawOf(future.tan), yawOf(near.tan)));
  const lineLat = -Math.sign(csign || 1) * future.roadHalf * (0.22 + skill * 0.28);
  let wobble = 0;
  // occasional mistakes — more often on low skill, rare even for champs
  const mistakeWave = Math.sin(racer.time * (0.55 + racer.ai.seed * 0.2) + racer.ai.seed * 4);
  if (mistakeWave > 0.93 + skill * 0.08) wobble = (1.15 - skill) * 1.6 * Math.sign(Math.sin(racer.ai.seed + racer.time));
  else wobble = Math.sin(racer.t * 28 + racer.ai.seed) * (1 - skill) * 0.7;
  const target = future.pos.clone().addScaledVector(future.right, lineLat + wobble);
  const to = target.clone().sub(racer.pos);
  to.y = 0;
  const wantYaw = Math.atan2(to.x, to.z);
  let steer = clamp(angDiff(wantYaw, racer.yaw) * (1.45 + skill * 0.4), -1, 1);

  // Block: if the player is close behind, shade toward their line
  if (player && !player.finished && skill > 0.7 && racer.progress > player.progress) {
    const gap = racer.progress - player.progress;
    if (gap > 0 && gap < 0.045 && player.lastQuery) {
      const plat = player.lastQuery.lateral || 0;
      const mylat = q.lateral || 0;
      steer += clamp((plat - mylat) * 0.18, -0.45, 0.45);
    }
  }

  const curv = Math.abs(angDiff(yawOf(future.tan), racer.yaw));
  let tgt = racer.stats.top * (racer.ai.speedMul || 1);
  tgt *= 1 / (1 + curv * (7.6 - skill * 4.4));
  if (q.absLat > q.roadHalf * 0.84) tgt *= 0.72;

  const ug = upcomingGap(track, racer.t, 0.16);
  const closeJump = !!(ug && ug.dist < 26);
  if (ug) {
    const needNitro = !!(ug.gap && ug.gap.needNitro);
    const need = (needNitro ? 24 : 16) + (ug.dist > 16 ? 6 : 0) + track.rec.difficulty * 0.5;
    // Only light the nitro in the last ~1s so the tank is not empty at the lip
    if (closeJump && (needNitro || racer.speed < need) && racer.nitro > 0.12) racer._aiNitro = true;
    else if (!closeJump) racer._aiNitro = false;
    if (closeJump) tgt = Math.max(tgt, Math.min(racer.stats.top * (racer._aiNitro ? 1.2 : 1.06), need + 3));
  } else racer._aiNitro = false;

  if (player && !player.finished && !racer.finished) {
    let delta = player.progress - racer.progress;
    const rub = racer.ai.rubber;
    // Champion rubber-bands less (fairer duel); pack AI still catch up
    const champMul = racer.ai.champ ? 0.45 : 1;
    if (delta > 0.05) tgt *= 1 + Math.min(rub, delta * 0.55) * champMul;
    if (delta < -0.07) tgt *= 1 - Math.min(rub * 0.9, -delta * 0.45);
  }

  // Dive-bomb a car just ahead (overtake) — later worlds do this more often
  if (!racer.air && track._racers && skill > 0.58) {
    let ahead = null, aheadGap = 1;
    for (const o of track._racers) {
      if (o === racer || o.finished) continue;
      const d = o.progress - racer.progress;
      if (d > 0.002 && d < aheadGap) { aheadGap = d; ahead = o; }
    }
    if (ahead && aheadGap < 0.038) {
      const alat = (ahead.lastQuery && ahead.lastQuery.lateral) || 0;
      const side = -Math.sign(alat || (Math.sin(racer.ai.seed) || 1));
      steer += clamp(side * (0.35 + skill * 0.3) - alat * 0.12, -0.65, 0.65);
      if (curv < 0.3 && racer.nitro > 0.18 && aheadGap < 0.022) racer._aiNitro = true;
    }
  }

  if (racer.air && racer._jumpTo != null) {
    const land = track.atT(((racer._jumpTo + 0.01) % 1 + 1) % 1);
    const toL = land.pos.clone().sub(racer.pos); toL.y = 0;
    const want = Math.atan2(toL.x, toL.z);
    steer = clamp(angDiff(want, racer.yaw) * 1.15, -1, 1);
  }
  const gas = racer.speed < tgt || closeJump || racer.air ? 1 : 0.18;
  const brake = !closeJump && !racer.air && racer.speed > tgt * 1.14 && curv > 0.48 ? 1 : 0;
  const drift = !closeJump && !racer.air && (curv > 0.36 && racer.speed > 10 && skill > 0.52) ? 1 : 0;
  const nitro = (racer._aiNitro || (curv < 0.18 && racer.speed > racer.stats.top * 0.72 && skill > 0.78 && racer.nitro > 0.32)) ? 1 : 0;
  return { gas, brake, steer: clamp(steer, -1, 1), drift, nitro };
}

function applyInput(racer, inp, track, dt, fx, wind) {
  const st = racer.stats;
  const q = track.query(racer.pos.x, racer.pos.y, racer.pos.z);
  racer.lastQuery = q;

  // If a crash left someone wedged in the weeds, nudge back toward the road.
  if (!racer.air && q && q.valid && q.onIsland && q.absLat > (q.roadHalf || 5) + 0.6 && racer.speed < 5.5) {
    racer.stuckT = (racer.stuckT || 0) + dt;
    if (racer.stuckT > 1.15 && q.right && q.tan) {
      const side = Math.sign(q.lateral || 1) || 1;
      racer.pos.x -= q.right.x * side * Math.min(2.4, q.absLat - q.roadHalf * 0.35);
      racer.pos.z -= q.right.z * side * Math.min(2.4, q.absLat - q.roadHalf * 0.35);
      racer.pos.y = (q.height != null ? q.height : racer.pos.y) + 0.04;
      racer.yaw = yawOf(q.tan);
      racer.speed = Math.max(12, racer.stats.top * 0.45);
      racer.vel.set(Math.sin(racer.yaw) * racer.speed, 0, Math.cos(racer.yaw) * racer.speed);
      racer.stuckT = 0;
      racer.crashSlip = 0;
    }
  } else {
    racer.stuckT = 0;
  }

  // progress + anti-cheat + wrong-way
  const ev = { respawned: false, land: false, bigJump: false, cut: false, crash: null };
  racer.crashCool = Math.max(0, (racer.crashCool || 0) - dt);
  if (racer.crashSlip > 0) racer.crashSlip = Math.max(0, racer.crashSlip - dt);
  racer.joltPitch = lerp(racer.joltPitch || 0, 0, 1 - Math.pow(0.0004, dt));
  racer.joltRoll = lerp(racer.joltRoll || 0, 0, 1 - Math.pow(0.0004, dt));
  const qOnRibbon = q.valid && (q.onRoad || q.onIsland) && !q.inGap;
  if (qOnRibbon) racer._lastH = q.height;
  if (qOnRibbon) {
    const prevT = racer.t;
    let nextT = q.t;
    let dFwd = nextT - prevT;
    if (dFwd < -0.5) dFwd += 1;
    if (dFwd > 0.5) dFwd -= 1;
    // unofficial shortcut: jumped too far forward off a legal shortcut ribbon
    // Ignore jumpy queries (far from ribbon or huge one-frame t skips while mid-fork).
    if (!q.shortcut && !racer.air && dFwd > 0.16 && racer.invuln <= 0 && q.dist <= (q.roadHalf || 5) + 3) {
      ev.cut = true;
      racer.fallReason = 'cut';
      const pen = 1.0 + track.rec.difficulty * 0.1;
      respawn(racer, track, pen, track._racers || null);
      ev.respawned = true; ev.penalty = pen;
      syncMesh(racer, racer.lastQuery);
      return ev;
    }
    const headingAlign = q.tan ? Math.cos(angDiff(racer.yaw, yawOf(q.tan))) : 1;
    racer.wrongWay = !racer.air && q.onRoad && racer.speed > 4.5 && headingAlign < -0.35;
    if (racer.wrongWay) {
      // do not advance t or checkpoints while running backward
      nextT = prevT;
    }
    // Do not rewrite t from a mid-air query — gap/shortcut snaps stall or skip progress.
    if (!(racer.air && !q.onIsland)) racer.t = nextT;
    if (!racer.finished && !racer.wrongWay) {
      const cps = track.checkpoints;
      let guard = 0;
      while (guard++ < cps.length) {
        const next = cps[(racer.cp + 1) % cps.length];
        if (!passedForward(prevT, racer.t, next)) break;
        racer.cp = (racer.cp + 1) % cps.length;
        if (racer.cp === 0 && racer.lap >= 1) {
          if (racer.lap >= racer.lapsTotal) {
            racer.finished = true;
            racer.finishTime = racer.time + racer.penalty;
            racer.progress = racer.lapsTotal;
            racer.speed *= 0.5;
            break;
          } else {
            racer.lap += 1;
          }
        }
      }
    }
    if (!racer.finished) racer.progress = (racer.lap - 1) + racer.t;
    else racer.progress = racer.lapsTotal;
  }

  if (racer.finished) {
    inp = { gas: 0.2, brake: 0.2, steer: inp.steer * 0.3, drift: 0, nitro: 0 };
  }

  racer.steerIn = lerp(racer.steerIn, clamp(inp.steer, -1, 1), 1 - Math.pow(0.001, dt));
  racer.invuln = Math.max(0, racer.invuln - dt);
  racer.boostT = Math.max(0, racer.boostT - dt);

  // If we were marked airborne but are still over an island at a sane height,
  // re-stick (prevents falling through a dipped road after a bad query).
  // Do not cancel a real launch: those have a strong upward velocity.
  // Only re-stick brief false-air (query flicker). Real jumps use the landing window.
  if (racer.air && qOnRibbon && racer.airTime < 0.28 && racer.vel.y <= 3 && racer.vel.y >= -8 &&
      racer.pos.y <= q.height + 1.25 && racer.pos.y >= q.height - 1.8) {
    racer.air = false;
    racer.airTime = 0;
    racer.pos.y = q.height + 0.02;
    racer.vel.y = 0;
  }
  const grounded = !racer.air;
  const grip = (q.valid ? q.grip : 1) * st.handling;

  // nitro
  const wantNitro = inp.nitro && racer.nitro > 0.05;
  if (wantNitro && !racer.nitOn) racer.nitroUses++;
  racer.nitOn = wantNitro;
  if (racer.nitOn) racer.nitro = Math.max(0, racer.nitro - dt * 0.28);
  if (!racer.nitOn && !(inp.drift && racer.drifting)) {
    racer.nitro = Math.min(1, racer.nitro + dt * 0.02);
  }

  if (grounded && q.valid && (q.onRoad || q.onIsland)) {
    // attach to surface
    const targetY = q.height + 0.02;
    if (racer.pos.y < targetY + 0.8) racer.pos.y = lerp(racer.pos.y, targetY, 1 - Math.pow(0.0001, dt));

    const maxSteer = (1.55 * st.handling) / (1 + Math.abs(racer.speed) / st.top * 0.75);
    // Initiation takes a clear steer; once sliding, a lighter hold keeps it — releasing a long drift gives a snap boost
    const canStart = inp.drift && Math.abs(racer.steerIn) > 0.28 && racer.speed > 10;
    const canHold = inp.drift && racer.drifting && Math.abs(racer.steerIn) > 0.11 && racer.speed > 7.5;
    racer.drifting = !!(canStart || canHold);
    if (racer.drifting) {
      racer.drift = lerp(racer.drift, 1, 1 - Math.pow(0.045, dt));
      racer.driftHold = (racer.driftHold || 0) + dt;
      racer.driftAcc += dt;
      const charge = racer.drift * (racer.speed / st.top) * st.drift * 0.48 * dt;
      racer.nitro = Math.min(1, racer.nitro + charge);
    } else {
      if ((racer.driftHold || 0) > 0.7 && racer.drift > 0.55 && racer.speed > 12 && !racer._driftBoosted) {
        racer.boostT = Math.max(racer.boostT, 0.34);
        racer.speed = Math.min(st.top * (st.nitro || 1) * 0.98, racer.speed * 1.07);
        racer._driftBoosted = true;
        ev.driftBoost = true;
      }
      if (!inp.drift) racer._driftBoosted = false;
      racer.driftHold = 0;
      racer.drift = lerp(racer.drift, 0, 1 - Math.pow(0.0008, dt));
    }

    const yawRate = maxSteer * racer.steerIn * (racer.drifting ? (1.20 + racer.drift * 0.44) : 1.0);
    racer.yaw += yawRate * dt;
    racer.steer = racer.steerIn;

    const heading = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    // acceleration
    let acc = 0;
    if (inp.gas) acc += st.acc * (racer.drifting ? 0.72 : 1);
    if (inp.brake) acc -= st.acc * 1.55;
    // drag
    const top = st.top * (racer.nitOn ? st.nitro : 1) * (racer.boostT > 0 ? 1.22 : 1);
    acc -= racer.speed * racer.speed * (0.014) * Math.sign(racer.speed);
    if (!inp.gas && !inp.brake) acc -= racer.speed * 0.9;
    racer.speed += acc * dt;
    const minS = inp.brake && racer.speed < 0 ? -6 : 0;
    racer.speed = clamp(racer.speed, minS, top);
    if (q.onIsland && !q.onRoad) racer.speed *= 1 - dt * 1.05; // grass penalty

    // Solid lip: keep cars from sliding off the island sides (visual rails + invisible curb).
    // Do not block forward launches — those leave via upcomingGap, not sideways.
    if (q.onIsland && !q.inGap && q.islandHalf && q.absLat > q.islandHalf - 1.15) {
      const outward = Math.sign(q.lateral || 1);
      const limit = q.islandHalf - 1.15;
      const excess = q.absLat - limit;
      racer.pos.x -= q.right.x * outward * excess;
      racer.pos.z -= q.right.z * outward * excess;
      const vOut = racer.vel.x * q.right.x + racer.vel.z * q.right.z;
      if (vOut * outward > 0) {
        racer.vel.x -= q.right.x * vOut * 1.05;
        racer.vel.z -= q.right.z * vOut * 1.05;
      }
    }

    // velocity vs heading (slip) — a committed drift gets looser; over-rotating costs speed
    // After a prop hit, keep the bounce for a beat instead of snapping back to heading.
    const align = racer.crashSlip > 0
      ? 0.85
      : (racer.drifting ? (1.28 + grip * 1.15 - racer.drift * 0.4) : (6 + grip * 7));
    const want = heading.multiplyScalar(racer.speed);
    racer.vel.x = lerp(racer.vel.x, want.x, 1 - Math.pow(Math.exp(-align), dt));
    racer.vel.z = lerp(racer.vel.z, want.z, 1 - Math.pow(Math.exp(-align), dt));
    racer.vel.y = 0;
    if (racer.drifting && q.tan) {
      const ang = Math.abs(angDiff(racer.yaw, yawOf(q.tan)));
      if (ang > 0.95) racer.speed *= 1 - dt * (0.7 + (ang - 0.95) * 1.4);
    }
    if (wind && q.kind !== 'gap') {
      racer.vel.x += wind.x * dt * 0.25;
      racer.vel.z += wind.z * dt * 0.25;
    }

    racer.pos.x += racer.vel.x * dt;
    racer.pos.z += racer.vel.z * dt;

    // match pitch to road
    const tp = Math.asin(clamp(q.tan.y, -0.6, 0.6));
    racer.pitch = lerp(racer.pitch, tp + (q.rampPitch || 0), 1 - Math.pow(0.01, dt));
    const wantRoll = -racer.steerIn * 0.22 - (racer.drift * 0.18 * Math.sign(racer.steerIn || 1));
    racer.roll = lerp(racer.roll, wantRoll, 1 - Math.pow(0.02, dt));

    // boost pad
    if (q.boost && q.onRoad && racer.lastBoostT !== Math.round(q.t * 1000)) {
      racer.boostT = 1.15;
      racer.speed = Math.max(racer.speed, st.top * 0.92);
      racer.lastBoostT = Math.round(q.t * 1000);
      racer.boosts++;
    }

    // launch off ramp / end of road — wait for a real run-up unless already at the lip
    const ug = gapNear(track, racer.t, 0.03);
    const atLip = !!(ug && (ug.inside || ug.dist < 1.6));
    const canLaunch = !!(ug && ug.dist < 4.2 && (racer.speed > 16 || atLip) && (q.rampPitch > 0.02 || atLip || ug.dist < 1.8));
    if (canLaunch) {
      if (launchImpulse(racer, track, ug, q)) ev.bigJump = true;
    } else if (q.valid && !q.onIsland && racer.invuln <= 0) {
      // slipped off the side — if this is actually a gap lip, still launch
      const ug2 = gapNear(track, racer.t, 0.05);
      if (ug2 && racer.speed > 10) {
        if (launchImpulse(racer, track, ug2, q)) ev.bigJump = true;
      } else {
        racer.air = true;
        racer.airTime = 0;
        racer.vel.y = Math.min(2, racer.vel.y);
        racer.fallReason = racer.fallReason || 'edge';
      }
    }
  } else {
    // air / fall
    // Safety-net launch if we slipped into a gap without an impulse
    if (racer.airTime === 0 && racer.vel.y < 6 && racer.speed > 10) {
      const ug0 = gapNear(track, racer.t, 0.05);
      if (ug0) {
        if (launchImpulse(racer, track, ug0, q)) ev.bigJump = true;
      }
    }
    racer.air = true;
    racer.airTime += dt;
    racer.drifting = false;
    racer.drift = lerp(racer.drift, 0, dt * 4);
    const airSteer = 0.55 * st.air * racer.steerIn;
    racer.yaw += airSteer * dt;
    racer.steer = racer.steerIn;
    racer.vel.y -= GRAVITY * dt;
    if (wind) {
      racer.vel.x += wind.x * dt * 0.28;
      racer.vel.z += wind.z * dt * 0.28;
    }
    // slight air control
    const heading = new THREE.Vector3(Math.sin(racer.yaw), 0, Math.cos(racer.yaw));
    racer.vel.x += heading.x * inp.gas * st.air * 3.5 * dt;
    racer.vel.z += heading.z * inp.gas * st.air * 3.5 * dt;
    racer.pos.addScaledVector(racer.vel, dt);
    if (racer._jumpTo != null) {
      const land = track.atT(wrap01(racer._jumpTo + 0.01));
      const toX = land.pos.x - racer.pos.x, toZ = land.pos.z - racer.pos.z;
      const dist = Math.hypot(toX, toZ) || 1;
      const nx = toX / dist, nz = toZ / dist;
      const hs = Math.max(8, Math.hypot(racer.vel.x, racer.vel.z));
      const k = 1 - Math.exp(-6.2 * dt); // pull the flight line onto the next island
      racer.vel.x += (nx * hs - racer.vel.x) * k;
      racer.vel.z += (nz * hs - racer.vel.z) * k;
      if (racer._jumpFrom != null) {
        const a = track.atT(racer._jumpFrom), b = track.atT(racer._jumpTo);
        const abx = b.pos.x - a.pos.x, abz = b.pos.z - a.pos.z;
        const L2 = abx * abx + abz * abz || 1;
        const u = clamp(((racer.pos.x - a.pos.x) * abx + (racer.pos.z - a.pos.z) * abz) / L2, 0, 1);
        let span = racer._jumpTo - racer._jumpFrom; if (span < 0) span += 1;
        racer.t = wrap01(racer._jumpFrom + u * span);
      }
    }
    racer.pitch = lerp(racer.pitch, clamp(racer.vel.y * 0.02, -0.5, 0.4), dt * 3);
    racer.roll = lerp(racer.roll, -racer.steerIn * 0.3, dt * 3);

    // landing?
    const q2 = track.query(racer.pos.x, racer.pos.y, racer.pos.z);
    racer.lastQuery = q2;
    if (q2.valid && q2.onIsland && racer.vel.y <= 0 && racer.pos.y <= q2.height + 1.2 && racer.pos.y >= q2.height - 2.6) {
      const ang = Math.abs(angDiff(racer.yaw, yawOf(q2.tan)));
      const hard = racer.vel.y < -26 || ang > 1.15;
      racer.pos.y = q2.height + 0.02;
      ev.land = true;
      ev.hard = hard;
      ev.airTime = racer.airTime;
      ev.vy = racer.vel.y;
      ev.bigAir = !!racer.bigAir;
      const airT = racer.airTime;
      racer.air = false;
      racer.airTime = 0;
      if (airT > 0.22) racer.jumps++;
      racer.jumpLand = 0.25;
      racer.bigAir = false;
      racer._jumpFrom = racer._jumpTo = null;
      if (hard && track.rec.difficulty >= 4) {
        racer.speed *= 0.55;
        racer.yaw += (Math.random() - 0.5) * 0.6;
        // may slide toward edge
      } else if (hard) {
        racer.speed *= 0.75;
      }
      racer.vel.y = 0;
      if (q2.onRoad) racer.t = q2.t;
    }
    // Kill plane is relative to the local ribbon (tracks may dip below y=0).
    // Prefer the post-move query, then last on-ribbon height — never a far sample.
    const near = (qq) => qq && qq.valid && !qq.inGap && qq.dist <= (qq.islandHalf || 8) + 4;
    const surface = near(q2) ? q2.height : (near(q) ? q.height : (racer._lastH ?? 0));
    // Still over an island at a plausible height? Try to land instead of killing.
    if (q2.valid && q2.onIsland && racer.vel.y <= 0 &&
        racer.pos.y <= q2.height + 1.3 && racer.pos.y >= q2.height - 2.8) {
      racer.pos.y = q2.height + 0.02;
      ev.land = true; ev.hard = false; ev.airTime = racer.airTime; ev.vy = racer.vel.y;
      const airT = racer.airTime;
      racer.air = false; racer.airTime = 0;
      if (airT > 0.22) racer.jumps++;
      racer.jumpLand = 0.25;
      racer.vel.y = 0; racer.bigAir = false;
      racer._jumpFrom = racer._jumpTo = null;
      if (q2.onRoad) racer.t = q2.t;
    } else {
      const jumping = racer._jumpTo != null && racer.airTime < 2.7;
      const landY = jumping ? track.atT(racer._jumpTo).pos.y : surface;
      const floor = (jumping ? landY : surface) - (jumping ? 10 : 6.2);
      const longAir = racer.airTime > (jumping ? 2.6 : 2.4) && racer.pos.y < landY - 8;
      // Mid-gap is allowed to dip; only kill after a real miss or a long fall
      if ((racer.pos.y < floor && racer.airTime > (jumping ? 0.85 : 0.5)) || longAir) {
        racer.fallReason = 'kill';
        racer._jumpFrom = racer._jumpTo = null;
        const pen = 1.4 + track.rec.difficulty * 0.18;
        respawn(racer, track, pen, track._racers || null);
        ev.respawned = true; ev.penalty = pen;
        return ev;
      }
    }
  }

  // body pose
  syncMesh(racer, q);
  return ev;
}

function passedForward(prev, now, gate) {
  // did we cross `gate` going forward from prev to now?
  let d = now - prev;
  if (d < -0.5) d += 1; // wrapped forward
  if (d > 0.5) return false; // big backward jump, ignore
  if (d < 0) return false;
  if (prev <= now) return gate > prev && gate <= now;
  // wrapped
  return gate > prev || gate <= now;
}

function syncMesh(racer, q) {
  const m = racer.mesh;
  if (!m) return;
  m.position.copy(racer.pos);
  const e = m.rotation;
  e.order = 'YXZ';
  m.rotation.y = racer.yaw;
  m.rotation.x = racer.pitch + (racer.joltPitch || 0);
  m.rotation.z = racer.roll + (racer.joltRoll || 0);
}

export function pushApart(racers, dt, fx) {
  const hits = [];
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i], b = racers[j];
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, dy = a.pos.y - b.pos.y;
      if (Math.abs(dy) > 2.2) continue;
      const d2 = dx * dx + dz * dz;
      const min = 2.35;
      if (d2 < min * min && d2 > 1e-5) {
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const overlap = min - d;
        // If one just respawned, move only the invulnerable car out
        const aInv = a.invuln > 0.4, bInv = b.invuln > 0.4;
        const aShare = aInv && !bInv ? 1 : (!aInv && bInv ? 0 : 0.5);
        a.pos.x += nx * overlap * aShare; a.pos.z += nz * overlap * aShare;
        b.pos.x -= nx * overlap * (1 - aShare); b.pos.z -= nz * overlap * (1 - aShare);
        const rel = (a.vel.x - b.vel.x) * nx + (a.vel.z - b.vel.z) * nz;
        if (rel < 0 && !aInv && !bInv) {
          const rest = 0.38;
          const imp = -(1 + rest) * rel * 0.5;
          a.vel.x += nx * imp; a.vel.z += nz * imp;
          b.vel.x -= nx * imp; b.vel.z -= nz * imp;
          const spA = Math.hypot(a.vel.x, a.vel.z), spB = Math.hypot(b.vel.x, b.vel.z);
          if (a.speed > 0) a.speed = spA;
          if (b.speed > 0) b.speed = spB;
          if (fx && (a.isPlayer || b.isPlayer) && Math.random() < 0.5) {
            const mid = a.pos.clone().lerp(b.pos, 0.5); mid.y += 0.5;
            fx.spark(mid, new THREE.Vector3(nx * 4, 3, nz * 4));
          }
          hits.push({ a, b, imp });
        }
      }
    }
  }
  return hits;
}

const SOLID_PROP = {
  rock:    { tight: 0.70, minR: 0.85 },
  pine:    { tight: 0.30, minR: 0.48 },
  oak:     { tight: 0.34, minR: 0.55 },
  cactus:  { tight: 0.58, minR: 0.45 },
  crystal: { tight: 0.52, minR: 0.65 }
};
const CAR_R = 1.15;

function hash02(a, b) {
  return Math.abs(Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1;
}

function colliderFrom(kind, p, mesh) {
  const spec = SOLID_PROP[kind];
  if (!spec) return null;
  const geo = mesh.geometry;
  if (geo && !geo.boundingBox) geo.computeBoundingBox();
  const bb = geo && geo.boundingBox;
  const sx = bb ? (bb.max.x - bb.min.x) : 1;
  const sy = bb ? (bb.max.y - bb.min.y) : 1;
  const sz = bb ? (bb.max.z - bb.min.z) : 1;
  const r = Math.max(spec.minR, 0.5 * Math.max(sx, sz) * p.scale * spec.tight);
  const h = Math.max(1.15, sy * p.scale);
  return { x: p.pos.x, y: p.islandY, z: p.pos.z, r, h, kind };
}

export function collideProps(racers, track, dt, fx) {
  const cols = track && track.colliders;
  if (!cols || !cols.length) return [];
  const hits = [];
  for (const r of racers) {
    if ((r.invuln || 0) > 0.45) continue;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const dy = r.pos.y - c.y;
      if (dy > c.h + 0.5 || dy < -1.15) continue;
      const dx = r.pos.x - c.x, dz = r.pos.z - c.z;
      const min = CAR_R + c.r + 0.04;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(Math.max(1e-6, d2));
      const nx = dx / d, nz = dz / d;
      const overlap = min - d;
      r.pos.x += nx * (overlap + 0.02);
      r.pos.z += nz * (overlap + 0.02);
      const vOut = r.vel.x * nx + r.vel.z * nz;
      const impact = vOut < 0 ? -vOut : 0;
      if (vOut < 0) {
        r.vel.x += nx * (1 + 0.32) * impact;
        r.vel.z += nz * (1 + 0.32) * impact;
      }
      // Always cancel leftover inward velocity so the car slides, not sinks in
      const vOut2 = r.vel.x * nx + r.vel.z * nz;
      if (vOut2 < 0) {
        r.vel.x -= nx * vOut2;
        r.vel.z -= nz * vOut2;
      }
      if (impact > 2.2) {
        const lose = clamp(0.14 + impact * 0.02, 0.14, 0.40);
        r.speed *= (1 - lose);
        r.speed = Math.max(5, r.speed);
        const hs2 = Math.hypot(r.vel.x, r.vel.z) || 1;
        r.vel.x = r.vel.x / hs2 * r.speed;
        r.vel.z = r.vel.z / hs2 * r.speed;
        const hx = Math.sin(r.yaw), hz = Math.cos(r.yaw);
        const side = hx * nz - hz * nx;
        r.yaw += clamp(side * 0.10, -0.14, 0.14);
        r.joltPitch = clamp(-0.14 - impact * 0.012, -0.38, 0.08);
        r.joltRoll = clamp(-side * (0.22 + impact * 0.02), -0.42, 0.42);
        r.crashSlip = Math.max(r.crashSlip || 0, 0.2);
        r.drifting = false;
        const hard = impact > 14 || r.speed > 22;
        if ((r.crashCool || 0) <= 0) {
          r.crashCool = 0.32;
          const pos = new THREE.Vector3(c.x + nx * c.r, r.pos.y + 0.45, c.z + nz * c.r);
          if (fx && fx.crash) fx.crash(pos, new THREE.Vector3(nx, 0.4, nz), hard ? 1 : 0.7);
          hits.push({ racer: r, pos, nx, nz, impact, hard, kind: c.kind, player: !!r.isPlayer });
        }
      } else {
        r.speed = Math.hypot(r.vel.x, r.vel.z);
      }
    }
  }
  return hits;
}

export function updatePlaces(racers) {
  const live = racers.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  live.forEach((r, i) => { r.place = i + 1; });
  return live;
}

export function stepRace(state, inputs, dt) {
  const events = [];
  state.acc += dt;
  let steps = 0;
  const maxSteps = Math.min(MAX_STEPS_FAST, Math.max(MAX_STEPS, Math.ceil((state.acc + 1e-9) / STEP)));
  while (state.acc >= STEP && steps < maxSteps) {
    state.acc -= STEP;
    steps++;
    const wind = state.wind;
    if (wind) {
      wind.t += STEP;
      wind.x = Math.sin(wind.t * 0.7) * wind.str;
      wind.z = Math.cos(wind.t * 0.5) * wind.str * 0.6;
    }
    state.track._racers = state.racers;
    for (const r of state.racers) {
      if (state.phase !== 'race' && state.phase !== 'finish') continue;
      if (state.phase === 'race' && !r.finished) r.time += STEP;
      let inp;
      if (r.isPlayer) inp = inputs;
      else inp = aiInput(r, state.track, state.player, STEP);
      const ev = applyInput(r, inp, state.track, STEP, state.fx, wind);
      if (ev && ev.respawned && r.isPlayer) events.push({ type: ev.cut ? 'cut' : 'respawn', penalty: ev.penalty });
      if (ev && ev.land && r.isPlayer) events.push({ type: 'land', hard: ev.hard, airTime: ev.airTime, bigAir: ev.bigAir, vy: ev.vy });
      if (ev && ev.bigJump && r.isPlayer) events.push({ type: 'bigJump' });
      spinWheels(r.mesh, r.speed, r.steer, STEP, r.air);
      setCarFX(r.mesh, { brake: inp.brake, nitro: r.nitOn, drift: r.drifting });
      if (state.fx && r.drifting && !r.air && Math.random() < 0.65) {
        const side = Math.sign(r.steer || 1);
        const p = r.pos.clone();
        p.x -= Math.sin(r.yaw) * 1.4 + Math.cos(r.yaw) * side * 0.7;
        p.z -= Math.cos(r.yaw) * 1.4 - Math.sin(r.yaw) * side * 0.7;
        p.y += 0.2;
        state.fx.smoke(p, new THREE.Vector3(-r.vel.x * 0.1, 0.6, -r.vel.z * 0.1), 0.7);
        if (r.isPlayer && state.fx.skid) state.fx.skid(p, r.yaw);
      }
      if (state.fx && r.jumpLand > 0) {
        r.jumpLand -= STEP;
        if (Math.random() < 0.5) state.fx.dust(r.pos.clone().setY(r.pos.y + 0.1), new THREE.Vector3((Math.random()-0.5)*2, 1, (Math.random()-0.5)*2));
      }
    }
    pushApart(state.racers, STEP, state.fx);
    const propHits = collideProps(state.racers, state.track, STEP, state.fx);
    for (const h of propHits) {
      events.push({ type: 'crash', player: h.player, hard: h.hard, impact: h.impact, kind: h.kind, pos: h.pos });
    }
    updatePlaces(state.racers);
  }
  return events;
}

export function decorateTrack(track, quality) {
  const group = new THREE.Group();
  const list = track.propPlacements;
  const cap = quality === 'low' ? 0.4 : quality === 'med' ? 0.7 : 0.9;
  const byKind = {};
  for (const p of list) {
    if (hash02(p.pos.x, p.pos.z) > cap) continue;
    (byKind[p.kind] || (byKind[p.kind] = [])).push(p);
  }
  const colliders = [];
  const dummy = new THREE.Object3D();
  for (const kind of Object.keys(byKind)) {
    const arr = byKind[kind];
    const proto = makeProp(kind, 1);
    let srcMesh = null;
    proto.traverse(o => { if (o.isMesh && !srcMesh) srcMesh = o; });
    if (!srcMesh) {
      for (const p of arr) {
        const m = makeProp(kind, p.scale);
        m.position.copy(p.pos); m.position.y = p.islandY; m.rotation.y = p.yaw;
        group.add(m);
        let mesh = null;
        m.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
        if (mesh) {
          const col = colliderFrom(kind, p, mesh);
          if (col) colliders.push(col);
        }
      }
      continue;
    }
    let mat = srcMesh.material;
    if (kind === 'crystal') {
      mat = srcMesh.material.clone();
      mat.emissive = new THREE.Color(0xaa88ff);
      mat.emissiveIntensity = 0.7;
      mat.roughness = 0.18;
      mat.metalness = 0.15;
      mat.vertexColors = true;
    }
    const inst = new THREE.InstancedMesh(srcMesh.geometry, mat, arr.length);
    inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false;
    arr.forEach((p, i) => {
      dummy.position.copy(p.pos);
      dummy.position.y = p.islandY;
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      const col = colliderFrom(kind, p, srcMesh);
      if (col) colliders.push(col);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }
  // Keep the contact plane just outside the asphalt so a fair racing
  // line never clips a rock, but running off the road still hits it.
  for (const c of colliders) {
    const q = track.query(c.x, c.y + 0.4, c.z);
    if (!q || !q.valid || q.roadHalf == null) continue;
    const lat = (typeof q.absLat === 'number') ? q.absLat : Math.abs(q.lateral || 0);
    // Contact starts ~0.9m off the asphalt so a fair (even slightly wide) line is clear.
    const margin = (c.kind === 'pine' || c.kind === 'oak') ? 1.15 : 0.9;
    const maxR = lat - q.roadHalf - CAR_R - margin;
    if (maxR < 0.32) c.r = -1;
    else if (maxR < c.r) c.r = maxR;
  }
  track.colliders = colliders.filter(c => c.r >= 0.32);
  return group;
}

export function makeField(trackId, save, opts = {}) {
  const laps = opts.laps || 3;
  const mode = opts.mode || 'race';
  const nAI = opts.aiCount != null ? opts.aiCount : (mode === 'trial' ? 0 : 6);
  const recCar = CARS.find(c => c.id === save.car) || CARS[0];
  const stats = applyUpgrades(recCar, ensureCarUp(recCar.id));
  const playerMesh = makeCar(recCar.id, save.color);
  const player = createRacer({
    id: 'player', name: 'You', isPlayer: true, carId: recCar.id, colorId: save.color,
    stats, mesh: playerMesh, laps
  });
  const racers = [player];
  const usedCars = ['hatch', 'coupe', 'pickup', 'muscle', 'buggy', 'police', 'super'];
  const champ = opts.champ || null;
  for (let i = 0; i < nAI; i++) {
    const isChamp = !!(champ && i === 0);
    const cid = isChamp ? (champ.car || 'super') : usedCars[(i + 1) % usedCars.length];
    const base = CARS.find(c => c.id === cid) || CARS[0];
    const st = applyUpgrades(base, { speed: isChamp ? 5 : Math.min(3, i >> 1), handling: isChamp ? 4 : 1, nitro: isChamp ? 4 : 1 });
    const mesh = makeCar(cid, isChamp ? (champ.color || 'cyan') : nullColor(i));
    racers.push(createRacer({
      id: isChamp ? 'champ' : ('ai' + i),
      name: isChamp ? champ.name : AI_NAMES[i % AI_NAMES.length],
      isPlayer: false,
      carId: cid, colorId: isChamp ? (champ.color || 'cyan') : 'ai',
      stats: st, mesh, laps,
      ai: {
        skill: isChamp ? (champ.skill || 1.1) : 0.5,
        speedMul: isChamp ? (champ.speedMul || 1.1) : 0.9,
        rubber: isChamp ? 0.08 : 0.1,
        seed: i * 1.7 + 0.3,
        champ: isChamp
      }
    }));
  }
  return { player, racers, mode, champ };
}

function nullColor(i) {
  const ids = ['blue', 'yellow', 'purple', 'black', 'orange', 'cyan', 'lime', 'pink'];
  return ids[i % ids.length];
}

export function bindAIToTrack(racers, rec, player) {
  const p = player || racers.find(x => x.isPlayer);
  for (const r of racers) {
    if (!r.ai) continue;
    const worldRamp = 0.9 + rec.difficulty * 0.018;
    r.ai.skill = rec.aiSkill * (0.90 + (r.ai.seed % 1) * 0.18) * worldRamp / (0.9 + 0.018);
    r.ai.speedMul = rec.aiSpeed * (0.95 + (r.ai.seed * 0.7 % 1) * 0.09);
    r.ai.rubber = rec.rubber * (rec.difficulty >= 6 ? 0.85 : 1);
    if (p) {
      const mul = r.ai.champ ? r.ai.speedMul : r.ai.speedMul;
      r.stats.top = p.stats.top * mul;
      r.stats.acc = p.stats.acc * (0.88 + r.ai.skill * 0.18);
      r.stats.handling = p.stats.handling * (0.86 + r.ai.skill * 0.2);
      r.stats.nitro = p.stats.nitro * (0.85 + rec.difficulty * 0.03);
      r.stats.drift = p.stats.drift;
      r.stats.air = p.stats.air;
    }
  }
}


export function makeGhostMesh(carId, colorId) {
  const m = makeCar(carId || 'hatch', colorId || 'cyan');
  m.traverse(o => {
    if (o.isMesh && o.material) {
      const mat = o.material.clone();
      mat.transparent = true;
      mat.opacity = 0.42;
      mat.depthWrite = false;
      mat.emissive = mat.emissive || new THREE.Color(0x44ddff);
      if (mat.emissive) mat.emissiveIntensity = (mat.emissiveIntensity || 0) + 0.25;
      o.material = mat;
      o.castShadow = false;
    }
  });
  return m;
}

export function sampleGhost(samples, time) {
  if (!samples || !samples.length) return null;
  if (time <= samples[0][0]) return samples[0];
  if (time >= samples[samples.length - 1][0]) return samples[samples.length - 1];
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] < time) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const u = (time - a[0]) / Math.max(1e-4, b[0] - a[0]);
  return [
    time,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
    a[3] + (b[3] - a[3]) * u,
    a[4] + (b[4] - a[4]) * u
  ];
}

export { wrap01, yawOf, respawn };

