// Reads every image in /photos, pulls its Lightroom keywords, writes web-sized
// copies to public/img and a manifest to src/photos.gen.json.
//
// Keywords (Lightroom Classic keyword hierarchy):
//   People|Marul            -> person  "Marul"
//   Places|Turkey|Istanbul  -> place   "Turkey" and "Istanbul"
//   Things|Ferry            -> thing   "Ferry"
//   any other keyword       -> thing
// "person:Marul" / "place:Istanbul" / "thing:Ferry" also work, for apps without hierarchies.

import { readdir, mkdir, stat, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "photos");
const OUT = path.join(ROOT, "public", "img");
const MANIFEST = path.join(ROOT, "src", "photos.gen.json");
const HOME_FILE = path.join(ROOT, "home.txt");
const HOME_SPOTS = 16; // 1 + 2 + 3 + 4 + 3 + 2 + 1
const SIZES = { s: 800, l: 2400 };
const IMAGE = /\.(jpe?g|png|webp|tiff?)$/i;

const KIND_ROOTS = {
  people: "person", person: "person", persons: "person",
  places: "place", place: "place", locations: "place", location: "place",
  things: "thing", thing: "thing", objects: "thing",
};

const slugify = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
  .map((x) => String(x).trim()).filter(Boolean);

function readTags(meta) {
  const tags = []; // [{ name, kind }] in display order
  const seen = new Set();
  const add = (name, kind) => {
    const key = slugify(name);
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ name, kind });
  };

  for (const entry of list(meta.hierarchicalSubject)) {
    const parts = entry.split("|").map((p) => p.trim()).filter(Boolean);
    const kind = KIND_ROOTS[parts[0]?.toLowerCase()];
    if (kind) parts.slice(1).forEach((p) => add(p, kind));
    else if (parts.length) add(parts.at(-1), "thing");
  }

  for (const kw of [...list(meta.subject), ...list(meta.Keywords)]) {
    if (KIND_ROOTS[kw.toLowerCase()]) continue; // the "People"/"Places" parents themselves
    const m = kw.match(/^(person|people|place|thing)\s*:\s*(.+)$/i);
    if (m) add(m[2].trim(), KIND_ROOTS[m[1].toLowerCase()]);
    else add(kw, "thing");
  }
  return tags;
}

async function newer(src, out) {
  if (!existsSync(out)) return true;
  return (await stat(src)).mtimeMs > (await stat(out)).mtimeMs;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = existsSync(SRC)
    ? (await readdir(SRC, { recursive: true }))
        .filter((f) => IMAGE.test(f)).sort()
    : [];

  const photos = [];
  const tags = {};
  const usedIds = new Set();
  const keep = new Set();

  for (const rel of files) {
    const src = path.join(SRC, rel);
    const base = slugify(path.basename(rel).replace(/\.[^.]+$/, ""));
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);

    let meta = {};
    try {
      meta = (await exifr.parse(src, { xmp: true, iptc: true, exif: true, tiff: true, mergeOutput: true })) ?? {};
    } catch (e) {
      console.warn(`! could not read metadata of ${rel}: ${e.message}`);
    }

    let w, h;
    for (const [size, px] of Object.entries(SIZES)) {
      const name = `${id}-${size}.webp`;
      const out = path.join(OUT, name);
      keep.add(name);
      if (await newer(src, out)) {
        // .rotate() applies the EXIF orientation; output carries no metadata (no GPS leaks).
        const info = await sharp(src).rotate()
          .resize(px, px, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: size === "s" ? 72 : 82 }).toFile(out);
        if (size === "l") ({ width: w, height: h } = info);
      } else if (size === "l") {
        ({ width: w, height: h } = await sharp(out).metadata());
      }
    }

    const photoTags = readTags(meta);
    for (const t of photoTags) {
      const slug = slugify(t.name);
      tags[slug] ??= { name: t.name, kind: t.kind, count: 0 };
      tags[slug].count++;
    }
    const date = meta.DateTimeOriginal ?? meta.CreateDate ?? null;
    photos.push({
      id, file: rel.replace(/\\/g, "/"), w, h,
      date: date instanceof Date && !isNaN(date) ? date.toISOString() : null,
      tags: photoTags.map((t) => slugify(t.name)),
    });
    if (!photoTags.length) console.warn(`! ${rel} has no keywords`);
  }

  photos.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.file.localeCompare(b.file));

  // Remove web copies of photos that were deleted from /photos.
  for (const f of await readdir(OUT)) if (!keep.has(f)) await rm(path.join(OUT, f));

  // Home grid: subjects listed in home.txt first, then the most photographed ones.
  const home = [];
  const lines = existsSync(HOME_FILE) ? (await readFile(HOME_FILE, "utf8")).split(/\r?\n/) : [];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const [name, cover] = line.split("|").map((s) => s.trim());
    const slug = slugify(name);
    if (!tags[slug]) { console.warn(`! home.txt: no photo is tagged "${name}"`); continue; }
    const coverPhoto = cover && photos.find((p) => p.file === cover || path.basename(p.file) === cover);
    if (cover && !coverPhoto) console.warn(`! home.txt: cover "${cover}" not found in /photos`);
    if (coverPhoto && !coverPhoto.tags.includes(slug)) console.warn(`! home.txt: "${cover}" is not tagged "${name}" (using it anyway)`);
    if (!home.some((h) => h.tag === slug)) home.push({ tag: slug, cover: coverPhoto?.id });
  }
  const byCount = Object.keys(tags).sort((a, b) => tags[b].count - tags[a].count || a.localeCompare(b));
  for (const slug of byCount) {
    if (home.length >= HOME_SPOTS) break;
    if (!home.some((h) => h.tag === slug)) home.push({ tag: slug });
  }
  for (const h of home) h.cover ??= photos.find((p) => p.tags.includes(h.tag))?.id;

  const tagOut = Object.fromEntries(Object.entries(tags).map(([s, t]) => [s, { name: t.name, kind: t.kind }]));
  await writeFile(MANIFEST, JSON.stringify({ photos, tags: tagOut, home: home.slice(0, HOME_SPOTS) }));
  console.log(`✓ ${photos.length} photos, ${Object.keys(tags).length} subjects`);
}

main().catch((e) => { console.error(e); process.exit(1); });
