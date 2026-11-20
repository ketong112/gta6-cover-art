// Vice Cover Studio — turns any photo and caption into GTA 6-style
// multi-panel cover art, offline in the browser. One render function draws
// the poster at any size, so the preview and the exported PNG match exactly.

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ layouts
// Panel rects are fractions of the poster. `slant` shifts the top edge
// sideways by that fraction of the panel width: the diagonal white gutters
// are the poster's signature look.
const LAYOUTS = {
  hero: {
    name: "Hero Split",
    panels: [
      { x: 0.00, y: 0.00, w: 0.60, h: 1.00, slant: 0.045 },
      { x: 0.60, y: 0.00, w: 0.40, h: 0.50, slant: 0.045 },
      { x: 0.60, y: 0.50, w: 0.40, h: 0.50, slant: 0.045 },
    ],
  },
  triptych: {
    name: "Triptych",
    panels: [
      { x: 0.00, y: 0.00, w: 0.34, h: 1.00, slant: 0.05 },
      { x: 0.33, y: 0.00, w: 0.34, h: 1.00, slant: 0.05 },
      { x: 0.66, y: 0.00, w: 0.34, h: 1.00, slant: 0.05 },
    ],
  },
  quad: {
    name: "Quad Grid",
    panels: [
      { x: 0.00, y: 0.00, w: 0.50, h: 0.50, slant: 0.04 },
      { x: 0.50, y: 0.00, w: 0.50, h: 0.50, slant: 0.04 },
      { x: 0.00, y: 0.50, w: 0.50, h: 0.50, slant: 0.04 },
      { x: 0.50, y: 0.50, w: 0.50, h: 0.50, slant: 0.04 },
    ],
  },
  strip: {
    name: "Skyline Strip",
    panels: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.62, slant: 0.00 },
      { x: 0.00, y: 0.62, w: 0.34, h: 0.38, slant: 0.06 },
      { x: 0.33, y: 0.62, w: 0.34, h: 0.38, slant: 0.06 },
      { x: 0.66, y: 0.62, w: 0.34, h: 0.38, slant: 0.06 },
    ],
  },
};

// ------------------------------------------------------------------- grades
// A grade is a photo filter plus one or two overlay washes drawn inside
// each panel's clip. The washes are gradients, so they follow the panel.
const GRADES = {
  sunset: {
    name: "Vice Sunset",
    filter: "saturate(1.25) contrast(1.06)",
    washes: [
      { from: "rgba(255,122,24,0.16)", to: "rgba(255,46,136,0.30)", mode: "overlay" },
      { from: "rgba(255,122,24,0.00)", to: "rgba(120,20,90,0.22)", mode: "multiply" },
    ],
  },
  neon: {
    name: "Neon Nights",
    filter: "saturate(1.35) contrast(1.10)",
    washes: [
      { from: "rgba(25,227,214,0.20)", to: "rgba(255,46,136,0.30)", mode: "overlay" },
      { from: "rgba(255,46,136,0.10)", to: "rgba(25,227,214,0.10)", mode: "screen" },
    ],
  },
  golden: {
    name: "Golden Hour",
    filter: "saturate(1.15) contrast(1.04) brightness(1.04)",
    washes: [
      { from: "rgba(255,201,60,0.22)", to: "rgba(255,122,24,0.20)", mode: "soft-light" },
      { from: "rgba(255,220,140,0.00)", to: "rgba(255,170,60,0.16)", mode: "screen" },
    ],
  },
  noir: {
    name: "Vice Noir",
    filter: "grayscale(1) contrast(1.20) brightness(1.06)",
    washes: [
      { from: "rgba(255,46,136,0.00)", to: "rgba(255,46,136,0.30)", mode: "overlay" },
      { from: "rgba(0,0,0,0.10)", to: "rgba(0,0,0,0.00)", mode: "multiply" },
    ],
  },
};

const SAMPLES = [
  { id: "boulevard", file: "samples/boulevard.jpg", label: "Boulevard sunset" },
  { id: "neon", file: "samples/neon.jpg", label: "Neon street" },
  { id: "pier", file: "samples/pier.jpg", label: "Pier at dusk" },
  { id: "rooftop", file: "samples/rooftop.jpg", label: "Rooftop dusk" },
];
const SHUFFLE_TITLES = ["NEON SHORE", "NIGHT SHIFT", "PIER PRESSURE", "VICE RUN", "GOLDEN GETAWAY", "LEONIDA", "SUNSET HEIST", "BOULEVARD QUEEN"];
const SHUFFLE_SUBTITLES = [
  "One last score. One last sunset.",
  "The city never sleeps. Neither do we.",
  "Every sunset is a getaway.",
  "Two friends. One fast car. No brakes.",
  "Chase the light, outrun the night.",
];
const ROLE_POOL = ["THE DRIVER", "THE HUSTLER", "THE FIXER", "THE LOOKOUT", "THE INSIDE MAN", "THE GETAWAY", "THE DEALER", "THE DREAMER"];

// -------------------------------------------------------------------- state
const state = {
  layout: "hero",
  grade: "sunset",
  size: { w: 1080, h: 1350 },
  title: "LEONIDA",
  subtitle: "One last score. One last sunset.",
  billing: "A LEONIDA STORY  •  STARRING THE DRIVER, THE HUSTLER & THE FIXER  •  VICE COVER STUDIO",
  showBadge: true,
  photos: [],          // { id, name, img, sample }
  selectedPhoto: null,
  selectedPanel: 0,
  panels: [],          // { photo, zoom, ox, oy, flip, focus, role }
};

function freshPanels() {
  const count = LAYOUTS[state.layout].panels.length;
  const roles = ["THE DRIVER", "THE HUSTLER", "THE FIXER", "THE LOOKOUT"];
  state.panels = Array.from({ length: count }, (_, i) => ({
    photo: null, zoom: 1, ox: 0, oy: 0, flip: false, focus: null,
    role: roles[i % roles.length],
  }));
  if (state.selectedPanel >= count) state.selectedPanel = 0;
}
freshPanels();

// ------------------------------------------------------------------ helpers
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

function panelRect(layout, i, W, H) {
  const p = LAYOUTS[layout].panels[i];
  const gap = Math.max(3, W * 0.008);
  return {
    x: p.x * W + gap / 2,
    y: p.y * H + gap / 2,
    w: p.w * W - gap,
    h: p.h * H - gap,
    slant: p.slant * p.w * W,
  };
}

function slantPath(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(r.x + r.slant, r.y);
  ctx.lineTo(r.x + r.w, r.y);
  ctx.lineTo(r.x + r.w - r.slant, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.h);
  ctx.closePath();
}

// ---------------------------------------------------------------- face focus
// Finds the face-like region of a photo with a skin-tone heuristic, so a
// crop can centre on the person instead of the middle of the frame.
function detectFaceFocus(img) {
  const S = 80;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S).data;
  const CELL = 8, N = S / CELL;
  const grid = Array.from({ length: N * N }, () => 0);
  let found = 0;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4;
      const r = d[o], g = d[o + 1], b = d[o + 2];
      const skin = r > 95 && g > 40 && b > 20 && r > g + 12 && r > b + 12
        && (Math.max(r, g, b) - Math.min(r, g, b)) > 15;
      if (skin) { grid[Math.floor(py / CELL) * N + Math.floor(px / CELL)]++; found++; }
    }
  }
  if (found < 20) return { x: 0.5, y: 0.42 };
  // Densest 3x3 neighbourhood of cells wins.
  let best = -1, bx = 0, by = 0;
  for (let cy = 0; cy < N; cy++) {
    for (let cx = 0; cx < N; cx++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (gx >= 0 && gx < N && gy >= 0 && gy < N) sum += grid[gy * N + gx];
      }
      if (sum > best) { best = sum; bx = cx; by = cy; }
    }
  }
  // Centroid of the skin pixels near the winning cell.
  let sx = 0, sy = 0, n = 0;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4;
      const r = d[o], g = d[o + 1], b = d[o + 2];
      const skin = r > 95 && g > 40 && b > 20 && r > g + 12 && r > b + 12
        && (Math.max(r, g, b) - Math.min(r, g, b)) > 15;
      const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
      if (skin && Math.abs(cx - bx) <= 1 && Math.abs(cy - by) <= 1) { sx += px; sy += py; n++; }
    }
  }
  if (!n) return { x: (bx + 0.5) / N, y: (by + 0.5) / N };
  return { x: sx / n / S, y: sy / n / S };
}

// Offsets (ox, oy) are fractions of the panel size, so they survive a
// change of export size. This moves the crop so the focus point sits in
// the middle of the panel, clamped so the photo still covers it.
function focusOffsets(panel, rect, img) {
  const f = panel.focus || { x: 0.5, y: 0.42 };
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const dw = iw * base * panel.zoom, dh = ih * base * panel.zoom;
  let ox = (dw / rect.w) * (0.5 - f.x);
  let oy = (dh / rect.h) * (0.5 - f.y);
  ox = Math.max(-(dw - rect.w) / (2 * rect.w), Math.min((dw - rect.w) / (2 * rect.w), ox));
  oy = Math.max(-(dh - rect.h) / (2 * rect.h), Math.min((dh - rect.h) / (2 * rect.h), oy));
  return { ox, oy };
}

function clampOffsets(panel, rect, img) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const dw = iw * base * panel.zoom, dh = ih * base * panel.zoom;
  const mx = Math.max(0, (dw - rect.w) / (2 * rect.w));
  const my = Math.max(0, (dh - rect.h) / (2 * rect.h));
  panel.ox = Math.max(-mx, Math.min(mx, panel.ox));
  panel.oy = Math.max(-my, Math.min(my, panel.oy));
}

// ------------------------------------------------------------- panel drawing
function drawPhotoInPanel(ctx, panel, rect, photo) {
  const img = photo.img;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * panel.zoom;
  const dw = iw * scale, dh = ih * scale;
  clampOffsets(panel, rect, img);
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
  ctx.save();
  if (panel.flip) {
    ctx.translate(rect.x + rect.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(rect.x + rect.w / 2), 0);
  }
  ctx.filter = GRADES[state.grade].filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = "none";
  ctx.restore();
}

function applyGradeWashes(ctx, rect) {
  const g = GRADES[state.grade];
  for (const w of g.washes) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.35, rect.y + rect.h);
    grad.addColorStop(0, w.from);
    grad.addColorStop(1, w.to);
    ctx.save();
    ctx.globalCompositeOperation = w.mode;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

function drawPlaceholder(ctx, rect, i) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, "#3d1a5e");
  grad.addColorStop(0.55, "#7b2f6e");
  grad.addColorStop(1, "#ff2e88");
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // A small sun and horizon, so an empty panel still looks like a poster.
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * 0.42;
  const r = Math.min(rect.w, rect.h) * 0.16;
  ctx.fillStyle = "#ffc93c";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(27,16,53,0.85)";
  ctx.fillRect(rect.x, rect.y + rect.h * 0.62, rect.w, rect.h * 0.38);
  const label = "ADD A PHOTO";
  let size = Math.min(rect.w * 0.16, rect.h * 0.09);
  ctx.font = `${size}px "Bebas Neue", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff6e8";
  ctx.fillText(label, cx, rect.y + rect.h * 0.80);
  ctx.font = `${Math.max(10, size * 0.5)}px "Bebas Neue", sans-serif`;
  ctx.fillStyle = "rgba(255,246,232,0.75)";
  ctx.fillText("PANEL " + (i + 1), cx, rect.y + rect.h * 0.88);
}

function drawPanel(ctx, i, W, H) {
  const rect = panelRect(state.layout, i, W, H);
  const panel = state.panels[i];
  ctx.save();
  slantPath(ctx, rect);
  ctx.clip();
  const photo = state.photos.find((p) => p.id === panel.photo);
  if (photo) {
    drawPhotoInPanel(ctx, panel, rect, photo);
    applyGradeWashes(ctx, rect);
  } else {
    drawPlaceholder(ctx, rect, i);
  }
  ctx.restore();
  // Cream gutter line around the panel.
  ctx.save();
  slantPath(ctx, rect);
  ctx.strokeStyle = "#fff6e8";
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.stroke();
  ctx.restore();
  // Selected panel gets a gold outline and a tag.
  if (i === state.selectedPanel && !document.body.classList.contains("shot-cover")) {
    ctx.save();
    slantPath(ctx, rect);
    ctx.strokeStyle = "#ffc93c";
    ctx.lineWidth = Math.max(3, W * 0.006);
    ctx.stroke();
    ctx.restore();
    const tag = "PANEL " + (i + 1);
    ctx.font = `bold ${Math.max(11, W * 0.014)}px system-ui, sans-serif`;
    const tw = ctx.measureText(tag).width + 16;
    ctx.fillStyle = "#ffc93c";
    ctx.fillRect(rect.x + 4, rect.y + 4, tw, Math.max(18, W * 0.022));
    ctx.fillStyle = "#231303";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, rect.x + 12, rect.y + 4 + Math.max(18, W * 0.022) / 2);
  }
}

// ------------------------------------------------------------ title lettering
// The title is drawn on its own canvas and returned, so the chrome
// stripes (clipped with source-atop) only ever touch the letters, never
// the scrim or the photos behind them.
function chromeTitleCanvas(text, size) {
  const pad = Math.ceil(size * 0.14);
  const meas = document.createElement("canvas").getContext("2d");
  meas.font = `${size}px Anton, "Arial Black", sans-serif`;
  const tw = meas.measureText(text).width;
  const c = document.createElement("canvas");
  c.width = Math.ceil(tw + pad * 2 + size * 0.3);
  c.height = Math.ceil(size * 1.6);
  const tc = c.getContext("2d");
  const cx = c.width / 2, cy = c.height / 2;
  tc.font = `${size}px Anton, "Arial Black", sans-serif`;
  tc.textAlign = "center";
  tc.textBaseline = "middle";
  const depth = Math.max(2, size * 0.045);
  tc.fillStyle = "#2a0a2e";
  for (let i = 6; i >= 1; i--) tc.fillText(text, cx + i * depth * 0.3, cy + i * depth * 0.32);
  const g = tc.createLinearGradient(0, cy - size * 0.55, 0, cy + size * 0.55);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#ffe9a8");
  g.addColorStop(0.55, "#ff9d5c");
  g.addColorStop(0.75, "#ff2e88");
  g.addColorStop(1, "#b537f2");
  tc.fillStyle = g;
  tc.fillText(text, cx, cy);
  tc.save();
  tc.globalCompositeOperation = "source-atop";
  const stripeH = Math.max(2, size * 0.045);
  tc.fillStyle = "rgba(255,255,255,0.45)";
  for (let y = cy - size * 0.55; y < cy + size * 0.55; y += stripeH * 2.6) {
    tc.fillRect(0, y, c.width, stripeH);
  }
  tc.restore();
  tc.strokeStyle = "rgba(30,8,40,0.9)";
  tc.lineWidth = Math.max(1.5, size * 0.02);
  tc.strokeText(text, cx, cy);
  return c;
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  const topX = x + s * 0.12, topY = y - s;
  ctx.lineWidth = Math.max(3, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.05, y - s * 0.55, topX, topY);
  ctx.stroke();
  for (let k = 0; k < 7; k++) {
    const ang = Math.PI * (0.05 + (0.9 * k) / 6);
    const L = s * (0.52 + 0.16 * Math.sin(k * 2.3));
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    for (let j = 1; j <= 10; j++) {
      const t = j / 10;
      ctx.lineTo(
        topX + Math.cos(ang) * L * t,
        topY + Math.sin(ang) * L * 0.28 * t + L * 0.55 * t * t - s * 0.1 * t,
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyline(ctx, W, yBase, H) {
  ctx.save();
  ctx.fillStyle = "rgba(27,16,53,0.78)";
  let x = -10;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < W + 10) {
    const bw = W * (0.05 + rnd() * 0.07);
    const bh = H * (0.02 + rnd() * 0.035);
    ctx.fillRect(x, yBase - bh, bw, bh);
    if (rnd() < 0.4) {
      ctx.fillRect(x + bw / 2 - 1, yBase - bh - H * 0.02, 2, H * 0.02);
      ctx.fillStyle = "#ff2e88";
      ctx.beginPath();
      ctx.arc(x + bw / 2, yBase - bh - H * 0.022, Math.max(2, W * 0.002), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(27,16,53,0.78)";
    }
    x += bw + W * 0.012;
  }
  ctx.restore();
}

// -------------------------------------------------------------- title banner
function drawTitleBand(ctx, W, H) {
  const bandH = H * 0.30;
  const bandY = H - bandH;
  const tc = document.createElement("canvas");
  tc.width = W; tc.height = Math.ceil(bandH);
  const t = tc.getContext("2d");

  // Scrim so the words read over any photo.
  const scrim = t.createLinearGradient(0, 0, 0, bandH);
  scrim.addColorStop(0, "rgba(20,6,32,0.12)");
  scrim.addColorStop(0.45, "rgba(20,6,32,0.60)");
  scrim.addColorStop(1, "rgba(20,6,32,0.88)");
  t.fillStyle = scrim;
  t.fillRect(0, 0, W, bandH);

  // When the stamp shows, the words keep clear of it on the right.
  const titleCx = state.showBadge ? W * 0.47 : W / 2;
  const titleMaxW = state.showBadge ? W * 0.80 : W * 0.92;

  // Subtitle in neon script, shrunk to fit.
  const sub = state.subtitle.trim();
  if (sub) {
    let subSize = bandH * 0.115;
    t.font = `${subSize}px Pacifico, cursive`;
    while (t.measureText(sub).width > titleMaxW && subSize > 10) {
      subSize -= 1;
      t.font = `${subSize}px Pacifico, cursive`;
    }
    t.textAlign = "center";
    t.textBaseline = "middle";
    // A dark pass first so the script reads over bright photos, then the glow.
    t.shadowColor = "rgba(20,6,32,0.85)";
    t.shadowBlur = 6;
    t.shadowOffsetY = 2;
    t.fillStyle = "#ff7ab8";
    t.fillText(sub, titleCx, bandH * 0.10);
    t.shadowColor = "#ff2e88";
    t.shadowBlur = subSize * 0.45;
    t.shadowOffsetY = 0;
    t.fillText(sub, titleCx, bandH * 0.10);
    t.shadowBlur = 0;
  }

  // Main title in striped chrome, fitted to the width.
  const title = (state.title.trim() || "LEONIDA").toUpperCase();
  let size = bandH * 0.44;
  t.font = `${size}px Anton, "Arial Black", sans-serif`;
  while (t.measureText(title).width > titleMaxW && size > 12) {
    size -= 2;
    t.font = `${size}px Anton, "Arial Black", sans-serif`;
  }
  const titleCanvas = chromeTitleCanvas(title, size);
  t.drawImage(titleCanvas, titleCx - titleCanvas.width / 2, bandH * 0.52 - titleCanvas.height / 2);

  // Cast role chips, one per panel.
  const roles = state.panels.map((p) => (p.role || "").trim().toUpperCase()).filter(Boolean);
  if (roles.length) {
    const chipH = bandH * 0.085;
    const chipSize = chipH * 0.62;
    t.font = `${chipSize}px "Bebas Neue", sans-serif`;
    const widths = roles.map((r) => t.measureText(r).width + chipH * 0.9);
    const gap = W * 0.012;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (roles.length - 1);
    let cx = (W - total) / 2;
    t.textBaseline = "middle";
    roles.forEach((r, i) => {
      const w = widths[i];
      const y = bandH * 0.78;
      t.fillStyle = "rgba(10,4,20,0.85)";
      t.beginPath();
      t.roundRect(cx, y, w, chipH, chipH / 2);
      t.fill();
      t.fillStyle = "#fff6e8";
      t.textAlign = "left";
      t.fillText(r, cx + chipH * 0.45, y + chipH / 2 + 1);
      cx += w + gap;
    });
  }

  // Billing line, small caps at the foot.
  const billing = state.billing.trim();
  if (billing) {
    let bSize = bandH * 0.048;
    t.font = `${bSize}px "Bebas Neue", sans-serif`;
    try { t.letterSpacing = "2px"; } catch (e) { /* older canvas: no letter spacing */ }
    while (t.measureText(billing).width > W * 0.94 && bSize > 8) {
      bSize -= 1;
      t.font = `${bSize}px "Bebas Neue", sans-serif`;
    }
    t.textAlign = "center";
    t.textBaseline = "middle";
    t.fillStyle = "rgba(255,246,232,0.85)";
    t.fillText(billing, W / 2, bandH * 0.955);
    try { t.letterSpacing = "0px"; } catch (e) { /* reset */ }
  }

  ctx.drawImage(tc, 0, bandY);
}

function drawBadge(ctx, W, H) {
  const bandH = H * 0.30;
  const r = bandH * 0.21;
  const cx = W - r - W * 0.028;
  const cy = H - bandH + r * 0.72;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.fillStyle = "#ffc93c";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#231303";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#231303";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${r * 0.42}px "Bebas Neue", sans-serif`;
  ctx.fillText("LEONIDA", 0, -r * 0.28);
  ctx.font = `${r * 0.24}px "Bebas Neue", sans-serif`;
  ctx.fillText("EST. 2026", 0, r * 0.12);
  for (let i = -1; i <= 1; i++) drawStar(ctx, i * r * 0.34, r * 0.48, r * 0.13, "#231303");
  ctx.restore();
}

// ------------------------------------------------------------- grain + shade
let grainPattern = null;
function grainTile() {
  const c = document.createElement("canvas");
  c.width = 160; c.height = 160;
  const x = c.getContext("2d");
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 26;
  }
  x.putImageData(img, 0, 0);
  return c;
}

function finishPoster(ctx, W, H) {
  if (!grainPattern) grainPattern = ctx.createPattern(grainTile(), "repeat");
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(20,5,30,0)");
  v.addColorStop(1, "rgba(20,5,30,0.32)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- the poster
function renderPoster(ctx, W, H) {
  ctx.fillStyle = "#fff6e8";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < state.panels.length; i++) drawPanel(ctx, i, W, H);
  if (state.layout === "strip") {
    drawSkyline(ctx, W, H * 0.62, H);
  } else {
    drawPalm(ctx, W * 0.02, H * 0.99, H * 0.11, "rgba(27,16,53,0.85)");
    drawPalm(ctx, W * 0.98, H * 0.99, H * 0.10, "rgba(27,16,53,0.85)");
  }
  drawTitleBand(ctx, W, H);
  if (state.showBadge) drawBadge(ctx, W, H);
  finishPoster(ctx, W, H);
}

// ---------------------------------------------------------------- preview
const preview = $("poster");
function previewSize() {
  const { w, h } = state.size;
  if (w === h) return { w: 900, h: 900 };
  if (h > w) return { w: 900, h: Math.round((900 * h) / w) };
  return { w: 1280, h: 720 };
}

function renderPreview() {
  const { w, h } = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  renderPoster(preview.getContext("2d"), w, h);
}

// ------------------------------------------------------------------ export
async function exportPNG() {
  const { w, h } = state.size;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  document.body.classList.add("shot-cover");
  renderPoster(c.getContext("2d"), w, h);
  document.body.classList.remove("shot-cover");
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vice-cover-${w}x${h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $("status").textContent = `Saved vice-cover-${w}x${h}.png — ${w} × ${h} pixels.`;
}

// ------------------------------------------------------------------ UI build
const GRADE_SWATCH = {
  sunset: "linear-gradient(135deg,#ff7a18,#ff2e88 60%,#7b2ff7)",
  neon: "linear-gradient(135deg,#19e3d6,#ff2e88 60%,#1b1035)",
  golden: "linear-gradient(135deg,#ffc93c,#ff7a18 60%,#7b2f6e)",
  noir: "linear-gradient(135deg,#e8e8e8,#5a5a6e 55%,#ff2e88)",
};

function buildLayoutButtons() {
  const box = $("layouts");
  box.innerHTML = "";
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(key === state.layout));
    if (key === state.layout) b.classList.add("active");
    const mini = document.createElement("span");
    mini.className = "mini";
    for (const p of layout.panels) {
      const i = document.createElement("i");
      i.style.left = `${p.x * 100}%`;
      i.style.top = `${p.y * 100}%`;
      i.style.width = `${p.w * 100}%`;
      i.style.height = `${p.h * 100}%`;
      i.style.clipPath = `polygon(${p.slant * 100}% 0, 100% 0, ${100 - p.slant * 100}% 100%, 0 100%)`;
      mini.appendChild(i);
    }
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = layout.name;
    b.append(mini, name);
    b.addEventListener("click", () => setLayout(key));
    box.appendChild(b);
  }
}

function buildGradeButtons() {
  const box = $("grades");
  box.innerHTML = "";
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(key === state.grade));
    if (key === state.grade) b.classList.add("active");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = GRADE_SWATCH[key];
    const name = document.createElement("span");
    name.className = "gname";
    name.textContent = grade.name;
    b.append(sw, name);
    b.addEventListener("click", () => {
      state.grade = key;
      buildGradeButtons();
      renderPreview();
    });
    box.appendChild(b);
  }
}

function buildRoleInputs() {
  const box = $("roles");
  box.innerHTML = "";
  state.panels.forEach((panel, i) => {
    const label = document.createElement("label");
    label.textContent = `Role — Panel ${i + 1}`;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.value = panel.role;
    input.addEventListener("input", () => {
      panel.role = input.value;
      renderPreview();
    });
    label.appendChild(input);
    box.appendChild(label);
  });
}

function renderTray() {
  const tray = $("tray");
  tray.innerHTML = "";
  for (const photo of state.photos) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(photo.id === state.selectedPhoto));
    if (photo.id === state.selectedPhoto) b.classList.add("selected");
    if (photo.sample) b.classList.add("sample");
    b.title = photo.name;
    const img = document.createElement("img");
    img.src = photo.img.src;
    img.alt = photo.name;
    b.appendChild(img);
    b.addEventListener("click", () => {
      state.selectedPhoto = photo.id;
      assignPhotoToPanel(photo.id, state.selectedPanel);
      renderTray();
      renderPreview();
    });
    b.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/photo-id", photo.id);
    });
    b.draggable = true;
    tray.appendChild(b);
  }
  const n = state.panels.length;
  $("panel-label").textContent = `Panel ${state.selectedPanel + 1} of ${n}`;
}

function setLayout(key) {
  const old = state.panels;
  state.layout = key;
  freshPanels();
  state.panels.forEach((panel, i) => {
    if (old[i]) {
      panel.photo = old[i].photo;
      panel.zoom = old[i].zoom;
      panel.ox = old[i].ox;
      panel.oy = old[i].oy;
      panel.flip = old[i].flip;
      panel.focus = old[i].focus;
      panel.role = old[i].role;
    }
  });
  buildLayoutButtons();
  buildRoleInputs();
  syncPanelControls();
  renderPreview();
}

function assignPhotoToPanel(photoId, panelIndex) {
  const panel = state.panels[panelIndex];
  const photo = state.photos.find((p) => p.id === photoId);
  if (!panel || !photo) return;
  panel.photo = photoId;
  panel.focus = detectFaceFocus(photo.img);
  const rect = panelRect(state.layout, panelIndex, preview.width, preview.height);
  const off = focusOffsets(panel, rect, photo.img);
  panel.ox = off.ox;
  panel.oy = off.oy;
  panel.zoom = 1;
  syncPanelControls();
}

function syncPanelControls() {
  const panel = state.panels[state.selectedPanel];
  $("zoom").value = String(panel ? panel.zoom : 1);
  $("flip").setAttribute("aria-pressed", String(Boolean(panel && panel.flip)));
  const n = state.panels.length;
  $("panel-label").textContent = `Panel ${state.selectedPanel + 1} of ${n}`;
}

function syncSizeButtons() {
  for (const b of $("sizes").children) {
    const active = Number(b.dataset.w) === state.size.w && Number(b.dataset.h) === state.size.h;
    b.classList.toggle("active", active);
    b.setAttribute("aria-checked", String(active));
  }
}

// -------------------------------------------------------------- interactions
function bindEvents() {
  $("upload").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    let firstNew = null;
    for (const file of files) {
      try {
        const url = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const img = await loadImage(url);
        const id = "up-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
        state.photos.push({ id, name: file.name, img, sample: false });
        if (!firstNew) firstNew = id;
      } catch (err) {
        $("status").textContent = "That file could not be read as an image.";
      }
    }
    if (firstNew) {
      state.selectedPhoto = firstNew;
      assignPhotoToPanel(firstNew, state.selectedPanel);
      renderTray();
      renderPreview();
      $("status").textContent = `${files.length} photo${files.length > 1 ? "s" : ""} added.`;
    }
    e.target.value = "";
  });

  $("use-selected").addEventListener("click", () => {
    if (!state.selectedPhoto) { $("status").textContent = "Pick a photo first."; return; }
    assignPhotoToPanel(state.selectedPhoto, state.selectedPanel);
    renderPreview();
  });
  $("fill-all").addEventListener("click", () => {
    if (!state.selectedPhoto) { $("status").textContent = "Pick a photo first."; return; }
    state.panels.forEach((_, i) => assignPhotoToPanel(state.selectedPhoto, i));
    renderPreview();
    $("status").textContent = "One photo fills every panel — drag each one to crop it differently.";
  });
  $("zoom").addEventListener("input", (e) => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.zoom = Number(e.target.value);
    renderPreview();
  });
  $("face-focus").addEventListener("click", () => {
    const panel = state.panels[state.selectedPanel];
    const photo = state.photos.find((p) => p.id === panel.photo);
    if (!panel || !photo) { $("status").textContent = "Add a photo to this panel first."; return; }
    panel.focus = detectFaceFocus(photo.img);
    const rect = panelRect(state.layout, state.selectedPanel, preview.width, preview.height);
    const off = focusOffsets(panel, rect, photo.img);
    panel.ox = off.ox;
    panel.oy = off.oy;
    renderPreview();
    $("status").textContent = "Crop centred on the face-like region.";
  });
  $("flip").addEventListener("click", (e) => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.flip = !panel.flip;
    e.currentTarget.setAttribute("aria-pressed", String(panel.flip));
    renderPreview();
  });
  $("clear-panel").addEventListener("click", () => {
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    panel.photo = null;
    panel.zoom = 1;
    panel.ox = 0; panel.oy = 0;
    panel.focus = null;
    syncPanelControls();
    renderPreview();
  });

  $("title").addEventListener("input", (e) => { state.title = e.target.value; renderPreview(); });
  $("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; renderPreview(); });
  $("billing").addEventListener("input", (e) => { state.billing = e.target.value; renderPreview(); });
  $("badge").addEventListener("change", (e) => { state.showBadge = e.target.checked; renderPreview(); });

  for (const b of $("sizes").children) {
    b.addEventListener("click", () => {
      state.size = { w: Number(b.dataset.w), h: Number(b.dataset.h) };
      syncSizeButtons();
      renderPreview();
    });
  }
  $("export").addEventListener("click", exportPNG);

  $("surprise").addEventListener("click", () => {
    const layoutKeys = Object.keys(LAYOUTS);
    const gradeKeys = Object.keys(GRADES);
    setLayout(layoutKeys[Math.floor(Math.random() * layoutKeys.length)]);
    state.grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
    buildGradeButtons();
    const shuffled = [...state.photos].sort(() => Math.random() - 0.5);
    state.panels.forEach((_, i) => {
      if (shuffled[i]) assignPhotoToPanel(shuffled[i].id, i);
    });
    state.title = SHUFFLE_TITLES[Math.floor(Math.random() * SHUFFLE_TITLES.length)];
    state.subtitle = SHUFFLE_SUBTITLES[Math.floor(Math.random() * SHUFFLE_SUBTITLES.length)];
    $("title").value = state.title;
    $("subtitle").value = state.subtitle;
    const roles = [...ROLE_POOL].sort(() => Math.random() - 0.5);
    state.panels.forEach((panel, i) => { panel.role = roles[i % roles.length]; });
    buildRoleInputs();
    renderPreview();
    $("status").textContent = "Shuffled — a fresh cover, same photos.";
  });

  // Click a panel to select it; drag inside it to move the photo.
  let drag = null;
  preview.addEventListener("pointerdown", (e) => {
    const r = preview.getBoundingClientRect();
    const px = (e.clientX - r.left) * (preview.width / r.width);
    const py = (e.clientY - r.top) * (preview.height / r.height);
    for (let i = state.panels.length - 1; i >= 0; i--) {
      const pr = panelRect(state.layout, i, preview.width, preview.height);
      if (px >= pr.x && px <= pr.x + pr.w && py >= pr.y && py <= pr.y + pr.h) {
        state.selectedPanel = i;
        syncPanelControls();
        renderPreview();
        drag = { x: px, y: py, panel: i };
        preview.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  preview.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = preview.getBoundingClientRect();
    const px = (e.clientX - r.left) * (preview.width / r.width);
    const py = (e.clientY - r.top) * (preview.height / r.height);
    const panel = state.panels[drag.panel];
    const pr = panelRect(state.layout, drag.panel, preview.width, preview.height);
    panel.ox += (px - drag.x) / pr.w;
    panel.oy += (py - drag.y) / pr.h;
    drag = { x: px, y: py, panel: drag.panel };
    renderPreview();
  });
  preview.addEventListener("pointerup", () => { drag = null; });
  preview.addEventListener("dragover", (e) => e.preventDefault());
  preview.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/photo-id");
    if (!id) return;
    const r = preview.getBoundingClientRect();
    const px = (e.clientX - r.left) * (preview.width / r.width);
    const py = (e.clientY - r.top) * (preview.height / r.height);
    for (let i = state.panels.length - 1; i >= 0; i--) {
      const pr = panelRect(state.layout, i, preview.width, preview.height);
      if (px >= pr.x && px <= pr.x + pr.w && py >= pr.y && py <= pr.y + pr.h) {
        state.selectedPanel = i;
        state.selectedPhoto = id;
        assignPhotoToPanel(id, i);
        renderTray();
        renderPreview();
        break;
      }
    }
  });
}

// ------------------------------------------------------------------ shot mode
// ?shot=cover renders the cover alone for screenshots; ?shot=editor shows
// the editor with the samples loaded. window.__shotReady fires once painted.
function shotParams() {
  const q = new URLSearchParams(location.search);
  return {
    shot: q.get("shot"),
    layout: q.get("layout"),
    grade: q.get("grade"),
    title: q.get("title"),
    subtitle: q.get("subtitle"),
    size: q.get("size"),
  };
}

function applyShotParams(p) {
  if (p.layout && LAYOUTS[p.layout]) setLayout(p.layout);
  if (p.grade && GRADES[p.grade]) { state.grade = p.grade; buildGradeButtons(); }
  if (p.title) { state.title = p.title; $("title").value = p.title; }
  if (p.subtitle) { state.subtitle = p.subtitle; $("subtitle").value = p.subtitle; }
  if (p.size) {
    const [w, h] = p.size.split("x").map(Number);
    if (w && h) { state.size = { w, h }; syncSizeButtons(); }
  }
  if (p.shot === "cover") document.body.classList.add("shot-cover");
}

// ---------------------------------------------------------------------- init
async function init() {
  buildLayoutButtons();
  buildGradeButtons();
  buildRoleInputs();
  bindEvents();
  syncSizeButtons();
  syncPanelControls();
  try {
    await Promise.all([
      document.fonts.load('16px Anton'),
      document.fonts.load('16px "Bebas Neue"'),
      document.fonts.load('16px Pacifico'),
      document.fonts.ready,
    ]);
  } catch (e) { /* fall back to system fonts */ }
  for (const s of SAMPLES) {
    try {
      const img = await loadImage(s.file);
      state.photos.push({ id: s.id, name: s.label, img, sample: true });
    } catch (e) { /* a missing sample just leaves one fewer photo */ }
  }
  // Start with a finished-looking cover: samples across the panels.
  const order = ["boulevard", "neon", "pier", "rooftop"];
  state.panels.forEach((panel, i) => {
    const id = order[i % order.length];
    if (state.photos.some((p) => p.id === id)) {
      panel.photo = id;
      panel.focus = { x: 0.5, y: 0.42 };
    }
  });
  state.selectedPhoto = "boulevard";
  renderTray();
  const params = shotParams();
  applyShotParams(params);
  renderPreview();
  if (params.shot) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
    }));
  }
}

init();
