/* ============================================================
   Game Hub — storage.js
   Namespaced, crash-safe localStorage wrapper.
   All keys live under the "gamehub:" prefix.
   ============================================================ */
(function (global) {
  'use strict';

  var PREFIX = 'gamehub:';

  var KEYS = {
    favorites: PREFIX + 'favorites',
    recent:    PREFIX + 'recent',
    plays:     PREFIX + 'plays',
    theme:     PREFIX + 'theme',
    settings:  PREFIX + 'settings'
  };

  var MAX_RECENT = 12;

  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      console.warn('[GameHub] Corrupted localStorage value — resetting.', e);
      return fallback;
    }
  }

  function read(key, fallback) {
    try { return safeParse(global.localStorage.getItem(key), fallback); }
    catch (e) { return fallback; }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[GameHub] Could not write to localStorage.', e);
      return false;
    }
  }

  function remove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* noop */ }
  }

  /* ---------- favorites ---------- */

  function getFavorites() {
    var v = read(KEYS.favorites, []);
    if (!Array.isArray(v)) return [];
    return v.filter(function (x) { return typeof x === 'string'; });
  }

  function isFavorite(id) {
    return getFavorites().indexOf(id) !== -1;
  }

  function toggleFavorite(id) {
    var f = getFavorites();
    var i = f.indexOf(id);
    if (i === -1) f.unshift(id); else f.splice(i, 1);
    write(KEYS.favorites, f);
    return i === -1;
  }

  function clearFavorites() { remove(KEYS.favorites); }

  /* ---------- recently played ---------- */

  function getRecent() {
    var v = read(KEYS.recent, []);
    if (!Array.isArray(v)) return [];
    return v.filter(function (x) {
      return x && typeof x.id === 'string' && typeof x.ts === 'number';
    });
  }

  function addRecent(id) {
    var list = getRecent().filter(function (x) { return x.id !== id; });
    list.unshift({ id: id, ts: Date.now() });
    write(KEYS.recent, list.slice(0, MAX_RECENT));
  }

  function clearRecent() { remove(KEYS.recent); }

  /* ---------- play counts ---------- */

  function getPlays() {
    var v = read(KEYS.plays, {});
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    var out = {};
    Object.keys(v).forEach(function (k) {
      var n = Number(v[k]);
      if (isFinite(n) && n > 0) out[k] = Math.floor(n);
    });
    return out;
  }

  function getPlayCount(id) { return getPlays()[id] || 0; }

  function incrementPlay(id) {
    var p = getPlays();
    p[id] = (p[id] || 0) + 1;
    write(KEYS.plays, p);
    return p[id];
  }

  function clearPlays() { remove(KEYS.plays); }

  /* ---------- theme ---------- */

  function getTheme() {
    var t = read(KEYS.theme, 'dark');
    return (t === 'light' || t === 'dark' || t === 'system') ? t : 'dark';
  }

  function setTheme(t) {
    if (t === 'light' || t === 'dark' || t === 'system') write(KEYS.theme, t);
  }

  /* ---------- settings ---------- */

  function getSettings() {
    var v = read(KEYS.settings, {});
    if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
    return {
      reduceMotion: !!v.reduceMotion,
      compactCards: !!v.compactCards
    };
  }

  function setSettings(s) {
    write(KEYS.settings, {
      reduceMotion: !!(s && s.reduceMotion),
      compactCards: !!(s && s.compactCards)
    });
  }

  /* ---------- bulk ---------- */

  function resetAll() {
    try {
      var toRemove = [];
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { global.localStorage.removeItem(k); });
    } catch (e) { /* noop */ }
  }

  function usageBytes() {
    var total = 0;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        var v = global.localStorage.getItem(k) || '';
        total += (k.length + v.length) * 2;
      }
    } catch (e) { /* noop */ }
    return total;
  }

  function bestKey(gameId) { return PREFIX + 'best:' + gameId; }

  global.GHStorage = {
    PREFIX: PREFIX,
    KEYS: KEYS,
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    clearFavorites: clearFavorites,
    getRecent: getRecent,
    addRecent: addRecent,
    clearRecent: clearRecent,
    getPlays: getPlays,
    getPlayCount: getPlayCount,
    incrementPlay: incrementPlay,
    clearPlays: clearPlays,
    getTheme: getTheme,
    setTheme: setTheme,
    getSettings: getSettings,
    setSettings: setSettings,
    resetAll: resetAll,
    usageBytes: usageBytes,
    bestKey: bestKey
  };
})(window);
