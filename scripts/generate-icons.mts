import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generates every Campivo icon file from one geometry definition.
 *
 * The mark is a closed book with a check on its cover: the two ideas the app is
 * about, in the two shapes that survive being 16 pixels wide.
 *
 * Everything is drawn here rather than by a library because the shapes are a
 * rounded rectangle and a three-point polyline — a few dozen lines of maths
 * against a native dependency that would have to build on every machine and CI
 * runner that touches this repo. PNG is a zlib stream with a CRC per chunk, and
 * ICO is a header plus embedded PNGs, so both are written directly.
 *
 * The SVG and the rasters come from the same `SHAPES` array, so they cannot
 * drift apart.
 *
 *   npm run icons
 */

// ── Brand ────────────────────────────────────────────────────────────────────

/** --primary, oklch(0.52 0.18 271), converted to sRGB. */
const PRIMARY = [0x45, 0x5b, 0xcf] as const;
/** --primary-foreground, oklch(0.99 0.005 264). */
const PAPER = [0xfa, 0xfc, 0xff] as const;

const SIZE = 512; // design grid

// ── Geometry ─────────────────────────────────────────────────────────────────

type Shape =
  | { kind: "roundedRect"; x: number; y: number; w: number; h: number; r: number; fill: readonly number[]; alpha?: number }
  | { kind: "polyline"; points: Array<[number, number]>; width: number; fill: readonly number[]; alpha?: number };

/**
 * Sizing was chosen at 16px first and scaled up, not the other way round.
 *
 * The cover is deliberately large — it has to survive being four or five pixels
 * of white — and the check is stroked at 44/512, which lands just over a pixel
 * at 16px. The spine is the one piece allowed to disappear at small sizes: it
 * says "book rather than page" on a home screen and costs nothing when it is
 * gone.
 */
const SHAPES: Shape[] = [
  // The tile.
  { kind: "roundedRect", x: 0, y: 0, w: SIZE, h: SIZE, r: 114, fill: PRIMARY },

  // The book cover. Sized from the 16px case backwards: at that size this is
  // about nine pixels of white, and anything smaller stopped reading as a book
  // and started reading as noise.
  { kind: "roundedRect", x: 100, y: 80, w: 312, h: 352, r: 36, fill: PAPER },

  // The spine, a tinted band down the binding edge. First thing to vanish at
  // small sizes, and nothing is lost when it does.
  { kind: "roundedRect", x: 100, y: 80, w: 58, h: 352, r: 36, fill: PRIMARY, alpha: 0.17 },

  // The check, centred on the page rather than the cover — the spine takes the
  // left edge, so centring on the cover would sit it visibly off to one side.
  {
    kind: "polyline",
    points: [
      [228, 262],
      [270, 304],
      [350, 204],
    ],
    width: 44,
    fill: PRIMARY,
  },
];

// ── Rasteriser ───────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Signed distance to a rounded rectangle; negative inside. */
function sdRoundedRect(px: number, py: number, x: number, y: number, w: number, h: number, r: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Signed distance to a line segment thickened to `half`, with round ends. */
function sdSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number, half: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / len2);
  const qx = px - (ax + t * dx);
  const qy = py - (ay + t * dy);
  return Math.sqrt(qx * qx + qy * qy) - half;
}

/** Coverage of a shape at a point, antialiased over roughly one device pixel. */
function coverage(shape: Shape, px: number, py: number, pixel: number): number {
  let d: number;
  if (shape.kind === "roundedRect") {
    d = sdRoundedRect(px, py, shape.x, shape.y, shape.w, shape.h, shape.r);
  } else {
    d = Infinity;
    for (let i = 0; i < shape.points.length - 1; i += 1) {
      const [ax, ay] = shape.points[i];
      const [bx, by] = shape.points[i + 1];
      d = Math.min(d, sdSegment(px, py, ax, ay, bx, by, shape.width / 2));
    }
  }
  // Smooth across one pixel of the output, so the edge softens by the same
  // amount whether this is a 16px favicon or a 512px install icon.
  return clamp01(0.5 - d / pixel);
}

/** RGBA bytes for one square icon. */
function render(size: number): Buffer {
  const out = Buffer.alloc(size * size * 4);
  const scale = SIZE / size;
  const pixel = scale; // one output pixel, in design units

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Premultiplied accumulation, so a translucent shape over the tile
      // composites the same way the SVG renderer would do it.
      let r = 0, g = 0, b = 0, a = 0;

      for (const shape of SHAPES) {
        const px = (x + 0.5) * scale;
        const py = (y + 0.5) * scale;
        const cov = coverage(shape, px, py, pixel) * (shape.alpha ?? 1);
        if (cov <= 0) continue;

        const [sr, sg, sb] = shape.fill;
        r = sr * cov + r * (1 - cov);
        g = sg * cov + g * (1 - cov);
        b = sb * cov + b * (1 - cov);
        a = cov + a * (1 - cov);
      }

      const i = (y * size + x) * 4;
      out[i] = Math.round(r);
      out[i + 1] = Math.round(g);
      out[i + 2] = Math.round(b);
      out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

// ── PNG ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(rgba: Buffer, size: number): Buffer {
  // Filter byte 0 (None) in front of each scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── ICO ──────────────────────────────────────────────────────────────────────

/** An ICO containing PNG-encoded entries, which every browser since Vista reads. */
function toIco(entries: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir: Buffer[] = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // 0 means 256
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; // palette
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4);  // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += png.length;
  }

  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

// ── SVG ──────────────────────────────────────────────────────────────────────

const hex = (c: readonly number[]) =>
  "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

function toSvg(): string {
  const parts = SHAPES.map((s) => {
    const opacity = s.alpha === undefined ? "" : ` opacity="${s.alpha}"`;
    if (s.kind === "roundedRect") {
      return `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${hex(s.fill)}"${opacity} />`;
    }
    const d = s.points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
    return `  <path d="${d}" fill="none" stroke="${hex(s.fill)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"${opacity} />`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Campivo">
  <title>Campivo</title>
${parts.join("\n")}
</svg>
`;
}

// ── Emit ─────────────────────────────────────────────────────────────────────

const APP = join(process.cwd(), "src", "app");
const PUBLIC = join(process.cwd(), "public");
const written: string[] = [];

if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true });

/**
 * `src/app` for the files Next recognises by name — icon.svg, favicon.ico and
 * apple-icon.png become metadata routes and are linked automatically.
 *
 * `public` for the manifest's icons. Next only treats `icon.png`, `icon1.png`
 * and friends in app/ as metadata; a name like `icon-192.png` matches nothing
 * and would simply never be served, leaving the manifest pointing at a 404.
 */
function write(dir: string, relative: string, data: string | Buffer) {
  writeFileSync(join(dir, relative), data);
  const bytes = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  const label = `${dir === APP ? "src/app" : "public"}/${relative}`;
  written.push(`  ${label.padEnd(30)} ${String(bytes).padStart(7)} bytes`);
}

write(APP, "icon.svg", toSvg());

// favicon.ico carries the three sizes browsers actually pick from.
write(
  APP,
  "favicon.ico",
  toIco([16, 32, 48].map((size) => ({ size, png: toPng(render(size), size) }))),
);

// iOS home screen. Apple ignores SVG, and does not composite transparency, so
// this is the full-bleed tile.
write(APP, "apple-icon.png", toPng(render(180), 180));

// Android / desktop install, referenced by path from app/manifest.ts.
write(PUBLIC, "icon-192.png", toPng(render(192), 192));
write(PUBLIC, "icon-512.png", toPng(render(512), 512));

console.log("Campivo icons written:\n");
console.log(written.join("\n"));
console.log("");
