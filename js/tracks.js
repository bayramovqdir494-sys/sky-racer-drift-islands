import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';

const THEMES = {
  grass: {
    skyTop: 0x8fd4ff, skyMid: 0xc8ecff, skyBot: 0xf7e7b8, fog: 0xb8dcf0, fogN: 90, fogF: 320,
    road: 0x8a93a3, line: 0xffe56a, curbA: 0xff3a3a, curbB: 0xf4f4f4,
    island: 0x3ec75a, island2: 0x2f9a44, side: 0x8a6238, under: 0x5a3e28,
    ambient: 0xa8d4ff, sun: 0xfff3d0, sunInt: 1.7, hemiTop: 0xfff6e0, hemiBot: 0x3a7a38,
    grip: 1, props: ['pine', 'oak', 'rock', 'floating_rock'], wind: 0
  },
  desert: {
    skyTop: 0xffc878, skyMid: 0xffe0a8, skyBot: 0xffd0a0, fog: 0xf0c898, fogN: 80, fogF: 300,
    road: 0x6a5340, line: 0xffe08a, curbA: 0xc45a20, curbB: 0xf0d8b0,
    island: 0xe0a24a, island2: 0xc47a30, side: 0xa85a2a, under: 0x6a3a1c,
    ambient: 0xffd0a0, sun: 0xffe0b0, sunInt: 1.85, hemiTop: 0xffe8c0, hemiBot: 0xb06a30,
    grip: 0.94, props: ['cactus', 'rock', 'floating_rock'], wind: 0
  },
  snow: {
    skyTop: 0xc8dcf8, skyMid: 0xe8f2ff, skyBot: 0xf4f8ff, fog: 0xd8e8f8, fogN: 70, fogF: 280,
    road: 0xd0dce8, line: 0x3a6aaa, curbA: 0xffffff, curbB: 0x7aa0c8,
    island: 0xf2f7ff, island2: 0xd8e6f4, side: 0x9ab0c8, under: 0x6a8098,
    ambient: 0xd0e4ff, sun: 0xfff8f0, sunInt: 1.3, hemiTop: 0xffffff, hemiBot: 0x80a0c0,
    grip: 0.80, props: ['pine', 'rock', 'floating_rock'], wind: 0.15
  },
  ember: {
    skyTop: 0xff6a28, skyMid: 0xc43a20, skyBot: 0x2a1020, fog: 0x6a2830, fogN: 70, fogF: 260,
    road: 0x2a2628, line: 0xff9a2a, curbA: 0xff3a00, curbB: 0x3a2020,
    island: 0x4a322c, island2: 0x32201c, side: 0x7a3830, under: 0x2a1410,
    ambient: 0xa05038, sun: 0xff9048, sunInt: 1.65, hemiTop: 0xffa060, hemiBot: 0x301018,
    grip: 0.96, props: ['rock', 'floating_rock'], wind: 0, lava: true
  },
  neon: {
    skyTop: 0x1a1050, skyMid: 0x0c0828, skyBot: 0x050310, fog: 0x180c30, fogN: 80, fogF: 280,
    road: 0x161022, line: 0x2ee6ff, curbA: 0xff4fa3, curbB: 0x2ee6ff,
    island: 0x2a1a48, island2: 0x1c1238, side: 0x4a2a80, under: 0x1a1030,
    ambient: 0x6850a0, sun: 0x90e8ff, sunInt: 1.35, hemiTop: 0xa080ff, hemiBot: 0x301048,
    grip: 1.02, props: ['rock', 'crystal', 'floating_rock'], wind: 0, neon: true
  },
  cloud: {
    skyTop: 0xb8e8ff, skyMid: 0xf0f8ff, skyBot: 0xfff4d8, fog: 0xe8f4ff, fogN: 60, fogF: 260,
    road: 0xf0efe8, line: 0xe0a020, curbA: 0xffffff, curbB: 0xe8d0a0,
    island: 0xfffaf0, island2: 0xe8e0d0, side: 0xd0c8b8, under: 0xb8b0a0,
    ambient: 0xe8f4ff, sun: 0xfff8e0, sunInt: 1.8, hemiTop: 0xffffff, hemiBot: 0xc0d8f0,
    grip: 1.00, props: ['oak', 'floating_rock'], wind: 0.2
  },
  storm: {
    skyTop: 0x3a5068, skyMid: 0x1a2838, skyBot: 0x0c141c, fog: 0x243040, fogN: 50, fogF: 220,
    road: 0x2a3038, line: 0xc0d0e0, curbA: 0x4a80c0, curbB: 0x202428,
    island: 0x3a4848, island2: 0x2a3838, side: 0x2a3438, under: 0x141c1c,
    ambient: 0x688090, sun: 0xd0e0f0, sunInt: 1.0, hemiTop: 0x90b0c8, hemiBot: 0x243038,
    grip: 0.86, props: ['pine', 'rock', 'floating_rock'], wind: 0.4
  },
  aurora: {
    skyTop: 0x0a1a28, skyMid: 0x051018, skyBot: 0x03080e, fog: 0x082018, fogN: 70, fogF: 270,
    road: 0x1a2430, line: 0x40ffb0, curbA: 0x40ffb0, curbB: 0xb44bff,
    island: 0x1e4050, island2: 0x163040, side: 0x2a5860, under: 0x142830,
    ambient: 0x308060, sun: 0xb0ffe8, sunInt: 1.25, hemiTop: 0x80ffd0, hemiBot: 0x281848,
    grip: 0.78, props: ['pine', 'rock', 'crystal', 'floating_rock'], wind: 0.25, aurora: true
  }
};

const RECIPES = [
  {
    id: 'green', name: 'Green Isles', theme: 'grass', difficulty: 1, unlockStars: 0,
    rx: 98, rz: 80, points: 28, wobble: 0.10, wobbleFreq: 3,
    road: 12.4, islandPad: 7.2, elevAmp: 3.5, elevFreq: 2,
    gaps: [{ from: 0.18, to: 0.225, ramp: 0.035 }, { from: 0.62, to: 0.66, ramp: 0.03 }],
    bridges: [{ from: 0.40, to: 0.45 }],
    boosts: [0.08, 0.33, 0.55, 0.80],
    shortcut: { enter: 0.48, exit: 0.60, bulge: -18, width: 7.2 },
    aiSkill: 0.62, aiSpeed: 0.88, rubber: 0.11
  },
  {
    id: 'canyon', name: 'Canyon Drift', theme: 'desert', difficulty: 2, unlockStars: 0,
    rx: 108, rz: 72, points: 30, wobble: 0.16, wobbleFreq: 4,
    road: 11.2, islandPad: 6.2, elevAmp: 5.5, elevFreq: 3,
    gaps: [{ from: 0.14, to: 0.178, ramp: 0.04 }, { from: 0.36, to: 0.398, ramp: 0.03 }, { from: 0.74, to: 0.778, ramp: 0.04 }],
    bridges: [{ from: 0.52, to: 0.56 }],
    boosts: [0.10, 0.28, 0.48, 0.68, 0.90],
    shortcut: { enter: 0.56, exit: 0.70, bulge: 16, width: 6.4 },
    deform: 'hairpin',
    aiSkill: 0.70, aiSpeed: 0.91, rubber: 0.10
  },
  {
    id: 'frost', name: 'Frost Arc', theme: 'snow', difficulty: 3, unlockStars: 3,
    rx: 102, rz: 86, points: 32, wobble: 0.13, wobbleFreq: 3,
    road: 10.6, islandPad: 5.6, elevAmp: 6.5, elevFreq: 2,
    gaps: [{ from: 0.22, to: 0.260, ramp: 0.04 }, { from: 0.70, to: 0.740, ramp: 0.035 }],
    bridges: [{ from: 0.44, to: 0.50 }],
    boosts: [0.12, 0.38, 0.58, 0.86],
    shortcut: { enter: 0.36, exit: 0.52, bulge: -20, width: 5.8 },
    aiSkill: 0.76, aiSpeed: 0.94, rubber: 0.09
  },
  {
    id: 'ember', name: 'Ember Ring', theme: 'ember', difficulty: 4, unlockStars: 6,
    rx: 112, rz: 78, points: 32, wobble: 0.15, wobbleFreq: 5,
    road: 10.6, islandPad: 5.4, elevAmp: 7.5, elevFreq: 3,
    gaps: [{ from: 0.10, to: 0.136, ramp: 0.04 }, { from: 0.40, to: 0.436, ramp: 0.045 }, { from: 0.78, to: 0.816, ramp: 0.035 }],
    bridges: [],
    boosts: [0.06, 0.24, 0.36, 0.62, 0.90],
    shortcut: { enter: 0.50, exit: 0.66, bulge: 18, width: 5.6 },
    aiSkill: 0.82, aiSpeed: 0.97, rubber: 0.08
  },
  {
    id: 'neon', name: 'Neon Night', theme: 'neon', difficulty: 5, unlockStars: 9,
    rx: 100, rz: 90, points: 34, wobble: 0.18, wobbleFreq: 4,
    road: 10.0, islandPad: 5.0, elevAmp: 5.0, elevFreq: 4,
    gaps: [{ from: 0.16, to: 0.196, ramp: 0.035 }, { from: 0.46, to: 0.496, ramp: 0.04 }, { from: 0.80, to: 0.836, ramp: 0.035 }],
    bridges: [{ from: 0.30, to: 0.34 }],
    boosts: [0.08, 0.28, 0.40, 0.66, 0.92],
    shortcut: { enter: 0.54, exit: 0.70, bulge: -17, width: 5.2 },
    deform: 'chicane',
    aiSkill: 0.88, aiSpeed: 0.99, rubber: 0.07
  },
  {
    id: 'cloud', name: 'Cloud Line', theme: 'cloud', difficulty: 6, unlockStars: 12,
    rx: 120, rz: 70, points: 30, wobble: 0.12, wobbleFreq: 2,
    road: 9.4, islandPad: 4.4, elevAmp: 8.5, elevFreq: 2,
    gaps: [{ from: 0.12, to: 0.174, ramp: 0.05, needNitro: true }, { from: 0.38, to: 0.434, ramp: 0.055, needNitro: true }, { from: 0.72, to: 0.774, ramp: 0.05, needNitro: true }],
    bridges: [{ from: 0.58, to: 0.62 }],
    boosts: [0.08, 0.28, 0.54, 0.68, 0.90],
    shortcut: { enter: 0.50, exit: 0.66, bulge: 14, width: 5.0 },
    aiSkill: 0.92, aiSpeed: 1.00, rubber: 0.06
  },
  {
    id: 'storm', name: 'Storm Peak', theme: 'storm', difficulty: 7, unlockStars: 16,
    rx: 108, rz: 88, points: 36, wobble: 0.17, wobbleFreq: 5,
    road: 9.4, islandPad: 4.4, elevAmp: 9.0, elevFreq: 3,
    gaps: [{ from: 0.08, to: 0.126, ramp: 0.045, needNitro: true }, { from: 0.32, to: 0.366, ramp: 0.05, needNitro: true }, { from: 0.56, to: 0.596, ramp: 0.04 }, { from: 0.82, to: 0.866, ramp: 0.05, needNitro: true }],
    bridges: [],
    boosts: [0.05, 0.22, 0.44, 0.70, 0.94],
    shortcut: { enter: 0.62, exit: 0.76, bulge: -15, width: 4.8 },
    deform: 'hairpin',
    aiSkill: 0.96, aiSpeed: 1.02, rubber: 0.05
  },
  {
    id: 'aurora', name: 'Aurora Loop', theme: 'aurora', difficulty: 8, unlockStars: 20,
    rx: 114, rz: 86, points: 36, wobble: 0.20, wobbleFreq: 4,
    road: 9.2, islandPad: 4.2, elevAmp: 8.0, elevFreq: 4,
    gaps: [{ from: 0.10, to: 0.146, ramp: 0.05, needNitro: true }, { from: 0.36, to: 0.406, ramp: 0.055, needNitro: true }, { from: 0.68, to: 0.724, ramp: 0.045, needNitro: true }],
    bridges: [{ from: 0.52, to: 0.56 }],
    boosts: [0.06, 0.26, 0.50, 0.80, 0.92],
    shortcut: { enter: 0.48, exit: 0.62, bulge: 16, width: 4.6 },
    deform: 'chicane',
    aiSkill: 1.00, aiSpeed: 1.04, rubber: 0.04
  }
];

function inRange(t, a, b) {
  t = ((t % 1) + 1) % 1;
  if (a <= b) return t >= a && t < b;
  return t >= a || t < b;
}
function spanContains(t, from, to) { return inRange(t, from, to); }

function deformPoint(kind, a, x, z, rec) {
  if (kind === 'hairpin') {
    const k = Math.sin(a * 2) * 0.5 + Math.sin(a * 5) * 0.5;
    const bump = Math.pow(Math.max(0, Math.sin(a * 2 + 0.6)), 3);
    x += Math.cos(a + 1.2) * bump * rec.rx * 0.22;
    z += Math.sin(a + 1.2) * bump * rec.rz * 0.22;
    x *= 1 - 0.08 * Math.abs(k);
  } else if (kind === 'chicane') {
    const s = Math.sin(a * 8) * Math.sin(a * 2);
    x += Math.cos(a + Math.PI / 2) * s * 14;
    z += Math.sin(a + Math.PI / 2) * s * 14;
  }
  return [x, z];
}

function controlPoints(rec) {
  const n = rec.points;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const a = u * Math.PI * 2;
    const wob = 1 + rec.wobble * Math.sin(a * rec.wobbleFreq);
    let x = Math.cos(a) * rec.rx * wob;
    let z = Math.sin(a) * rec.rz * wob;
    [x, z] = deformPoint(rec.deform, a, x, z, rec);
    const y = 6 + rec.elevAmp * Math.sin(a * rec.elevFreq) + 2.2 * Math.sin(a * 2 + 0.8);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

function classifyT(rec, t) {
  t = ((t % 1) + 1) % 1;
  // Leave a solid lip at both ends (~2–3 m) so cars can launch and land on real road,
  // instead of a sample that is still classified as "gap".
  const lip = 0.004;
  for (const g of rec.gaps) {
    const a = ((g.from + lip) % 1 + 1) % 1;
    const b = ((g.to - lip) % 1 + 1) % 1;
    if (spanContains(t, a, b)) return { kind: 'gap', gap: g };
  }
  for (const b of rec.bridges || []) if (spanContains(t, b.from, b.to)) return { kind: 'bridge', bridge: b };
  for (const g of rec.gaps) {
    const rampStart = ((g.from - g.ramp) % 1 + 1) % 1;
    if (spanContains(t, rampStart, g.from + lip)) {
      let u = t - (g.from - g.ramp);
      if (u < 0) u += 1;
      return { kind: 'ramp', gap: g, rampT: Math.max(0, Math.min(1, u / (g.ramp + lip))) };
    }
  }
  return { kind: 'road' };
}

function buildShortcut(rec, main) {
  if (!rec.shortcut) return null;
  const sc = rec.shortcut;
  const a = main.getPointAt(sc.enter);
  const b = main.getPointAt(sc.exit);
  const ta = main.getTangentAt(sc.enter);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const n = new THREE.Vector3(-ta.z, 0, ta.x).normalize();
  mid.addScaledVector(n, sc.bulge);
  mid.y = (a.y + b.y) * 0.5 + 1.2;
  const curve = new THREE.CatmullRomCurve3([a, mid, b], false, 'catmullrom', 0.4);
  return { curve, enter: sc.enter, exit: sc.exit, width: sc.width, length: curve.getLength() };
}

function sampleCurve(curve, closed, spacing) {
  const len = curve.getLength();
  const n = Math.max(32, Math.ceil(len / spacing));
  const samples = [];
  for (let i = 0; i < (closed ? n : n + 1); i++) {
    const t = i / n;
    const pos = curve.getPointAt(Math.min(0.99999, t));
    const tan = curve.getTangentAt(Math.min(0.99999, t)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, tan).normalize();
    // recompute up for mild banking from curvature later
    const up2 = new THREE.Vector3().crossVectors(tan, right).normalize();
    samples.push({ t, pos, tan, right, up: up2, dist: t * len });
  }
  return { samples, length: len, n };
}

function ribbonGeo(slices, halfFn, yFn, color, vcol = true) {
  const pos = [], nrm = [], col = [], uv = [], idx = [];
  const c = new THREE.Color(color);
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const h = halfFn(s, i);
    const yOff = yFn ? yFn(s, i) : 0;
    const pL = s.pos.clone().addScaledVector(s.right, -h).addScaledVector(s.up, yOff);
    const pR = s.pos.clone().addScaledVector(s.right,  h).addScaledVector(s.up, yOff);
    pos.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);
    nrm.push(s.up.x, s.up.y, s.up.z, s.up.x, s.up.y, s.up.z);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    uv.push(0, s.dist || i, 1, s.dist || i);
    if (i > 0) {
      const a = (i - 1) * 2, b = a + 1, d = i * 2, e = d + 1;
      idx.push(a, e, b, a, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function islandGeo(slices, halfFn, theme, thickness) {
  // Rounded floating-island shell: grass cap with a lowered lip, curved rocky sides, jagged underside.
  const cTop = new THREE.Color(theme.island);
  const cTop2 = new THREE.Color(theme.island2);
  const cSide = new THREE.Color(theme.side);
  const cUnder = new THREE.Color(theme.under);
  const N = slices.length;
  // Per slice, 6 verts: L-bottom, L-mid, L-lip, R-lip, R-mid, R-bottom  (and 2 inner grass: Li, Ri)
  // Layout per slice (8 verts): Li, Ri  (grass inner) then Ll, Rl (lip) then Lo, Ro (overhang) then Lm, Rm (mid under) then Lb, Rb (bottom)
  const STEPS = 5; // lip, overhang, mid, bottom-out, bottom-in — applied per side, plus inner
  const profile = [ // [latMul, yMul, kind] from inner grass to bottom
    [0.86, -0.12, 'top'],
    [1.00, -0.48, 'lip'],
    [1.10, -1.7, 'side'],
    [0.95, -thickness * 0.55, 'side'],
    [0.28, -thickness, 'under']
  ];
  const vertsPer = 2 * profile.length; // left then right for each profile row... better: for each row, L then R
  const posT = [], colT = [], idxT = [];
  const posS = [], colS = [], idxS = [];
  const rows = [];
  for (let i = 0; i < N; i++) {
    const s = slices[i];
    const h = halfFn(s, i);
    const jag = 1 + 0.08 * Math.sin(i * 1.7 + s.t * 9) + 0.05 * Math.sin(i * 4.2);
    const rock = 0.85 + 0.25 * Math.sin(i * 2.9 + s.t * 17);
    const row = [];
    for (const [latMul, yOff, kind] of profile) {
      const lat = h * latMul * (kind === 'under' ? rock : jag);
      const y = kind === 'under' ? yOff * rock : yOff;
      const L = s.pos.clone().addScaledVector(s.right, -lat).addScaledVector(s.up, y);
      const R = s.pos.clone().addScaledVector(s.right,  lat).addScaledVector(s.up, y);
      if (kind === 'under') { L.y = Math.min(L.y, s.pos.y + yOff * rock); R.y = Math.min(R.y, s.pos.y + yOff * rock); }
      row.push({ L, R, kind });
    }
    rows.push(row);
  }
  // grass cap (row 0 inner)
  for (let i = 0; i < N; i++) {
    const L = rows[i][0].L, R = rows[i][0].R;
    const mix = 0.5 + 0.5 * Math.sin(i * 0.35);
    const ct = cTop.clone().lerp(cTop2, mix);
    posT.push(L.x, L.y, L.z, R.x, R.y, R.z);
    colT.push(ct.r, ct.g, ct.b, ct.r, ct.g, ct.b);
    if (i > 0) {
      const a = (i - 1) * 2, b = a + 1, d = i * 2, e = d + 1;
      idxT.push(a, e, b, a, d, e);
    }
  }
  const pushQuad = (p1, p2, p3, p4, col, arrP, arrC, arrI) => {
    const base = arrP.length / 3;
    arrP.push(p1.x,p1.y,p1.z, p2.x,p2.y,p2.z, p3.x,p3.y,p3.z, p4.x,p4.y,p4.z);
    for (let k = 0; k < 4; k++) arrC.push(col.r, col.g, col.b);
    arrI.push(base, base+1, base+2, base, base+2, base+3);
  };
  for (let r = 0; r < profile.length - 1; r++) {
    const kind = profile[r + 1][2];
    const col = kind === 'under' ? cUnder : (r === 0 ? cTop.clone().lerp(cSide, 0.35) : cSide);
    for (let i = 1; i < N; i++) {
      const a = rows[i - 1][r], b = rows[i][r], c = rows[i][r + 1], d = rows[i - 1][r + 1];
      // left side (outward)
      pushQuad(a.L, b.L, c.L, d.L, col, posS, colS, idxS);
      // right side
      pushQuad(b.R, a.R, d.R, c.R, col, posS, colS, idxS);
    }
  }
  // underside cap
  const last = profile.length - 1;
  for (let i = 1; i < N; i++) {
    const a = rows[i - 1][last], b = rows[i][last];
    pushQuad(a.L, a.R, b.R, b.L, cUnder, posS, colS, idxS);
  }
  const gTop = new THREE.BufferGeometry();
  gTop.setAttribute('position', new THREE.Float32BufferAttribute(posT, 3));
  gTop.setAttribute('color', new THREE.Float32BufferAttribute(colT, 3));
  gTop.setIndex(idxT);
  gTop.computeVertexNormals();
  const gSide = new THREE.BufferGeometry();
  gSide.setAttribute('position', new THREE.Float32BufferAttribute(posS, 3));
  gSide.setAttribute('color', new THREE.Float32BufferAttribute(colS, 3));
  gSide.setIndex(idxS);
  gSide.computeVertexNormals();
  return [gTop, gSide];
}

function thinStrip(slices, latFn, yFn, halfWidth, color) {
  const fake = slices.map((s, i) => {
    const lat = latFn(s, i);
    const mid = s.pos.clone().addScaledVector(s.right, lat).addScaledVector(s.up, 0);
    return { ...s, pos: mid };
  });
  return ribbonGeo(fake, () => halfWidth, yFn, color);
}

function addCurbs(group, segs, theme) {
  const geos = [];
  segs.forEach(seg => {
    geos.push(thinStrip(seg, s => s.roadHalf + 0.22, () => 0.16, 0.22, theme.curbA));
    geos.push(thinStrip(seg, s => -(s.roadHalf + 0.22), () => 0.16, 0.22, theme.curbB));
  });
  const ok = geos.filter(Boolean);
  if (!ok.length) return;
  const g = mergeGeometries(ok, false);
  if (!g) return;
  const m = new THREE.Mesh(g, matVC(theme.curbA, { roughness: 0.55, metalness: 0.1 }));
  m.receiveShadow = true;
  group.add(m);
}

function addRails(group, samples, rec, theme) {
  const posts = [];
  const railSlicesL = [], railSlicesR = [];
  const nearGap = (t) => rec.gaps.some(g => {
    let d0 = Math.abs(((t - g.from + 0.5) % 1) - 0.5);
    let d1 = Math.abs(((t - g.to + 0.5) % 1) - 0.5);
    return d0 < 0.04 || d1 < 0.04;
  });
  for (let i = 2; i < samples.length - 2; i++) {
    const s = samples[i];
    if (s.kind === 'gap' || s.kind === 'bridge') continue;
    const a = samples[i - 2].tan, b = samples[i + 2].tan;
    const curv = 1 - Math.max(-1, Math.min(1, a.dot(b)));
    const danger = curv > 0.08 || nearGap(s.t) || rec.difficulty >= 5;
    if (!danger) continue;
    const side = (curv > 0.04) ? Math.sign(s.right.dot(new THREE.Vector3().subVectors(samples[i + 2].tan, samples[i - 2].tan))) || 1 : 0;
    const sides = nearGap(s.t) || rec.difficulty >= 6 ? [-1, 1] : (side === 0 ? [-1, 1] : [side]);
    for (const sg of sides) {
      const p = s.pos.clone().addScaledVector(s.right, sg * (s.roadHalf + 0.55)).addScaledVector(s.up, 0.16);
      posts.push({ p, up: s.up, tan: s.tan, right: s.right });
      const sl = { pos: p.clone().addScaledVector(s.up, 0.85), tan: s.tan, right: s.right, up: s.up, dist: s.dist, t: s.t };
      (sg < 0 ? railSlicesL : railSlicesR).push(sl);
    }
  }
  if (!posts.length) return;
  const postGeo = new THREE.BoxGeometry(0.09, 0.95, 0.09);
  const postMat = matSolid(theme.neon || theme.aurora ? 0x88e0ff : 0xc8d0d8, { metalness: 0.7, roughness: 0.3, emissive: theme.neon ? 0x2288aa : 0x000000, em: theme.neon ? 0.4 : 0 });
  const inst = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  inst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  posts.forEach((o, i) => {
    dummy.position.copy(o.p).addScaledVector(o.up, 0.5);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), o.up);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  group.add(inst);
  const railMat = matSolid(theme.neon || theme.aurora ? 0x2ee6ff : 0xd8dde4, { metalness: 0.75, roughness: 0.25, emissive: theme.neon ? 0x2ee6ff : 0x000000, em: theme.neon ? 0.6 : 0 });
  const addBeam = (arr) => {
    if (arr.length < 3) return;
    // split when points jump
    let run = [arr[0]];
    const flush = () => {
      if (run.length < 3) { run = []; return; }
      const g = ribbonGeo(run, () => 0.07, () => 0, railMat.color.getHex ? theme.line : 0xdde2e8);
      if (g) { const m = new THREE.Mesh(g, railMat); group.add(m); }
      run = [];
    };
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].pos.distanceTo(arr[i - 1].pos) > 4) flush();
      run.push(arr[i]);
    }
    flush();
  };
  addBeam(railSlicesL); addBeam(railSlicesR);
}

function addWaterfalls(group, islandSegs, theme) {
  if (!islandSegs.length) return;
  const mat = new THREE.MeshBasicMaterial({
    color: theme.aurora || theme.neon ? 0xa0ffff : 0xc8e8ff,
    transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide
  });
  const geos = [];
  islandSegs.forEach((seg, si) => {
    const spots = [2, 3, seg.length - 4, seg.length - 3, Math.floor(seg.length * 0.4), Math.floor(seg.length * 0.7)];
    const used = new Set();
    for (const idx of spots) {
      if (idx < 2 || idx >= seg.length - 2 || used.has(idx)) continue;
      if (hash2(si, idx) < 0.35 && idx !== 2 && idx !== seg.length - 4) continue;
      used.add(idx);
      const s = seg[idx];
      const side = hash2(idx, si * 3) > 0.5 ? 1 : -1;
      const top = s.pos.clone().addScaledVector(s.right, side * (s.islandHalf * 0.96)).addScaledVector(s.up, -0.4);
      const w = 1.3 + hash2(idx, 9) * 1.4;
      const h = 11 + hash2(idx, 4) * 8;
      const geo = new THREE.PlaneGeometry(w, h, 1, 6);
      geo.rotateY(Math.PI / 2);
      geo.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(top);
      m.lookAt(top.clone().add(s.right.clone().multiplyScalar(side)));
      // keep plane vertical
      m.rotation.x = 0;
      group.add(m);
      m.userData.waterfall = true;
    }
  });
}

function addFloatRocks(group, samples, rec, theme) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = matSolid(theme.under || theme.side, { roughness: 0.95, flat: false });
  const pts = [];
  for (let i = 0; i < samples.length; i += 4) {
    const s = samples[i];
    if (s.kind === 'gap') continue;
    if (hash2(s.pos.x, s.pos.z) < 0.55) continue;
    const side = hash2(s.t, 2) > 0.5 ? 1 : -1;
    const p = s.pos.clone().addScaledVector(s.right, side * (s.islandHalf + 2 + hash2(i, 1) * 5));
    p.y -= 2 + hash2(i, 5) * 8;
    pts.push({ p, s: 0.4 + hash2(i, 8) * 1.6, y: hash2(i, 3) * 6 });
  }
  if (!pts.length) return;
  const inst = new THREE.InstancedMesh(geo, mat, pts.length);
  inst.frustumCulled = false; inst.castShadow = true;
  const dummy = new THREE.Object3D();
  pts.forEach((o, i) => {
    dummy.position.copy(o.p);
    dummy.rotation.set(hash2(i, 1) * 6, o.y, hash2(i, 2) * 6);
    dummy.scale.setScalar(o.s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  group.add(inst);
}


function matVC(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex || 0xffffff, vertexColors: true, roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05, emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.em ?? 0, flatShading: !!opts.flat, side: opts.side || THREE.FrontSide
  });
}

function matSolid(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.em ?? 0
  });
}

function hash2(x, z) {
  return Math.abs(Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1;
}

export function totalStars(saveTracks) {
  let n = 0;
  for (const k of Object.keys(saveTracks || {})) n += (saveTracks[k].stars || 0);
  return n;
}

export function getRecipes() { return RECIPES; }

export function buildTrack(rec, shared) {
  const theme = THEMES[rec.theme];
  const pts = controlPoints(rec);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.25);
  const { samples: raw, length } = sampleCurve(curve, true, 0.85);
  const sc = buildShortcut(rec, curve);

  const samples = raw.map((s) => {
    const cls = classifyT(rec, s.t);
    const rampPitch = cls.kind === 'ramp' ? 0.12 + cls.rampT * 0.16 : 0;
    // lift ramps — rise toward the lip (ski jump), not a bump that drops before the gap
    if (rampPitch) {
      s.pos = s.pos.clone();
      s.pos.y += Math.sin(cls.rampT * Math.PI * 0.5) * (4.6 + rec.difficulty * 0.45);
    }
    const isBoost = rec.boosts.some(b => Math.abs(((s.t - b + 0.5) % 1) - 0.5) < 0.008);
    return {
      ...s, kind: cls.kind, rampPitch, boost: isBoost,
      roadHalf: cls.kind === 'bridge' ? rec.road * 0.62 : rec.road * 0.5,
      islandHalf: (cls.kind === 'gap') ? 0 : rec.road * 0.5 + rec.islandPad,
      grip: theme.grip * (cls.kind === 'bridge' ? 0.95 : 1)
    };
  });

  // spatial hash
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.pos.x); maxX = Math.max(maxX, s.pos.x);
    minZ = Math.min(minZ, s.pos.z); maxZ = Math.max(maxZ, s.pos.z);
  }
  const cell = 10;
  const grid = new Map();
  const key = (ix, iz) => ix + ',' + iz;
  const put = (x, z, ref) => {
    const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
    const k = key(ix, iz);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); }
    a.push(ref);
  };
  samples.forEach((s, i) => put(s.pos.x, s.pos.z, { type: 'main', i }));

  let scSamples = [];
  if (sc) {
    const pack = sampleCurve(sc.curve, false, 0.7);
    scSamples = pack.samples.map((s, i) => {
      const u = s.t;
      const tMain = sc.enter + u * ((sc.exit - sc.enter + 1) % 1 || (sc.exit - sc.enter));
      const tProg = sc.enter + u * ((sc.exit - sc.enter + 1) % 1);
      // handle wrap
      let span = sc.exit - sc.enter; if (span < 0) span += 1;
      return {
        ...s, kind: 'shortcut', rampPitch: 0, boost: false,
        roadHalf: sc.width * 0.5, islandHalf: sc.width * 0.5 + 2.2,
        grip: theme.grip * 0.92,
        tMain: sc.enter + u * span,
        scU: u
      };
    });
    scSamples.forEach((s, i) => put(s.pos.x, s.pos.z, { type: 'sc', i }));
  }

  // meshes
  const group = new THREE.Group();
  const roadSlices = samples.filter(s => s.kind !== 'gap');
  // split road into contiguous segments
  const segs = [];
  let cur = [];
  const pushSeg = () => { if (cur.length > 1) segs.push(cur); cur = []; };
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.kind === 'gap') pushSeg();
    else cur.push(s);
  }
  // close loop if start and end are both road
  if (cur.length && samples[0].kind !== 'gap' && segs.length) {
    segs[0] = cur.concat(segs[0]);
    cur = [];
  }
  pushSeg();

  const roadGeos = segs.map(seg => ribbonGeo(seg, s => s.roadHalf, (s) => 0.10, theme.road));
  const lineGeos = segs.map(seg => ribbonGeo(seg, () => 0.22, () => 0.13, theme.line));
  const curbGeos = [];
  segs.forEach(seg => {
    curbGeos.push(ribbonGeo(seg, s => s.roadHalf + 0.35, () => 0.08, theme.curbA));
  });

  const islandSegs = [];
  cur = [];
  for (const s of samples) {
    if (s.kind === 'gap' || s.kind === 'bridge') pushIsland();
    else cur.push(s);
  }
  function pushIsland() { if (cur.length > 2) islandSegs.push(cur); cur = []; }
  if (cur.length && samples[0].kind !== 'gap' && samples[0].kind !== 'bridge' && islandSegs.length) {
    islandSegs[0] = cur.concat(islandSegs[0]); cur = [];
  }
  pushIsland();

  const islandTops = [], islandSides = [];
  islandSegs.forEach(seg => {
    const [it, is] = islandGeo(seg, s => s.islandHalf, theme, 7 + rec.difficulty * 0.4);
    islandTops.push(it); islandSides.push(is);
  });

  const geosR = roadGeos.filter(Boolean);
  if (geosR.length) {
    const g = mergeGeometries(geosR, false);
    const m = new THREE.Mesh(g, matVC(theme.road, { roughness: 0.72, metalness: 0.08 }));
    m.receiveShadow = true; m.castShadow = false;
    group.add(m);
  }
  if (lineGeos.length) {
    const g = mergeGeometries(lineGeos, false);
    if (g) { const m = new THREE.Mesh(g, matVC(theme.line, { roughness: 0.5, em: theme.neon ? 0.6 : 0, emissive: theme.line })); m.receiveShadow = true; group.add(m); }
  }
  if (islandTops.length) {
    const g = mergeGeometries(islandTops, false);
    const m = new THREE.Mesh(g, matSolid(theme.island, { roughness: 0.92 }));
    m.receiveShadow = true; m.castShadow = true;
    group.add(m);
  }
  if (islandSides.length) {
    const g = mergeGeometries(islandSides, false);
    const m = new THREE.Mesh(g, matVC(theme.side, { roughness: 0.95 }));
    m.receiveShadow = true; m.castShadow = true;
    group.add(m);
  }
  addCurbs(group, segs, theme);
  addRails(group, samples, rec, theme);
  addWaterfalls(group, islandSegs, theme);
  addFloatRocks(group, samples, rec, theme);

  // boost pads
  rec.boosts.forEach((bt, i) => {
    const s = sampleAtT(samples, bt);
    if (!s) return;
    const g = new THREE.PlaneGeometry(s.roadHalf * 1.5, 3.2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0x2ee6ff, emissive: 0x2ee6ff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide
    }));
    m.position.copy(s.pos).addScaledVector(s.up, 0.12);
    m.lookAt(s.pos.clone().add(s.up));
    m.rotateZ(Math.PI / 2);
    m.userData.boost = true;
    group.add(m);
    // chevron arrows
    const che = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ffff, emissiveIntensity: 0.8 }));
    che.position.copy(s.pos).addScaledVector(s.up, 0.4).addScaledVector(s.tan, 0);
    che.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.tan.clone().normalize());
    group.add(che);
  });

  if (sc) {
    const scRoad = ribbonGeo(scSamples, s => s.roadHalf, () => 0.05, theme.road);
    const m = new THREE.Mesh(scRoad, matVC(theme.road, { roughness: 0.7 }));
    m.receiveShadow = true; group.add(m);
    const [it, is] = islandGeo(scSamples, s => s.islandHalf, theme, 5);
    const mi = new THREE.Mesh(it, matSolid(theme.island2, { roughness: 0.92 }));
    mi.receiveShadow = true; mi.castShadow = true; group.add(mi);
    const ms = new THREE.Mesh(is, matSolid(theme.side, { roughness: 0.95 }));
    ms.receiveShadow = true; ms.castShadow = true; group.add(ms);
  }

  // start finish banner poles
  const s0 = samples[0];
  const archH = 5.2, archW = rec.road + 2;
  const poleM = matSolid(0x222831, { metalness: 0.5, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, archH, 0.4), poleM);
    p.position.copy(s0.pos).addScaledVector(s0.right, side * archW * 0.5).addScaledVector(s0.up, archH / 2);
    p.castShadow = true; group.add(p);
  }
  const ban = document.createElement('canvas'); ban.width = 512; ban.height = 64;
  const bx = ban.getContext('2d');
  bx.fillStyle = rec.theme === 'neon' ? '#ff4fa3' : '#ff9a16';
  bx.fillRect(0, 0, 512, 64);
  bx.fillStyle = '#fff'; bx.font = 'bold 36px Trebuchet MS, sans-serif'; bx.textAlign = 'center';
  bx.fillText('START  /  FINISH', 256, 46);
  const bt = new THREE.CanvasTexture(ban);
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(archW, 1.4), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
  bm.position.copy(s0.pos).addScaledVector(s0.up, archH - 0.4);
  bm.lookAt(s0.pos.clone().add(s0.tan).addScaledVector(s0.up, archH - 0.4));
  bm.rotateY(Math.PI);
  group.add(bm);

  // checkpoints (logic only + small gates) — never sit inside a gap
  const checkpoints = [];
  const cpCount = 8;
  function snapCp(t) {
    t = ((t % 1) + 1) % 1;
    for (let k = 0; k < 60; k++) {
      let bad = false;
      for (const g of rec.gaps) {
        // Stay out of the gap and leave a run-up so a respawn can reach jump speed
        const runup = 0.055, pad = 0.016;
        if (spanContains(t, g.from - runup, g.to + pad) || spanContains(t, g.from, g.to)) { bad = true; break; }
      }
      if (!bad) return t;
      t = (t + 0.01) % 1;
    }
    return t;
  }
  for (let i = 0; i < cpCount; i++) checkpoints.push(snapCp(i / cpCount));

  const track = {
    rec, theme, curve, length, samples, scSamples, sc, group, grid, cell, key,
    minX, maxX, minZ, maxZ, checkpoints,
    start: { pos: samples[0].pos.clone(), tan: samples[0].tan.clone(), right: samples[0].right.clone(), up: samples[0].up.clone() },
    propPlacements: placeProps(rec, theme, samples, islandSegs)
  };

  track.query = (x, y, z) => queryTrack(track, x, y, z);
  track.atT = (t) => sampleAtT(samples, t);
  track.progressOf = (q) => {
    if (q && q.shortcut) return q.t;
    return q ? q.t : 0;
  };
  return track;
}

function placeProps(rec, theme, samples, islandSegs) {
  const list = [];
  const kinds = theme.props;
  let n = 0;
  for (const s of samples) {
    if (s.kind === 'gap' || s.kind === 'bridge') continue;
    n++;
    if (n % (3 + (rec.difficulty > 5 ? 2 : 0)) !== 0) continue;
    for (const side of [-1, 1]) {
      if (hash2(s.pos.x * side, s.pos.z) < 0.45) continue;
      const dist = s.roadHalf + 2.2 + hash2(s.pos.z, s.pos.x) * (s.islandHalf - s.roadHalf - 1.5);
      if (dist > s.islandHalf - 0.8) continue;
      const p = s.pos.clone().addScaledVector(s.right, side * dist);
      const kind = kinds[Math.floor(hash2(s.t, side) * kinds.length)];
      let scale = 2.4 + hash2(s.pos.x, n) * 2.8;
      if (kind === 'crystal') scale = 1.8 + hash2(s.pos.x, n) * 1.5;
      if (kind === 'floating_rock') scale = 1.5 + hash2(s.pos.x, n) * 1.8;
      list.push({ kind, pos: p, yaw: hash2(n, side) * Math.PI * 2, scale, islandY: s.pos.y });
    }
  }
  // Extra Hunyuan rocks hanging off lips, and crystals on neon/aurora islands
  let k = 0;
  for (const s of samples) {
    if (s.kind === 'gap' || s.kind === 'bridge') continue;
    k++;
    if (k % 7 !== 0) continue;
    if (theme.props.includes('floating_rock') && hash2(s.t, 9) > 0.4) {
      const side = hash2(s.pos.x, s.pos.z) > 0.5 ? 1 : -1;
      const p = s.pos.clone().addScaledVector(s.right, side * (s.islandHalf + 1.6 + hash2(s.t, 3) * 2.2));
      list.push({
        kind: 'floating_rock', pos: p, yaw: hash2(k, 2) * 6.28,
        scale: 1.4 + hash2(k, 4) * 2.0,
        islandY: s.pos.y - 2.4 - hash2(k, 5) * 3.5
      });
    }
    if (theme.props.includes('crystal') && hash2(s.t, 11) > 0.45) {
      const side = hash2(s.pos.z, s.pos.x) > 0.5 ? 1 : -1;
      const p = s.pos.clone().addScaledVector(s.right, side * (s.roadHalf + 2.0 + hash2(s.t, 7) * 1.8));
      if (Math.abs(side * (s.roadHalf + 2)) < s.islandHalf - 0.6) {
        list.push({
          kind: 'crystal', pos: p, yaw: hash2(k, 8) * 6.28,
          scale: 2.0 + hash2(k, 6) * 1.6,
          islandY: s.pos.y
        });
      }
    }
  }
  return list;
}

function sampleAtT(samples, t) {
  t = ((t % 1) + 1) % 1;
  const n = samples.length;
  const f = t * n;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const u = f - Math.floor(f);
  const a = samples[i], b = samples[j];
  return lerpSample(a, b, u, t);
}

function lerpSample(a, b, u, t) {
  const pos = a.pos.clone().lerp(b.pos, u);
  const tan = a.tan.clone().lerp(b.tan, u).normalize();
  const right = a.right.clone().lerp(b.right, u).normalize();
  const up = a.up.clone().lerp(b.up, u).normalize();
  return {
    t: t != null ? t : a.t,
    pos, tan, right, up,
    kind: u < 0.5 ? a.kind : b.kind,
    rampPitch: a.rampPitch * (1 - u) + b.rampPitch * u,
    boost: a.boost || b.boost,
    roadHalf: a.roadHalf * (1 - u) + b.roadHalf * u,
    islandHalf: a.islandHalf * (1 - u) + b.islandHalf * u,
    grip: a.grip * (1 - u) + b.grip * u,
    shortcut: a.kind === 'shortcut' || b.kind === 'shortcut',
    tMain: a.tMain != null ? a.tMain * (1 - u) + (b.tMain || a.tMain) * u : undefined,
    scU: a.scU != null ? a.scU * (1 - u) + (b.scU || 0) * u : undefined
  };
}

function queryTrack(track, x, y, z) {
  const { grid, cell, key, samples, scSamples } = track;
  const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  let bestM = null, bestMD = 1e9, bestS = null, bestSD = 1e9;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const bucket = grid.get(key(ix + dx, iz + dz));
    if (!bucket) continue;
    for (const ref of bucket) {
      const arr0 = ref.type === 'sc' ? scSamples : samples;
      const s = arr0[ref.i];
      const dx_ = x - s.pos.x, dz_ = z - s.pos.z;
      const d = dx_ * dx_ + dz_ * dz_;
      if (ref.type === 'sc') { if (d < bestSD) { bestSD = d; bestS = s; } }
      else { if (d < bestMD) { bestMD = d; bestM = s; } }
    }
  }
  // Distances were stored squared — compare real metres, and never
  // steal the query onto a shortcut while the car is still on the main island.
  const distM = bestM ? Math.sqrt(bestMD) : 1e9;
  const distS = bestS ? Math.sqrt(bestSD) : 1e9;
  const mainOn = !!(bestM && distM <= (bestM.islandHalf || 0) + 0.8);
  const scOn = !!(bestS && distS <= (bestS.islandHalf || 0) + 0.8);
  let best, arr;
  if (scOn && !mainOn) { best = bestS; arr = scSamples; }
  else if (scOn && mainOn && distS + 1.6 < distM) { best = bestS; arr = scSamples; }
  else { best = bestM; arr = samples; }
  if (!best) {
    return { valid: false, t: 0, onRoad: false, onIsland: false, inGap: true, height: -999, lateral: 99, dist: 99 };
  }
  // refine with neighbors
  const i = arr.indexOf(best);
  const prev = arr[(i - 1 + arr.length) % arr.length];
  const next = arr[(i + 1) % arr.length];
  let a = best, b = next, u = 0;
  // project onto segment a-b or prev-a
  const trySeg = (p, q) => {
    const vx = q.pos.x - p.pos.x, vz = q.pos.z - p.pos.z;
    const L2 = vx * vx + vz * vz || 1;
    const uu = Math.max(0, Math.min(1, ((x - p.pos.x) * vx + (z - p.pos.z) * vz) / L2));
    const px = p.pos.x + vx * uu, pz = p.pos.z + vz * uu;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    return { d, p, q, uu };
  };
  const s1 = trySeg(best, next);
  const s2 = trySeg(prev, best);
  const pick = s1.d < s2.d ? s1 : s2;
  const samp = lerpSample(pick.p, pick.q, pick.uu);
  const lx = x - samp.pos.x, lz = z - samp.pos.z;
  const lateral = lx * samp.right.x + lz * samp.right.z;
  const along = lx * samp.tan.x + lz * samp.tan.z;
  const dist = Math.sqrt(pick.d);
  const absLat = Math.abs(lateral);
  let kind = samp.kind;
  if (!samp.shortcut && track.rec) {
    const cls = classifyT(track.rec, samp.t);
    kind = cls.kind;
    if (cls.rampT != null) samp.rampPitch = 0.12 + cls.rampT * 0.16;
  }
  const inGap = kind === 'gap';
  const roadHalf = inGap ? (samp.roadHalf || 0) : samp.roadHalf;
  const islandHalf = inGap ? 0 : (samp.islandHalf || (samp.roadHalf + 4));
  const onRoad = !inGap && absLat <= roadHalf + 0.45;
  const onIsland = !inGap && absLat <= islandHalf + 0.55;
  let t = samp.t;
  if (samp.shortcut) t = samp.tMain;
  const height = samp.pos.y;
  return {
    valid: true, t, pos: samp.pos, tan: samp.tan, right: samp.right, up: samp.up,
    lateral, absLat, along, dist, height,
    roadHalf, islandHalf, grip: samp.grip,
    kind, rampPitch: samp.rampPitch, boost: samp.boost && onRoad,
    onRoad, onIsland, inGap, shortcut: !!samp.shortcut, scU: samp.scU
  };
}

export function bakeMinimap(track, size = 160) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(5,12,20,0.0)';
  ctx.clearRect(0, 0, size, size);
  const pad = 12;
  const w = track.maxX - track.minX, h = track.maxZ - track.minZ;
  const sc = (size - pad * 2) / Math.max(w, h);
  const ox = (size - w * sc) / 2, oz = (size - h * sc) / 2;
  const px = (x) => ox + (x - track.minX) * sc;
  const pz = (z) => oz + (z - track.minZ) * sc;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // islands
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 10;
  ctx.beginPath();
  let started = false;
  for (const s of track.samples) {
    if (s.kind === 'gap') { if (started) { ctx.stroke(); started = false; ctx.beginPath(); } continue; }
    if (!started) { ctx.moveTo(px(s.pos.x), pz(s.pos.z)); started = true; }
    else ctx.lineTo(px(s.pos.x), pz(s.pos.z));
  }
  ctx.closePath(); ctx.stroke();
  // road
  ctx.strokeStyle = '#ffc526';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); started = false;
  for (const s of track.samples) {
    if (s.kind === 'gap') { if (started) { ctx.stroke(); started = false; ctx.beginPath(); } continue; }
    if (!started) { ctx.moveTo(px(s.pos.x), pz(s.pos.z)); started = true; }
    else ctx.lineTo(px(s.pos.x), pz(s.pos.z));
  }
  ctx.closePath(); ctx.stroke();
  if (track.scSamples && track.scSamples.length) {
    ctx.strokeStyle = '#2ee6ff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    track.scSamples.forEach((s, i) => i ? ctx.lineTo(px(s.pos.x), pz(s.pos.z)) : ctx.moveTo(px(s.pos.x), pz(s.pos.z)));
    ctx.stroke();
  }
  track._mini = { canvas: cv, px, pz, sc, ox, oz };
  return cv;
}

export function themeOf(id) {
  const r = RECIPES.find(t => t.id === id);
  return r ? THEMES[r.theme] : THEMES.grass;
}

export { THEMES, RECIPES };
