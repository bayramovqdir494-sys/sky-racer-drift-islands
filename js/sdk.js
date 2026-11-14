// CrazyGames SDK v3 wrapper. Safe no-op when the script is missing, blocked,
// or reports environment 'disabled' (GitHub Pages, local files).
const S = () => (window.CrazyGames && window.CrazyGames.SDK) || null;
let ready = false, env = 'none', playing = false, adBusy = false, adblock = false, adFails = 0;
function call(fn) { if (!ready) return; try { fn(S()); } catch (e) { console.warn('[sdk]', e && e.message || e); } }
export const sdk = {
  get env() { return env; },
  get active() { return ready; },
  get adBusy() { return adBusy; },
  get adsOk() {
    const s = S();
    return ready && !adblock && adFails < 2 && !!(s && s.ad && typeof s.ad.requestAd === 'function') && (env === 'crazygames' || env === 'local');
  },
  async init(timeoutMs = 5000) {
    const s = S(); if (!s || typeof s.init !== 'function') return false;
    try {
      await Promise.race([s.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('sdk init timeout')), timeoutMs))]);
      env = s.environment || 'unknown'; ready = env !== 'disabled';
      if (ready && s.ad && typeof s.ad.hasAdblock === 'function') {
        try { adblock = !!(await Promise.race([s.ad.hasAdblock(), new Promise(r => setTimeout(() => r(false), 2500))])); }
        catch (e) { adblock = false; }
      }
    } catch (e) {
      console.warn('[sdk] init failed, running without SDK:', e && e.message || e);
      ready = false;
    }
    return ready;
  },
  loadingStart() { call(s => s.game.loadingStart()); },
  loadingStop() { call(s => s.game.loadingStop()); },
  setPlaying(on) {
    on = !!on && !adBusy;
    if (on === playing) return;
    playing = on;
    call(s => on ? s.game.gameplayStart() : s.game.gameplayStop());
  },
  happytime() { call(s => s.game.happytime()); },
  storage() {
    const ls = {
      getItem: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } }
    };
    if (!ready || env !== 'crazygames') return ls;
    const d = S().data; if (!d) return ls;
    return {
      getItem: k => { try { return d.getItem(k); } catch (e) { return ls.getItem(k); } },
      setItem: (k, v) => { try { d.setItem(k, v); } catch (e) { ls.setItem(k, v); } }
    };
  },
  requestAd(type, hooks = {}) {
    return new Promise(res => {
      const resolve = ok => { if (!ok && type === 'rewarded') adFails++; else if (ok) adFails = 0; res(ok); };
      if (!ready || adBusy || adblock) { resolve(false); return; }
      const s = S(); if (!s || !s.ad) { resolve(false); return; }
      adBusy = true; let started = false, done = false;
      if (playing) { playing = false; call(x => x.game.gameplayStop()); }
      const end = ok => { if (done) return; done = true; adBusy = false; if (started && hooks.resume) try { hooks.resume(); } catch (e) { } resolve(ok); };
      hooks.block && hooks.block(true);
      const fin = ok => { hooks.block && hooks.block(false); end(ok); };
      try {
        s.ad.requestAd(type, {
          adStarted: () => { started = true; hooks.pause && hooks.pause(); },
          adFinished: () => fin(true),
          adError: () => fin(false)
        });
      } catch (e) { fin(false); }
      setTimeout(() => { if (!done && !started) fin(false); }, 2000);
    });
  }
};
window.__sdk = sdk;
