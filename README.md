# 🎮 Game Hub

A **static, backend-free game library** for the web. The Hub loads its catalog
from `games.json` at runtime and generates every game card dynamically — you
never touch `index.html` to add a game.

Designed mobile-first for Android phones, but works everywhere (Chrome, Firefox,
Edge, Safari, desktop and tablet).

---

## What is Game Hub?

```
index.html   →   games.json   →   JavaScript   →   Game Library
                                                      ↓
                                                  Game Card
                                                      ↓
                                                    PLAY
                                                      ↓
                                          games/<folder>/index.html
```

The Hub is a permanent application. Games are independent modules. Adding a game
means adding one folder and one JSON entry — nothing else.

Everything runs client-side. No server, no database, no accounts, no build step.

---

## Folder structure

```
GAME-HUB/
├── index.html               ← the Hub (never needs editing to add games)
├── games.json               ← the catalog
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── storage.js           ← namespaced localStorage wrapper
│   ├── games.js             ← loads + validates games.json
│   ├── ui.js                ← DOM builders (cards, modals, toasts)
│   └── app.js               ← state, filtering, sorting, events
└── games/
    ├── tap-rush/index.html
    ├── star-dodger/index.html
    ├── memory-match/index.html
    └── reaction-test/index.html
```

---

## Run it locally

`games.json` is loaded with `fetch()`, and browsers block `fetch()` on
`file://` URLs. So **do not double-click `index.html`** — serve the folder over
HTTP instead.

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then open http://localhost:8000/

On GitHub Pages this is a non-issue — everything is served over HTTPS.

---

## Add a new game

Three steps. That's it.

### 1. Create the folder

```
games/my-new-game/
```

### 2. Put your game inside it

```
games/my-new-game/index.html
```

Your game is a completely normal, self-contained web page. Use plain
HTML/CSS/JS, Canvas, WebGL, Three.js, Phaser — whatever you like.

Add a way back to the Hub:

```html
<a href="../../index.html">← Back to Game Hub</a>
```

### 3. Add one entry to `games.json`

```json
{
  "id": "my-new-game",
  "title": "My New Game",
  "folder": "my-new-game",
  "description": "A short one-line pitch.",
  "category": "Arcade",
  "tags": ["arcade", "fun"],
  "icon": "🎮",
  "difficulty": "Medium",
  "featured": false,
  "new": true
}
```

### 4. Refresh the Hub

The card appears automatically. `index.html` is never edited.

---

## `games.json` format

Required fields:

| Field   | Type   | Notes |
|---------|--------|-------|
| `id`    | string | Unique. Used for favorites, recents and play counts. |
| `title` | string | Shown on the card. |
| `folder`| string | Folder name inside `/games/`. Letters, digits, `-` and `_` only. |

Optional fields (safe to omit):

| Field        | Type     | Default if omitted |
|--------------|----------|--------------------|
| `description`| string   | Card just omits the text |
| `category`   | string   | `"Other"` |
| `tags`       | string[] | No tags shown |
| `icon`       | string   | `"🎮"` |
| `thumbnail`  | string   | Emoji icon fallback |
| `screenshot` | string   | Falls back to thumbnail, then icon |
| `difficulty` | string   | No difficulty pill |
| `version`    | string   | Hidden |
| `releaseDate`| string   | YYYY-MM-DD. Used by "Newest" sort. |
| `featured`   | boolean  | `false` |
| `new`        | boolean  | `false` |
| `author`     | string   | Hidden |
| `controls`   | string   | Hidden |
| `orientation`| string   | Hidden. Use `"landscape"` or `"portrait"` as needed. |

Broken entries are skipped individually — one bad game never takes down the library.

---

## Deploy to GitHub Pages

1. Push the whole folder to a GitHub repository.
2. **Settings → Pages → Source:** Deploy from a branch.
3. Branch: `main`, Folder: `/` (root).
4. Wait ~30 seconds. Your Hub is live at:

```
https://USERNAME.github.io/REPOSITORY/
```

Every path is relative, so it works at both `/` and `/REPOSITORY/`.

---

## Local data

Everything is stored in this browser only, under the `gamehub:` prefix:

| Key                  | Contents |
|----------------------|----------|
| `gamehub:favorites`  | Array of game ids |
| `gamehub:recent`     | Array of `{ id, ts }`, max 12 |
| `gamehub:plays`      | `{ gameId: count }` |
| `gamehub:theme`      | `"dark"` / `"light"` / `"system"` |
| `gamehub:settings`   | `{ reduceMotion, compactCards }` |
| `gamehub:best:<id>`  | Best score written by individual games |

Play counts are **local to your browser** — they are not global statistics.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Game library could not be loaded." | Opened via `file://` | Serve over HTTP |
| Same on GitHub Pages | `games.json` missing or invalid | Check DevTools → Network / Console |
| Card shows emoji instead of image | Wrong thumbnail path | Use path relative to repo root |
| Clicking Play gives 404 | Folder name mismatch | `folder` must match the directory name exactly |

---

## License

Do whatever you like with it. Have fun. 🎮
