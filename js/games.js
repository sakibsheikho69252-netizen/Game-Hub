/* ============================================================
   Game Hub — games.js
   Loads + validates games.json. One broken entry never
   takes down the whole library.
   ============================================================ */
(function (global) {
  'use strict';

  var FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

  function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : ''; }

  function normalizeGame(raw, index) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'Entry #' + index + ' is not an object.' };
    }

    var id     = str(raw.id);
    var title  = str(raw.title);
    var folder = str(raw.folder);

    var missing = [];
    if (!id)     missing.push('id');
    if (!title)  missing.push('title');
    if (!folder) missing.push('folder');
    if (missing.length) {
      return { error: 'Entry #' + index + ' is missing required field(s): ' + missing.join(', ') };
    }

    if (!FOLDER_RE.test(folder)) {
      return { error: 'Entry "' + id + '" has an unsafe folder name: "' + folder + '"' };
    }

    var tags = Array.isArray(raw.tags)
      ? raw.tags.filter(function (t) { return typeof t === 'string' && t.trim(); })
                .map(function (t) { return t.trim(); })
      : [];

    return {
      game: {
        id: id,
        title: title,
        folder: folder,
        description: str(raw.description),
        category:    str(raw.category) || 'Other',
        tags:        tags,
        icon:        str(raw.icon) || '🎮',
        thumbnail:   str(raw.thumbnail),
        screenshot:  str(raw.screenshot),
        difficulty:  str(raw.difficulty),
        version:     str(raw.version),
        releaseDate: str(raw.releaseDate),
        author:      str(raw.author),
        controls:    str(raw.controls),
        orientation: str(raw.orientation),
        featured: raw.featured === true,
        isNew:    raw['new'] === true,
        url: 'games/' + folder + '/index.html'
      }
    };
  }

  function parseCatalog(data) {
    var list = Array.isArray(data) ? data
             : (data && Array.isArray(data.games)) ? data.games
             : null;

    if (!list) {
      return {
        games: [],
        errors: ['games.json must be an array, or an object with a "games" array.']
      };
    }

    var games = [];
    var errors = [];
    var seen = Object.create(null);

    list.forEach(function (raw, i) {
      var res = normalizeGame(raw, i);
      if (res.error) { errors.push(res.error); return; }
      if (seen[res.game.id]) {
        errors.push('Duplicate game id skipped: "' + res.game.id + '"');
        return;
      }
      seen[res.game.id] = true;
      games.push(res.game);
    });

    return { games: games, errors: errors };
  }

  function loadCatalog() {
    return fetch('games.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('games.json returned HTTP ' + res.status + '.');
        }
        return res.text();
      })
      .then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('games.json contains invalid JSON. Check for a trailing comma or missing quote.');
        }
        var parsed = parseCatalog(data);
        parsed.errors.forEach(function (msg) {
          console.warn('[GameHub] ' + msg);
        });
        return parsed;
      });
  }

  global.GHGames = {
    loadCatalog: loadCatalog,
    parseCatalog: parseCatalog,
    normalizeGame: normalizeGame,
    isValidFolder: function (f) { return FOLDER_RE.test(f); }
  };
})(window);
