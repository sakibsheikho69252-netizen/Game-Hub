/* ============================================================
   Game Hub — ui.js
   Pure DOM builders. Never injects untrusted data via innerHTML.
   ============================================================ */
(function (global) {
  'use strict';

  var doc = document;

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ---------- toasts ---------- */

  var toastRegion = null;

  function toast(message, type) {
    if (!toastRegion) toastRegion = doc.getElementById('toast-region');
    if (!toastRegion) return;

    var t = el('div', 'toast' + (type ? ' toast-' + type : ''), message);
    toastRegion.appendChild(t);
    void t.offsetWidth;
    t.classList.add('is-visible');

    setTimeout(function () {
      t.classList.remove('is-visible');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 260);
    }, 2600);
  }

  /* ---------- game card ---------- */

  function buildCard(game, opts) {
    opts = opts || {};
    var isFav = !!opts.isFavorite;
    var playCount = opts.playCount || 0;

    var wrap = el('div', 'game-card-wrap');
    wrap.setAttribute('role', 'listitem');

    var card = el('article', 'game-card');
    card.setAttribute('data-game-id', game.id);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label',
      game.title + ' — ' + (game.description || game.category) + '. Open details.');

    var media = el('div', 'card-media');

    if (game.thumbnail) {
      var img = el('img', 'card-thumb');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.src = game.thumbnail;
      img.addEventListener('error', function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        media.classList.add('is-fallback');
      });
      media.appendChild(img);
    } else {
      media.classList.add('is-fallback');
    }

    var iconEl = el('span', 'card-icon', game.icon || '🎮');
    iconEl.setAttribute('aria-hidden', 'true');
    media.appendChild(iconEl);

    var badges = el('div', 'card-badges');
    if (game.featured) badges.appendChild(el('span', 'badge badge-featured', '⭐ Featured'));
    if (game.isNew)    badges.appendChild(el('span', 'badge badge-new', '✨ New'));
    if (badges.childNodes.length) media.appendChild(badges);

    var favBtn = el('button', 'fav-btn' + (isFav ? ' is-active' : ''));
    favBtn.type = 'button';
    favBtn.setAttribute('data-action', 'toggle-favorite');
    favBtn.setAttribute('data-id', game.id);
    favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    favBtn.setAttribute('aria-label',
      (isFav ? 'Remove ' + game.title + ' from favorites'
             : 'Add ' + game.title + ' to favorites'));
    favBtn.textContent = isFav ? '★' : '☆';
    media.appendChild(favBtn);

    card.appendChild(media);

    var body = el('div', 'card-body');
    body.appendChild(el('h3', 'card-title', game.title));

    var meta = el('div', 'card-meta');
    meta.appendChild(el('span', 'pill pill-category', game.category));
    if (game.difficulty) {
      meta.appendChild(el('span',
        'pill pill-difficulty diff-' + game.difficulty.toLowerCase(),
        game.difficulty));
    }
    body.appendChild(meta);

    if (game.description) {
      body.appendChild(el('p', 'card-desc', game.description));
    }

    if (game.tags.length) {
      var tagRow = el('div', 'card-tags');
      game.tags.slice(0, 4).forEach(function (t) {
        tagRow.appendChild(el('span', 'tag', '#' + t));
      });
      body.appendChild(tagRow);
    }

    var footer = el('div', 'card-footer');

    var playBtn = el('button', 'btn btn-play');
    playBtn.type = 'button';
    playBtn.setAttribute('data-action', 'play');
    playBtn.setAttribute('data-id', game.id);
    playBtn.setAttribute('aria-label', 'Play ' + game.title);
    var playGlyph = el('span', 'play-glyph', '▶');
    playGlyph.setAttribute('aria-hidden', 'true');
    playBtn.appendChild(playGlyph);
    var playText = el('span', null, 'Play');
    playText.setAttribute('aria-hidden', 'true');
    playBtn.appendChild(playText);
    footer.appendChild(playBtn);

    if (playCount > 0) {
      var pc = el('span', 'play-count',
        playCount + (playCount === 1 ? ' play' : ' plays'));
      pc.title = 'Local play count in this browser only';
      footer.appendChild(pc);
    }

    body.appendChild(footer);
    card.appendChild(body);

    wrap.appendChild(card);
    return wrap;
  }

  /* ---------- hero ---------- */

  function renderHero(heroEl, game) {
    clear(heroEl);

    var inner = el('div', 'hero-inner');

    if (game) {
      inner.appendChild(el('p', 'hero-eyebrow',
        game.featured ? '⭐ Featured Game' : 'Now Available'));
      inner.appendChild(el('h1', 'hero-title', game.title));
      inner.appendChild(el('p', 'hero-sub',
        game.description || 'Jump straight in — no installs, no accounts.'));

      var meta = el('div', 'hero-meta');
      meta.appendChild(el('span', 'pill pill-category', game.category));
      if (game.difficulty) meta.appendChild(el('span', 'pill', game.difficulty));
      if (game.isNew)      meta.appendChild(el('span', 'pill pill-new', '✨ New'));
      inner.appendChild(meta);

      var actions = el('div', 'hero-actions');

      var playNow = el('button', 'btn btn-primary btn-lg');
      playNow.type = 'button';
      playNow.setAttribute('data-action', 'play');
      playNow.setAttribute('data-id', game.id);
      playNow.appendChild(el('span', 'play-glyph', '▶'));
      playNow.appendChild(el('span', null, 'Play Now'));
      actions.appendChild(playNow);

      var browse = el('a', 'btn btn-ghost btn-lg', 'Browse Games');
      browse.href = '#library';
      actions.appendChild(browse);

      inner.appendChild(actions);

      var art = el('div', 'hero-art', game.icon || '🎮');
      art.setAttribute('aria-hidden', 'true');
      inner.appendChild(art);

    } else {
      inner.appendChild(el('p', 'hero-eyebrow', 'Welcome to'));
      inner.appendChild(el('h1', 'hero-title', 'Game Hub'));
      inner.appendChild(el('p', 'hero-sub',
        'A fast, static library of instant-play browser games. Pick one and go.'));

      var actions2 = el('div', 'hero-actions');
      var browse2 = el('a', 'btn btn-primary btn-lg', 'Browse Games');
      browse2.href = '#library';
      actions2.appendChild(browse2);
      inner.appendChild(actions2);

      var art2 = el('div', 'hero-art', '🎮');
      art2.setAttribute('aria-hidden', 'true');
      inner.appendChild(art2);
    }

    heroEl.appendChild(inner);
  }

  /* ---------- modal plumbing ---------- */

  var openModalEl = null;
  var lastFocused = null;

  function openModal(modalEl) {
    if (openModalEl === modalEl) return;
    if (openModalEl) closeModal();

    lastFocused = doc.activeElement;
    modalEl.hidden = false;
    void modalEl.offsetWidth;
    modalEl.classList.add('is-open');
    doc.body.classList.add('modal-open');
    openModalEl = modalEl;

    var focusable = modalEl.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
  }

  function closeModal() {
    if (!openModalEl) return;
    var toClose = openModalEl;
    openModalEl = null;

    toClose.classList.remove('is-open');
    doc.body.classList.remove('modal-open');
    setTimeout(function () { toClose.hidden = true; }, 200);

    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  function getOpenModal() { return openModalEl; }

  function trapFocus(e) {
    if (!openModalEl || e.key !== 'Tab') return;

    var focusables = openModalEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  /* ---------- detail modal content ---------- */

  function renderDetail(container, game, opts) {
    opts = opts || {};
    clear(container);

    var wrap = el('div', 'detail');

    var media = el('div', 'detail-media');
    var shot = game.screenshot || game.thumbnail;

    if (shot) {
      var img = el('img', 'detail-img');
      img.src = shot;
      img.alt = game.title + ' screenshot';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        if (img.parentNode) img.parentNode.removeChild(img);
        media.classList.add('is-fallback');
      });
      media.appendChild(img);
    } else {
      media.classList.add('is-fallback');
    }

    var iconEl = el('span', 'detail-icon', game.icon || '🎮');
    iconEl.setAttribute('aria-hidden', 'true');
    media.appendChild(iconEl);
    wrap.appendChild(media);

    var info = el('div', 'detail-info');
    var h2 = el('h2', 'detail-title', game.title);
    h2.id = 'detail-title';
    info.appendChild(h2);

    var meta = el('div', 'card-meta');
    meta.appendChild(el('span', 'pill pill-category', game.category));
    if (game.difficulty) meta.appendChild(el('span', 'pill', 'Difficulty: ' + game.difficulty));
    if (game.version)    meta.appendChild(el('span', 'pill', 'v' + game.version));
    if (game.isNew)      meta.appendChild(el('span', 'pill pill-new', '✨ New'));
    if (game.featured)   meta.appendChild(el('span', 'pill pill-featured', '⭐ Featured'));
    info.appendChild(meta);

    info.appendChild(el('p', 'detail-desc',
      game.description || 'No description provided for this game yet.'));

    if (game.tags.length) {
      var tags = el('div', 'card-tags');
      game.tags.forEach(function (t) { tags.appendChild(el('span', 'tag', '#' + t)); });
      info.appendChild(tags);
    }

    var facts = el('dl', 'detail-facts');
    function addFact(label, value) {
      if (!value) return;
      facts.appendChild(el('dt', null, label));
      facts.appendChild(el('dd', null, value));
    }
    addFact('Author', game.author);
    addFact('Controls', game.controls);
    addFact('Released', game.releaseDate);
    if (opts.playCount) addFact('Local plays', String(opts.playCount));
    if (facts.childNodes.length) info.appendChild(facts);

    var actions = el('div', 'detail-actions');

    var playBtn = el('button', 'btn btn-primary btn-lg');
    playBtn.type = 'button';
    playBtn.setAttribute('data-action', 'play');
    playBtn.setAttribute('data-id', game.id);
    playBtn.appendChild(el('span', 'play-glyph', '▶'));
    playBtn.appendChild(el('span', null, 'Play'));
    actions.appendChild(playBtn);

    var favBtn = el('button',
      'btn btn-ghost btn-lg' + (opts.isFavorite ? ' is-active' : ''));
    favBtn.type = 'button';
    favBtn.setAttribute('data-action', 'toggle-favorite');
    favBtn.setAttribute('data-id', game.id);
    favBtn.setAttribute('aria-pressed', opts.isFavorite ? 'true' : 'false');
    favBtn.textContent = opts.isFavorite ? '★ Favorited' : '☆ Favorite';
    actions.appendChild(favBtn);

    info.appendChild(actions);
    wrap.appendChild(info);
    container.appendChild(wrap);
  }

  /* ---------- recently played row ---------- */

  function renderRecent(rowEl, games) {
    clear(rowEl);
    games.forEach(function (game) {
      var chip = el('button', 'recent-chip');
      chip.type = 'button';
      chip.setAttribute('data-action', 'play');
      chip.setAttribute('data-id', game.id);
      chip.setAttribute('aria-label', 'Play ' + game.title);
      chip.appendChild(el('span', 'recent-icon', game.icon || '🎮'));
      chip.appendChild(el('span', 'recent-label', game.title));
      rowEl.appendChild(chip);
    });
  }

  global.GHUI = {
    el: el,
    clear: clear,
    toast: toast,
    buildCard: buildCard,
    renderHero: renderHero,
    renderDetail: renderDetail,
    renderRecent: renderRecent,
    openModal: openModal,
    closeModal: closeModal,
    getOpenModal: getOpenModal,
    trapFocus: trapFocus
  };
})(window);
