# Vice Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ketong112/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn any photo and caption into GTA 6-style multi-panel cover art, offline in
your browser. Built for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)
bounty on make.fun.

## Run it

Serve `app/` with any static server and open `index.html`, for example:

```
cd app && python3 -m http.server 8080
```

Then open http://localhost:8080. No build step, no network request: every
script, font and sample photo is a file under `app/`, and your photos never
leave your machine.

## What it does

1. **Add photos** — pick one of the four drawn sample scenes, or add your own
   photos from your machine. Photos stay local.
2. **Arrange panels** — four layouts (Hero Split, Triptych, Quad Grid, and
   Skyline Strip), slanted panel gutters, drag to move a photo inside its
   panel, zoom, flip, and a face-centring crop that finds the face-like
   region of a photo.
3. **Style it** — four colour grades (Vice Sunset, Neon Nights, Golden Hour,
   Vice Noir), a striped chrome title, a neon script subtitle, cast role
   chips, a billing line and a Leonida stamp.
4. **Export PNG** — one click, exact post sizes: 1080 × 1080, 1080 × 1350 or
   1920 × 1080.

The **Surprise me** button shuffles the layout, grade, photos and words for a
fresh cover in one click.

## Original art

Everything in the poster is drawn by this app: the panel art, the lettering,
the palms and skyline, and the four sample scenes (drawn with PIL, no
photograph). No Rockstar Games logo, wordmark, artwork, character or font is
used. The fonts are Anton, Bebas Neue and Pacifico, shipped under the
SIL Open Font License (texts in `app/fonts/`).

## Layout

- `main.ts` — the entry program: copies `app/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun library.
- `app/` — the web app: `index.html`, `style.css`, `app.js`, fonts and samples.
- `screenshots/` — the app in a browser with a photo loaded, and covers it exported.
- `vendor/makefun-app.ts` — the kit's dossier library, unchanged.
