import { CARS, COLORS, UPGRADE_COST, UPGRADE_MAX, DAILY_REWARDS, starForPlace, prizeForPlace, dailyChallengeFor, WORLDS, worldOf, worldUnlocked } from './data.js';
import { getSave, persist, mutate, addCoins, ensureCarUp, rolloverDaily } from './save.js';
import { totalStars, getRecipes } from './tracks.js';
import { applyUpgrades } from './data.js';

const $ = (id) => document.getElementById(id);

export function show(id) {
  document.querySelectorAll('.scr, .sheet').forEach(el => el.classList.remove('on'));
  const el = $(id); if (el) el.classList.add('on');
}
export function showSheet(id) { $(id).classList.add('on'); refreshAll(); }
export function hideSheet(id) { $(id).classList.remove('on'); }

export function refreshWallet() {
  const s = getSave();
  const w = $('wallet');
  if (w) w.innerHTML = 'COINS <b>' + s.coins + '</b>';
}

export function refreshHome(trackId) {
  const s = getSave();
  const rec = getRecipes().find(t => t.id === (trackId || s.lastTrack)) || getRecipes()[0];
  const car = CARS.find(c => c.id === s.car);
  $('homeSel').textContent = `${rec.name.toUpperCase()}  •  ${car.name.toUpperCase()}`;
  refreshWallet();
  $('btnAudio').textContent = s.settings.audio ? '♪' : '🔇';
}

export function renderTracks(onPick, onTrial, onChamp) {
  const s = getSave();
  const stars = totalStars(s.tracks);
  const box = $('trackGrid');
  box.innerHTML = '';
  let lastWorld = null;
  for (const rec of getRecipes()) {
    const world = worldOf(rec.id);
    if (world && world.id !== lastWorld) {
      lastWorld = world.id;
      const h = document.createElement('div');
      h.className = 'world-head';
      const beaten = s.champs && s.champs[world.id];
      h.textContent = world.name + (beaten ? '  •  Champion beaten' : '');
      box.appendChild(h);
    }
    const st = s.tracks[rec.id] || { stars: 0, bestTime: 0, plays: 0 };
    const ghost = s.ghosts && s.ghosts[rec.id];
    const locked = stars < rec.unlockStars;
    const wrap = document.createElement('div');
    wrap.className = 'tile-wrap';
    const t = document.createElement('button');
    t.className = 'tile' + (s.lastTrack === rec.id ? ' sel' : '');
    t.innerHTML = `<h4>${rec.name}</h4>
      <div class="stars">${'★'.repeat(st.stars)}${'☆'.repeat(3 - (st.stars || 0))}</div>
      <div class="dim">Difficulty ${'●'.repeat(rec.difficulty)}${'○'.repeat(8 - rec.difficulty)}</div>
      <div class="dim">${st.bestTime ? 'Best ' + fmtTime(st.bestTime) : 'No run yet'}${ghost ? '  •  Ghost ' + fmtTime(ghost.time) : ''}</div>
      ${locked ? `<div class="lock">Need ${rec.unlockStars} stars<br/>(you have ${stars})</div>` : ''}`;
    if (!locked) t.onclick = () => onPick(rec.id);
    wrap.appendChild(t);
    if (!locked) {
      const row = document.createElement('div');
      row.className = 'tile-acts';
      const bT = document.createElement('button');
      bT.className = 'btn sec';
      bT.textContent = 'TIME TRIAL';
      bT.onclick = (e) => { e.stopPropagation(); onTrial && onTrial(rec.id); };
      row.appendChild(bT);
      if (world && rec.id === world.champTrack) {
        const open = worldUnlocked(s, world);
        const bC = document.createElement('button');
        bC.className = 'btn champ';
        const beaten = s.champs && s.champs[world.id];
        bC.textContent = !open ? 'BEAT BOTH TRACKS' : (beaten ? 'REMATCH CHAMP' : 'CHAMPION');
        bC.disabled = !open;
        if (!open) bC.classList.add('dis');
        bC.onclick = (e) => { e.stopPropagation(); if (open && onChamp) onChamp(rec.id, world); };
        row.appendChild(bC);
      }
      wrap.appendChild(row);
    }
    box.appendChild(wrap);
  }
}

export function setModeTag(text) {
  const el = $('modeTag');
  if (!el) return;
  if (text) { el.textContent = text; el.classList.add('on'); }
  else { el.textContent = ''; el.classList.remove('on'); }
}

export function setWrongWay(on) {
  const el = $('wrongWay');
  if (!el) return;
  el.classList.toggle('on', !!on);
}

export function renderGarage(onChange) {
  const s = getSave();
  const box = $('carGrid');
  box.innerHTML = '';
  for (const c of CARS) {
    const owned = s.unlockedCars.includes(c.id);
    const sel = s.car === c.id;
    const up = ensureCarUp(c.id);
    const t = document.createElement('button');
    t.className = 'tile' + (sel ? ' sel' : '');
    t.innerHTML = `<h4>${c.name}</h4>
      <div class="dim">${c.desc}</div>
      <div class="dim">SPD ${stat(c.top)}  HND ${stat(c.handling*20)}  NIT ${stat(c.nitro*20)}</div>
      <div class="pips">${pips(up.speed)}</div><div class="dim">Upgrades in the row below</div>
      ${owned ? `<div class="chip">${sel ? 'SELECTED' : 'OWNED'}</div>` : `<div class="cost">${c.price} coins</div>`}
      ${!owned && s.coins < c.price ? '<div class="lock">Not enough coins</div>' : ''}`;
    t.onclick = () => {
      if (!owned) {
        if (s.coins < c.price) return;
        mutate(d => { d.coins -= c.price; d.unlockedCars.push(c.id); d.car = c.id; });
      } else mutate(d => { d.car = c.id; });
      onChange && onChange();
      renderGarage(onChange);
      refreshWallet();
    };
    box.appendChild(t);
  }
  const upBox = $('upgradeRow');
  upBox.innerHTML = '';
  const up = ensureCarUp(s.car);
  for (const k of ['speed', 'handling', 'nitro']) {
    const lv = up[k] || 0;
    const cost = lv >= UPGRADE_MAX ? 0 : UPGRADE_COST[lv];
    const b = document.createElement('button');
    b.className = 'btn sec';
    b.textContent = `${k.toUpperCase()} ${lv}/${UPGRADE_MAX}` + (lv >= UPGRADE_MAX ? '' : `  •  ${cost}`);
    b.onclick = () => {
      if (lv >= UPGRADE_MAX) return;
      if (getSave().coins < cost) return;
      mutate(d => { d.coins -= cost; ensureCarUp(d.car)[k] = lv + 1; });
      renderGarage(onChange); refreshWallet(); onChange && onChange();
    };
    upBox.appendChild(b);
  }
  const colBox = $('colorRow');
  colBox.innerHTML = '';
  for (const c of COLORS) {
    const owned = s.unlockedColors.includes(c.id);
    const b = document.createElement('button');
    b.className = 'ibtn';
    b.style.background = '#' + c.hex.toString(16).padStart(6, '0');
    b.style.outline = s.color === c.id ? '3px solid #ffc526' : '2px solid #2a3c55';
    b.title = c.name + (owned ? '' : ` (${c.cost})`);
    b.onclick = () => {
      if (!owned) {
        if (c.cost > getSave().coins) return;
        mutate(d => { d.coins -= c.cost; d.unlockedColors.push(c.id); d.color = c.id; });
      } else mutate(d => { d.color = c.id; });
      renderGarage(onChange); refreshWallet(); onChange && onChange();
    };
    colBox.appendChild(b);
  }
}

function pips(n) { n=n||0; let s=''; for (let i=0;i<5;i++) s += '<i class="'+(i<n?'on':'')+'"></i>'; return s; }
function stat(v) { return Math.round(v); }

// redo pips properly in render - I used a broken helper. Fix renderGarage pips below if needed.

export function renderDaily(onChallenge) {
  const s = getSave();
  rolloverDaily(s);
  if (!s.daily.challenge) {
    s.daily.challenge = dailyChallengeFor(s.daily.day, getRecipes().length);
    persist();
  }
  $('streakLbl').textContent = `Streak ${s.daily.streak} day${s.daily.streak===1?'':'s'}`;
  const g = $('dayGrid');
  g.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('div');
    const claimedToday = s.daily.claimed;
    const done = s.daily.streak > i || (claimedToday && i < s.daily.streak);
    const cur = i === (claimedToday ? s.daily.streak - 1 : s.daily.streak);
    d.className = 'day' + (cur ? ' cur' : '') + (done && !cur ? ' done' : '');
    d.innerHTML = `<s style="text-decoration:none">DAY ${i+1}</s><b>${DAILY_REWARDS[i]}</b>`;
    g.appendChild(d);
  }
  const claim = $('btnClaim');
  claim.disabled = s.daily.claimed;
  claim.className = 'btn' + (s.daily.claimed ? ' dis' : '');
  claim.textContent = s.daily.claimed ? 'Claimed today' : `Claim today's gift (${DAILY_REWARDS[Math.min(6, s.daily.streak)]})`;
  claim.onclick = () => {
    if (getSave().daily.claimed) return;
    mutate(d => {
      const idx = Math.min(6, d.daily.streak);
      d.coins += DAILY_REWARDS[idx];
      d.daily.streak = idx + 1;
      d.daily.claimed = true;
    });
    renderDaily(onChallenge); refreshWallet();
  };
  const recs = getRecipes();
  const ch = s.daily.challenge;
  const tr = recs[ch.trackIndex] || recs[0];
  const goal = ch.mode === 0 ? 'Finish 1st' : ch.mode === 1 ? 'Finish top 3' : 'Beat the par time';
  const box = $('challengeBox');
  box.innerHTML = `<div style="flex:1"><b>${tr.name}</b> — ${goal}<div class="dim">${ch.done ? 'Complete!' : 'Reward ' + ch.reward + ' coins'}</div></div>
    <button class="btn ${ch.done && !ch.claimed ? '' : 'sec'}" id="chBtn">${ch.done && !ch.claimed ? 'CLAIM' : ch.claimed ? 'DONE' : 'RACE'}</button>`;
  $('chBtn').onclick = () => {
    const d = getSave();
    if (d.daily.challenge.done && !d.daily.challenge.claimed) {
      mutate(x => { x.coins += x.daily.challenge.reward; x.daily.challenge.claimed = true; });
      renderDaily(onChallenge); refreshWallet();
      return;
    }
    if (!d.daily.challenge.claimed) onChallenge && onChallenge(tr.id, d.daily.challenge);
  };
  const list = $('missionList');
  list.innerHTML = '';
  s.daily.missions.forEach((m, i) => {
    const pct = Math.min(1, (m.progress || 0) / m.need) * 100;
    const el = document.createElement('div');
    el.className = 'mis';
    el.innerHTML = `<div style="flex:1"><b>${m.text}</b>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="dim">${Math.min(m.need, m.progress||0)} / ${m.need}  •  ${m.reward} coins</div></div>
      <button class="btn ${m.progress>=m.need && !m.claimed ? '' : 'sec dis'}" data-i="${i}">${m.claimed ? 'DONE' : 'CLAIM'}</button>`;
    const btn = el.querySelector('button');
    if (m.progress >= m.need && !m.claimed) {
      btn.classList.remove('dis');
      btn.onclick = () => {
        mutate(d => { const mm = d.daily.missions[i]; if (mm.progress >= mm.need && !mm.claimed) { d.coins += mm.reward; mm.claimed = true; } });
        renderDaily(onChallenge); refreshWallet();
      };
    }
    list.appendChild(el);
  });
}

export function addMissionProgress(key, amount = 1) {
  const s = getSave();
  if (!s.daily || !s.daily.missions) return;
  let changed = false;
  for (const m of s.daily.missions) {
    if (m.claimed) continue;
    if (m.key === key) {
      m.progress = Math.min(m.need, (m.progress || 0) + amount);
      changed = true;
    }
  }
  if (changed) persist();
}

export function setMissionValue(key, value) {
  const s = getSave();
  if (!s.daily || !s.daily.missions) return;
  let changed = false;
  for (const m of s.daily.missions) {
    if (m.claimed) continue;
    if (m.key === key) {
      const v = Math.min(m.need, value);
      if (v !== m.progress) { m.progress = v; changed = true; }
    }
  }
  if (changed) persist();
}

export function fmtTime(t) {
  if (t == null || t < 0) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m + ':' + s.toFixed(2).padStart(5, '0');
}

export function updateHud(racer, nRacers) {
  $('posPill').querySelector('b').textContent = 'P' + (racer.place || 1);
  $('lapPill').querySelector('b').textContent = Math.min(racer.lap, racer.lapsTotal) + '/' + racer.lapsTotal;
  $('timePill').querySelector('b').textContent = fmtTime(racer.time + racer.penalty);
  $('nitroFill').style.width = Math.round(clamp01(racer.nitro) * 100) + '%';
  $('spd').textContent = Math.round(Math.max(0, racer.speed) * 4.2);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function drawMini(track, racers, player) {
  const cv = $('mini');
  if (!cv || !track._mini) return;
  const ctx = cv.getContext('2d');
  const { canvas, px, pz } = track._mini;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.beginPath(); ctx.arc(cv.width/2, cv.height/2, cv.width/2 - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#071018ee'; ctx.fillRect(0, 0, cv.width, cv.height);
  // rotate so player heads up
  ctx.translate(cv.width/2, cv.height/2);
  ctx.rotate(-player.yaw);
  ctx.translate(-px(player.pos.x), -pz(player.pos.z));
  ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
  for (const r of racers) {
    ctx.fillStyle = r.isPlayer ? '#ffc526' : '#2ee6ff';
    const x = px(r.pos.x), z = pz(r.pos.z);
    ctx.beginPath();
    ctx.arc(x, z, r.isPlayer ? 5 : 3.5, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function hint(text, ms = 2200) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('on');
  clearTimeout(hint._t);
  hint._t = setTimeout(() => h.classList.remove('on'), ms);
}

export function toast(text, ms = 1400) {
  const h = $('toast');
  h.textContent = text;
  h.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => h.classList.remove('on'), ms);
}

export function countdown(n) {
  const el = $('cd');
  if (!n) { el.style.opacity = 0; el.textContent = ''; return; }
  el.textContent = n === 'GO' ? 'GO' : String(n);
  el.style.opacity = 1;
}

export function showResult({ place, stars, time, coins, adsOk }) {
  show('result');
  $('result').classList.add('on');
  $('rPlace').textContent = place ? ('P' + place) : 'DNF';
  $('rStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('rTime').textContent = fmtTime(time);
  $('rCoins').textContent = '+' + coins + ' coins';
  $('btnDouble').style.display = adsOk ? '' : 'none';
  $('btnDouble').classList.remove('dis');
}

export function bindInput(state) {
  const inp = state;
  const down = (k, v) => (e) => { e && e.preventDefault(); inp[k] = v; e && e.currentTarget && e.currentTarget.classList.toggle('on', v); };
  const map = [
    ['btnL', 'left'], ['btnR', 'right'], ['btnGas', 'gas'], ['btnBrake', 'brake'],
    ['btnDrift', 'drift'], ['btnNitro', 'nitro']
  ];
  for (const [id, k] of map) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); down(k, 1)(e); });
    el.addEventListener('pointerup', down(k, 0));
    el.addEventListener('pointercancel', down(k, 0));
    el.addEventListener('pointerleave', (e) => { if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) down(k, 0)(e); });
  }
  const keys = {};
  const applyKeys = () => {
    inp.left = keys.ArrowLeft || keys.KeyA || keys.leftTouch || 0;
    inp.right = keys.ArrowRight || keys.KeyD || keys.rightTouch || 0;
    inp.gas = keys.ArrowUp || keys.KeyW || keys.gasTouch || 0;
    inp.brake = keys.ArrowDown || keys.KeyS || keys.brakeTouch || 0;
    inp.drift = keys.Space || keys.driftTouch || 0;
    inp.nitro = keys.ShiftLeft || keys.ShiftRight || keys.nitroTouch || 0;
    $('btnL').classList.toggle('on', !!inp.left);
    $('btnR').classList.toggle('on', !!inp.right);
    $('btnGas').classList.toggle('on', !!inp.gas);
    $('btnBrake').classList.toggle('on', !!inp.brake);
    $('btnDrift').classList.toggle('on', !!inp.drift);
    $('btnNitro').classList.toggle('on', !!inp.nitro);
  };
  // pointer flags go to *Touch then we also set inp directly; sync both
  const orig = {};
  for (const [id, k] of map) {
    // already set inp[k] — also mirror
  }
  window.addEventListener('keydown', ev => {
    keys[ev.code] = 1;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(ev.code)) ev.preventDefault();
    applyKeys();
  }, { passive: false });
  window.addEventListener('keyup', ev => { keys[ev.code] = 0; applyKeys(); });
  // merge: getInput reads buttons OR keys
  state._keys = keys;
  state.read = () => {
    const left = inp.left || keys.ArrowLeft || keys.KeyA;
    const right = inp.right || keys.ArrowRight || keys.KeyD;
    return {
      // Chase cam looks along heading (sin yaw, 0, cos yaw). Positive yaw turns
      // toward +X, which is screen-left from that view, so player right must be -steer.
      // AI computes steer from world yaw error and must keep the unflipped sign.
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      gas: inp.gas || keys.ArrowUp || keys.KeyW ? 1 : 0,
      brake: inp.brake || keys.ArrowDown || keys.KeyS ? 1 : 0,
      drift: inp.drift || keys.Space ? 1 : 0,
      nitro: inp.nitro || keys.ShiftLeft || keys.ShiftRight ? 1 : 0
    };
  };
  return state;
}

export function refreshAll() {
  refreshWallet();
}

export { $ };
