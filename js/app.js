/* ============================================================
   Game Hub — app.js
   Application state, filtering, sorting, rendering, events.
   ============================================================ */
(function () {
  'use strict';

  var S  = window.GHStorage;
  var G  = window.GHGames;
  var UI = window.GHUI;

  var PAGE_SIZE = 60;

  var state = {
    games:    [],
    byId:     Object.create(null),
    filtered: [],
    visible:  PAGE_SIZE,
    query:      '',
    category:   'All',
    difficulty: 'All',
    toggles:    { 'new': false, featured: false, favorites: false },
    sort:       'featured',
    loadError: null
  };

  var els = {};

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function cssEscape(str) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(str);
    }
    return String(str).replace(/["\\]/g, '\\$&');
  }

  /* ============================================================
     Theme
     ============================================================ */

  var mqlDark = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function applyTheme() {
    var pref = S.getTheme();
    var effective = pref;
    if (pref === 'system') {
      effective = (mqlDark && mqlDark.matches) ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effective);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'light' ? '#f4f5fa' : '#0b0e14');

    if (els.themeToggle) {
      els.themeToggle.textContent = effective === 'light' ? '☀️' : '🌙';
      els.themeToggle.setAttribute('aria-label',
        'Switch to ' + (effective === 'light' ? 'dark' : 'light') + ' theme');
    }
    if (els.settingTheme) els.settingTheme.value = pref;
  }

  function cycleTheme() {
    var current = S.getTheme();
    var effective = current === 'system'
      ? ((mqlDark && mqlDark.matches) ? 'dark' : 'light')
      : current;
    var next = effective === 'dark' ? 'light' : 'dark';
    S.setTheme(next);
    applyTheme();
    UI.toast('Theme: ' + next, 'info');
  }

  if (mqlDark) {
    var onSchemeChange = function () { if (S.getTheme() === 'system') applyTheme(); };
    if (mqlDark.addEventListener) mqlDark.addEventListener('change', onSchemeChange);
    else if (mqlDark.addListener) mqlDark.addListener(onSchemeChange);

    window.addEventListener('beforeunload', function () {
      if (mqlDark.removeEventListener) mqlDark.removeEventListener('change', onSchemeChange);
      else if (mqlDark.removeListener) mqlDark.removeListener(onSchemeChange);
    });
  }

  /* ============================================================
     Settings
     ============================================================ */

  function applySettings() {
    var s = S.getSettings();
    document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
    document.documentElement.classList.toggle('compact-cards', s.compactCards);
    if (els.settingMotion)  els.settingMotion.checked  = s.reduceMotion;
    if (els.settingCompact) els.settingCompact.checked = s.compactCards;
    updateStorageNote();
  }

  function updateStorageNote() {
    if (!els.storageNote) return;
    var bytes  = S.usageBytes();
    var favs   = S.getFavorites().length;
    var recent = S.getRecent().length;
    var plays  = Object.keys(S.getPlays()).length;

    els.storageNote.textContent =
      'Using \~' + (bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB') +
      ' · ' + favs + ' favorite' + (favs === 1 ? '' : 's') +
      ' · ' + recent + ' recent' +
      ' · play counts for ' + plays + ' game' + (plays === 1 ? '' : 's') +
      '. Stored only in this browser.';
  }

  /* ============================================================
     Category chips + difficulty options
     ============================================================ */

  function buildCategoryChips() {
    UI.clear(els.categories);

    var counts = Object.create(null);
    state.games.forEach(function (g) {
      counts[g.category] = (counts[g.category] || 0) + 1;
    });

    var cats = Object.keys(counts).sort(function (a, b) {
      return a.localeCompare(b);
    });

    var all = UI.el('button', 'chip' + (state.category === 'All' ? ' is-active' : ''));
    all.type = 'button';
    all.setAttribute('data-category', 'All');
    all.setAttribute('aria-pressed', state.category === 'All' ? 'true' : 'false');
    all.textContent = 'All (' + state.games.length + ')';
    els.categories.appendChild(all);

    cats.forEach(function (cat) {
      var chip = UI.el('button', 'chip' + (state.category === cat ? ' is-active' : ''));
      chip.type = 'button';
      chip.setAttribute('data-category', cat);
      chip.setAttribute('aria-pressed', state.category === cat ? 'true' : 'false');
      chip.textContent = cat + ' (' + counts[cat] + ')';
      els.categories.appendChild(chip);
    });
  }

  function buildDifficultyOptions() {
    var set = Object.create(null);
    state.games.forEach(function (g) { if (g.difficulty) set[g.difficulty] = true; });

    var sel = els.difficulty;
    UI.clear(sel);

    var optAll = UI.el('option', null, 'All difficulties');
    optAll.value = 'All';
    sel.appendChild(optAll);

    Object.keys(set).sort().forEach(function (d) {
      var o = UI.el('option', null, d);
      o.value = d;
      sel.appendChild(o);
    });

    sel.value = set[state.difficulty] || state.difficulty === 'All' ? state.difficulty : 'All';
    state.difficulty = sel.value;
  }

  /* ============================================================
     Filtering & Sorting
     ============================================================ */

  function matchesQuery(game, q) {
    if (!q) return true;
    if (game.title.toLowerCase().indexOf(q) !== -1)       return true;
    if (game.description.toLowerCase().indexOf(q) !== -1) return true;
    if (game.category.toLowerCase().indexOf(q) !== -1)    return true;
    if (game.id.toLowerCase().indexOf(q) !== -1)          return true;
    for (var i = 0; i < game.tags.length; i++) {
      if (game.tags[i].toLowerCase().indexOf(q) !== -1) return true;
    }
    return false;
  }

  function applyFilters() {
    var q = state.query.trim().toLowerCase();

    var favSet = Object.create(null);
    S.getFavorites().forEach(function (id) { favSet[id] = true; });

    state.filtered = state.games.filter(function (g) {
      if (state.category !== 'All' && g.category !== state.category) return false;
      if (state.difficulty !== 'All' && g.difficulty !== state.difficulty) return false;
      if (state.toggles['new'] && !g.isNew)        return false;
      if (state.toggles.featured && !g.featured)   return false;
      if (state.toggles.favorites && !favSet[g.id]) return false;
      if (!matchesQuery(g, q)) return false;
      return true;
    });

    sortFiltered();
  }

  function sortFiltered() {
    var plays  = S.getPlays();
    var recent = S.getRecent();

    var recentIndex = Object.create(null);
    recent.forEach(function (r, i) { recentIndex[r.id] = i; });

    var favIndex = Object.create(null);
    S.getFavorites().forEach(function (id, i) { favIndex[id] = i; });

    var list = state.filtered.slice();

    switch (state.sort) {
      case 'alphabetical':
        list.sort(function (a, b) { return a.title.localeCompare(b.title); });
        break;
      case 'newest':
        list.sort(function (a, b) {
          var da = a.releaseDate ? Date.parse(a.releaseDate) : 0;
          var db = b.releaseDate ? Date.parse(b.releaseDate) : 0;
          if (db !== da) return db - da;
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          return a.title.localeCompare(b.title);
        });
        break;
      case 'recent':
        list.sort(function (a, b) {
          var ha = recentIndex[a.id];
          var hb = recentIndex[b.id];
          ha = (ha === undefined) ? Infinity : ha;
          hb = (hb === undefined) ? Infinity : hb;
          if (ha !== hb) return ha - hb;
          return a.title.localeCompare(b.title);
        });
        break;
      case 'plays':
        list.sort(function (a, b) {
          var pa = plays[a.id] || 0;
          var pb = plays[b.id] || 0;
          if (pb !== pa) return pb - pa;
          return a.title.localeCompare(b.title);
        });
        break;
      case 'favorites':
        list.sort(function (a, b) {
          var ha = favIndex[a.id];
          var hb = favIndex[b.id];
          ha = (ha === undefined) ? Infinity : ha;
          hb = (hb === undefined) ? Infinity : hb;
          if (ha !== hb) return ha - hb;
          return a.title.localeCompare(b.title);
        });
        break;
      case 'featured':
      default:
        list.sort(function (a, b) {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          if (a.isNew !== b.isNew)       return a.isNew ? -1 : 1;
          return a.title.localeCompare(b.title);
        });
        break;
    }

    state.filtered = list;
  }

  /* ============================================================
     Rendering
     ============================================================ */

  function renderGrid(resetVisible) {
    if (resetVisible) state.visible = PAGE_SIZE;

    UI.clear(els.grid);

    var favSet = Object.create(null);
    S.getFavorites().forEach(function (id) { favSet[id] = true; });
    var plays = S.getPlays();

    var slice = state.filtered.slice(0, state.visible);
    var frag = document.createDocumentFragment();

    slice.forEach(function (game) {
      frag.appendChild(UI.buildCard(game, {
        isFavorite: !!favSet[game.id],
        playCount: plays[game.id] || 0
      }));
    });

    els.grid.appendChild(frag);
    els.loadMore.hidden = state.filtered.length <= state.visible;

    renderStatus();
  }

  function renderStatus() {
    var total = state.games.length;
    var shown = state.filtered.length;

    els.resultsCount.textContent = total === 0
      ? ''
      : (shown === total
          ? total + (total === 1 ? ' game' : ' games')
          : shown + ' of ' + total + ' games');

    var status = els.status;
    UI.clear(status);

    if (state.loadError) {
      var box = UI.el('div', 'empty-state error-state');
      box.appendChild(UI.el('div', 'empty-icon', '⚠️'));
      box.appendChild(UI.el('p', 'empty-title', 'Game library could not be loaded.'));
      box.appendChild(UI.el('p', 'empty-text', state.loadError));

      var hint = UI.el('p', 'empty-hint');
      hint.textContent =
        'Tip: if you opened index.html straight from disk, browsers block fetch(). ' +
        'Serve the folder over HTTP or use GitHub Pages. See README.';
      box.appendChild(hint);

      var retry = UI.el('button', 'btn btn-primary', 'Retry');
      retry.type = 'button';
      retry.id = 'retry-load';
      box.appendChild(retry);

      status.appendChild(box);
      return;
    }

    if (total === 0) {
      var e1 = UI.el('div', 'empty-state');
      e1.appendChild(UI.el('div', 'empty-icon', '🎮'));
      e1.appendChild(UI.el('p', 'empty-title', 'No games available yet.'));
      e1.appendChild(UI.el('p', 'empty-text',
        'Add your first game: drop a folder in /games/ and one entry in games.json.'));
      status.appendChild(e1);
      return;
    }

    if (shown === 0) {
      var noFav = state.toggles.favorites;

      var e2 = UI.el('div', 'empty-state');
      e2.appendChild(UI.el('div', 'empty-icon', noFav ? '⭐' : '🔎'));
      e2.appendChild(UI.el('p', 'empty-title',
        noFav ? "You haven't added any favorites yet."
              : 'No games found.'));
      e2.appendChild(UI.el('p', 'empty-text',
        noFav ? 'Tap the ☆ on any card to save it here.'
              : 'Try another search or reset your filters.'));

      var resetBtn = UI.el('button', 'btn btn-ghost', 'Reset filters');
      resetBtn.type = 'button';
      resetBtn.id = 'empty-reset';
      e2.appendChild(resetBtn);

      status.appendChild(e2);
    }
  }

  function renderRecent() {
    var games = S.getRecent()
      .map(function (r) { return state.byId[r.id]; })
      .filter(Boolean);

    if (!games.length) {
      els.recentSection.hidden = true;
      return;
    }
    els.recentSection.hidden = false;
    UI.renderRecent(els.recentRow, games);
  }

  function renderHero() {
    var featured = null;

    if (state.games.length) {
      var pool = state.games.filter(function (g) { return g.featured; });
      if (!pool.length) pool = state.games;

      var fresh = pool.filter(function (g) { return g.isNew; });
      featured = (fresh.length ? fresh : pool)[0];
    }

    UI.renderHero(els.hero, featured);
  }

  function updateResetFiltersVisibility() {
    var active = !!state.query ||
      state.category !== 'All' ||
      state.difficulty !== 'All' ||
      state.toggles['new'] ||
      state.toggles.featured ||
      state.toggles.favorites;

    els.resetFilters.hidden = !active;
  }

  function refreshAll(resetVisible) {
    applyFilters();
    renderGrid(resetVisible);
    updateResetFiltersVisibility();
    updateStorageNote();
  }

  /* ============================================================
     Game launching
     ============================================================ */

  function launchGame(id) {
    var game = state.byId[id];
    if (!game) {
      UI.toast('That game is no longer in the library.', 'error');
      return;
    }
    if (!G.isValidFolder(game.folder)) {
      UI.toast('This game has an invalid folder name and cannot be launched.', 'error');
      return;
    }

    S.incrementPlay(id);
    S.addRecent(id);

    var url = 'games/' + encodeURIComponent(game.folder) + '/index.html';

    UI.closeModal();

    setTimeout(function () { window.location.href = url; }, 70);
  }

  /* ============================================================
     Favorites
     ============================================================ */

  function onToggleFavorite(id) {
    var nowFav = S.toggleFavorite(id);
    UI.toast(nowFav ? 'Added to favorites' : 'Removed from favorites', 'info');

    var card = els.grid.querySelector('[data-game-id="' + cssEscape(id) + '"]');
    if (card) {
      var btn = card.querySelector('.fav-btn');
      if (btn) {
        btn.classList.toggle('is-active', nowFav);
        btn.textContent = nowFav ? '★' : '☆';
        btn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
      }
    }

    if (els.detailModal && !els.detailModal.hidden) {
      var mBtn = els.detailModal.querySelector('[data-action="toggle-favorite"]');
      if (mBtn) {
        mBtn.classList.toggle('is-active', nowFav);
        mBtn.textContent = nowFav ? '★ Favorited' : '☆ Favorite';
        mBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
      }
    }

    if (state.toggles.favorites) refreshAll(false);

    updateStorageNote();
  }

  /* ============================================================
     Detail modal
     ============================================================ */

  function openDetail(id) {
    var game = state.byId[id];
    if (!game) return;
    UI.renderDetail(els.detailContent, game, {
      isFavorite: S.isFavorite(id),
      playCount:  S.getPlayCount(id)
    });
    UI.openModal(els.detailModal);
  }

  /* ============================================================
     Event handlers
     ============================================================ */

  function onGridClick(e) {
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      var id = actionEl.getAttribute('data-id');
      if (action === 'toggle-favorite') { e.stopPropagation(); onToggleFavorite(id); return; }
      if (action === 'play')            { e.stopPropagation(); launchGame(id); return; }
    }

    var card = e.target.closest('.game-card');
    if (card) {
      var cardId = card.getAttribute('data-game-id');
      if (cardId) openDetail(cardId);
    }
  }

  function onGridKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var card = e.target.closest('.game-card');
    if (!card || e.target !== card) return;
    e.preventDefault();
    openDetail(card.getAttribute('data-game-id'));
  }

  function onRecentClick(e) {
    var btn = e.target.closest('[data-action="play"]');
    if (btn) launchGame(btn.getAttribute('data-id'));
  }

  function onSearchInput(e) {
    state.query = e.target.value;
    els.searchClear.hidden = !state.query;
    refreshAll(true);
  }

  function clearSearch() {
    els.searchInput.value = '';
    state.query = '';
    els.searchClear.hidden = true;
    refreshAll(true);
    els.searchInput.focus();
  }

  function onCategoryClick(e) {
    var chip = e.target.closest('[data-category]');
    if (!chip) return;

    state.category = chip.getAttribute('data-category');

    Array.prototype.forEach.call(els.categories.children, function (c) {
      var active = (c === chip);
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    refreshAll(true);
  }

  function onDifficultyChange(e) {
    state.difficulty = e.target.value;
    refreshAll(true);
  }

  function onSortChange(e) {
    state.sort = e.target.value;
    refreshAll(true);
  }

  function onToggleChip(e) {
    var chip = e.target.closest('[data-toggle]');
    if (!chip) return;

    var key = chip.getAttribute('data-toggle');
    state.toggles[key] = !state.toggles[key];
    chip.classList.toggle('is-active', state.toggles[key]);
    chip.setAttribute('aria-pressed', state.toggles[key] ? 'true' : 'false');

    refreshAll(true);
  }

  function resetAllFilters() {
    state.query = '';
    state.category = 'All';
    state.difficulty = 'All';
    state.sort = 'featured';
    state.toggles['new'] = false;
    state.toggles.featured = false;
    state.toggles.favorites = false;

    els.searchInput.value = '';
    els.searchClear.hidden = true;
    els.difficulty.value = 'All';
    els.sortSelect.value = 'featured';

    Array.prototype.forEach.call(els.categories.children, function (c) {
      var active = c.getAttribute('data-category') === 'All';
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    Array.prototype.forEach.call(
      document.querySelectorAll('.toggle-chip[data-toggle]'),
      function (c) {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });

    refreshAll(true);
  }

  function onLoadMore() {
    state.visible += PAGE_SIZE;
    renderGrid(false);
  }

  /* ============================================================
     Settings actions
     ============================================================ */

  function openSettings() {
    updateStorageNote();
    UI.openModal(els.settingsModal);
  }

  function confirmAction(message) {
    try { return window.confirm(message); }
    catch (e) { return true; }
  }

  function onClearFavorites() {
    if (!confirmAction('Remove all favorites? This cannot be undone.')) return;
    S.clearFavorites();
    refreshAll(false);
    updateStorageNote();
    UI.toast('Favorites cleared', 'info');
  }

  function onClearRecent() {
    if (!confirmAction('Clear your recently played list?')) return;
    S.clearRecent();
    renderRecent();
    updateStorageNote();
    UI.toast('Recently played cleared', 'info');
  }

  function onClearPlays() {
    if (!confirmAction('Reset all local play counts to zero?')) return;
    S.clearPlays();
    refreshAll(false);
    updateStorageNote();
    UI.toast('Play counts cleared', 'info');
  }

  function onResetAll() {
    if (!confirmAction(
      'Reset ALL Game Hub data?\n\n' +
      'This clears favorites, recently played, play counts, theme and settings ' +
      'for this browser.')) return;

    S.resetAll();

    document.documentElement.classList.remove('reduce-motion', 'compact-cards');
    if (els.settingMotion)  els.settingMotion.checked  = false;
    if (els.settingCompact) els.settingCompact.checked = false;

    applyTheme();
    applySettings();
    renderRecent();
    refreshAll(true);
    UI.toast('Game Hub data reset', 'info');
  }

  /* ============================================================
     Global event delegation
     ============================================================ */

  function closeMobileNav() {
    var nav = document.getElementById('main-nav');
    if (nav) nav.classList.remove('is-open');
    var mb = document.getElementById('menu-btn');
    if (mb) mb.setAttribute('aria-expanded', 'false');
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function (e) {
      var backdrop = e.target.closest('.modal-backdrop');
      if (backdrop && e.target === backdrop) { UI.closeModal(); return; }

      if (e.target.closest('[data-close-modal]')) { UI.closeModal(); return; }

      if (e.target.closest('#settings-btn')) { openSettings(); return; }
      if (e.target.closest('#theme-toggle')) { cycleTheme();    return; }

      var menuBtn = e.target.closest('#menu-btn');
      if (menuBtn) {
        var nav = document.getElementById('main-nav');
        var open = nav.classList.toggle('is-open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }

      var showFav = e.target.closest('[data-action="show-favorites"]');
      if (showFav) {
        e.preventDefault();
        state.toggles.favorites = true;

        var chip = document.querySelector('[data-toggle="favorites"]');
        if (chip) {
          chip.classList.add('is-active');
          chip.setAttribute('aria-pressed', 'true');
        }

        closeMobileNav();
        refreshAll(true);

        var lib = document.getElementById('library');
        if (lib && lib.scrollIntoView) {
          lib.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (e.target.closest('.main-nav .nav-link')) closeMobileNav();

      if (e.target.closest('[data-action="clear-recent"]')) { onClearRecent(); return; }

      if (e.target.closest('#retry-load')) { loadLibrary(); return; }
      if (e.target.closest('#empty-reset')) { resetAllFilters(); return; }
      if (e.target.closest('#reset-filters')) { resetAllFilters(); return; }
      if (e.target.closest('#load-more')) { onLoadMore(); return; }

      if (e.target.closest('#clear-favorites')) { onClearFavorites(); return; }
      if (e.target.closest('#clear-recent')) { onClearRecent(); return; }
      if (e.target.closest('#clear-plays')) { onClearPlays(); return; }
      if (e.target.closest('#reset-all')) { onResetAll(); return; }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        UI.closeModal();
        closeMobileNav();
      }
      UI.trapFocus(e);

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          e.preventDefault();
          if (els.searchInput) els.searchInput.focus();
        }
      }
    });

    els.grid.addEventListener('click', onGridClick);
    els.grid.addEventListener('keydown', onGridKeydown);
    els.recentRow.addEventListener('click', onRecentClick);
    els.searchInput.addEventListener('input', debounce(onSearchInput, 120));
    els.searchClear.addEventListener('click', clearSearch);
    els.categories.addEventListener('click', onCategoryClick);
    els.difficulty.addEventListener('change', onDifficultyChange);
    els.sortSelect.addEventListener('change', onSortChange);

    document.querySelectorAll('.toggle-chip[data-toggle]').forEach(function (chip) {
      chip.addEventListener('click', onToggleChip);
    });

    if (els.settingTheme) {
      els.settingTheme.addEventListener('change', function () {
        S.setTheme(els.settingTheme.value);
        applyTheme();
      });
    }
    if (els.settingMotion) {
      els.settingMotion.addEventListener('change', function () {
        var s = S.getSettings();
        s.reduceMotion = els.settingMotion.checked;
        S.setSettings(s);
        applySettings();
      });
    }
    if (els.settingCompact) {
      els.settingCompact.addEventListener('change', function () {
        var s = S.getSettings();
        s.compactCards = els.settingCompact.checked;
        S.setSettings(s);
        applySettings();
      });
    }

    // Hero play buttons (delegated via data-action on document; grid/recent/modal handled separately)
    document.addEventListener('click', function (e) {
      var playBtn = e.target.closest('[data-action="play"]');
      if (playBtn && !els.grid.contains(playBtn) && !els.recentRow.contains(playBtn) &&
          !(els.detailModal && els.detailModal.contains(playBtn))) {
        var id = playBtn.getAttribute('data-id');
        if (id) launchGame(id);
      }
    });

    // Detail modal: Play + Favorite (TICKET #002 / #003)
    if (els.detailModal) {
      els.detailModal.addEventListener('click', function (e) {
        var playBtn = e.target.closest('[data-action="play"]');
        if (playBtn) {
          e.stopPropagation();
          launchGame(playBtn.getAttribute('data-id'));
          return;
        }
        var favBtn = e.target.closest('[data-action="toggle-favorite"]');
        if (favBtn) {
          e.stopPropagation();
          onToggleFavorite(favBtn.getAttribute('data-id'));
        }
      });
    }
  }

  /* ============================================================
     Bootstrap
     ============================================================ */

  function cacheElements() {
    els.hero          = document.getElementById('hero');
    els.grid          = document.getElementById('game-grid');
    els.status        = document.getElementById('library-status');
    els.resultsCount  = document.getElementById('results-count');
    els.loadMore      = document.getElementById('load-more');
    els.categories    = document.getElementById('category-chips');
    els.difficulty    = document.getElementById('difficulty-select');
    els.sortSelect    = document.getElementById('sort-select');
    els.searchInput   = document.getElementById('search-input');
    els.searchClear   = document.getElementById('search-clear');
    els.resetFilters  = document.getElementById('reset-filters');
    els.recentSection = document.getElementById('recent-section');
    els.recentRow     = document.getElementById('recent-row');
    els.detailModal   = document.getElementById('detail-modal');
    els.detailContent = document.getElementById('detail-content');
    els.settingsModal = document.getElementById('settings-modal');
    els.themeToggle   = document.getElementById('theme-toggle');
    els.settingTheme  = document.getElementById('setting-theme');
    els.settingMotion = document.getElementById('setting-motion');
    els.settingCompact= document.getElementById('setting-compact');
    els.storageNote   = document.getElementById('storage-note');
  }

  function loadLibrary() {
    state.loadError = null;
    els.grid.innerHTML = '';
    els.status.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading Game Library…</p></div>';

    G.loadCatalog()
      .then(function (result) {
        state.games = result.games;
        state.byId = Object.create(null);
        state.games.forEach(function (g) { state.byId[g.id] = g; });

        if (result.errors.length) {
          UI.toast(result.errors.length + ' game entr' +
            (result.errors.length === 1 ? 'y was' : 'ies were') +
            ' skipped (see console)', 'info');
        }

        buildCategoryChips();
        buildDifficultyOptions();
        renderHero();
        renderRecent();
        refreshAll(true);
      })
      .catch(function (err) {
        state.loadError = (err && err.message) ? err.message : 'Unknown error while loading games.json.';
        state.games = [];
        state.byId = Object.create(null);
        renderHero();
        renderStatus();
      });
  }

  function init() {
    cacheElements();
    applyTheme();
    applySettings();
    bindGlobalEvents();
    loadLibrary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
