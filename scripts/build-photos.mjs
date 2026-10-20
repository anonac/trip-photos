// Reads every image in /photos, pulls its Lightroom keywords, writes web-sized
// copies to public/img and a manifest to src/photos.gen.json.
//
// Files named like sarthak_likir_portrait_1.jpg, _2.jpg … are versions of one photo:
// the lowest number is the main one, the rest sit behind it on the photo page.
// Tags from every version are combined, so tagging one version is enough.
//
// Tags are read from the photo itself and from its .xmp sidecar (darktable, digiKam…),
// i.e. photo.jpg.xmp or photo.xmp next to it.
//
// Keywords (Lightroom Classic / darktable keyword hierarchy):
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
// Versions of one picture: name_1.jpg, name_2.jpg … (1–2 digits, so camera names like DSC_0001 don't count).
const VERSION = /^(.+)[_-](\d{1,2})$/;

const KIND_ROOTS = {
  people: "person", person: "person", persons: "person",
  places: "place", place: "place", locations: "place", location: "place",
  things: "thing", thing: "thing", objects: "thing",
};

// Tags that photo apps add on their own.
const IGNORED_ROOTS = new Set(["darktable"]);

const slugify = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
  .map((x) => String(x).trim()).filter(Boolean);

function readTags(meta, fromFile = {}) {
  const tags = []; // [{ name, kind }] in display order
  const seen = new Set();
  const add = (name, kind) => {
    name = name.replace(/&amp;/g, "&").replace(/_/g, " ").trim(); // leh_market -> "leh market"
    const key = slugify(name);
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ name, kind });
  };

  for (const [field, kind] of [["people", "person"], ["places", "place"], ["things", "thing"]])
    for (const name of list(fromFile[field])) add(name, kind);

  // Every word that is part of a hierarchy; the flat keyword list repeats them.
  const inHierarchy = new Set();
  for (const entry of list(meta.hierarchicalSubject)) {
    const parts = entry.split("|").map((p) => p.trim()).filter(Boolean);
    parts.forEach((p) => inHierarchy.add(p.toLowerCase()));
    const root = parts[0]?.toLowerCase();
    if (IGNORED_ROOTS.has(root)) continue; // darktable|format|jpg and friends
    const kind = KIND_ROOTS[root];
    if (kind) parts.slice(1).forEach((p) => add(p, kind));
    else if (parts.length) add(parts.at(-1), "thing");
  }

  for (const kw of [...list(meta.subject), ...list(meta.Keywords)]) {
    if (KIND_ROOTS[kw.toLowerCase()]) continue; // the "People"/"Places" parents themselves
    if (inHierarchy.has(kw.toLowerCase())) continue;
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

  // Tags written by "Tag photos.html": { "file.jpg": { people: [], places: [], things: [] } }
  const tagFilePath = path.join(SRC, "tags.json");
  let tagFile = {};
  if (existsSync(tagFilePath)) {
    try { tagFile = JSON.parse(await readFile(tagFilePath, "utf8")); }
    catch (e) { console.warn(`! photos/tags.json could not be read: ${e.message}`); }
  }

  const images = []; // one per file
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
    for (const sidecar of [`${src}.xmp`, src.replace(/\.[^.]+$/, ".xmp")]) {
      if (!existsSync(sidecar)) continue;
      try {
        const side = (await exifr.sidecar(sidecar)) ?? {}; // grouped by namespace: { dc: {…}, lr: {…} }
        meta.hierarchicalSubject = [...list(meta.hierarchicalSubject), ...list(side.lr?.hierarchicalSubject)];
        meta.subject = [...list(meta.subject), ...list(side.dc?.subject)];
        const d = String(side.exif?.DateTimeOriginal ?? "").match(/^(\d{4}):(\d\d):(\d\d)[ T](\d\d):(\d\d):(\d\d)/);
        if (d && !meta.DateTimeOriginal) meta.DateTimeOriginal = new Date(`${d[1]}-${d[2]}-${d[3]}T${d[4]}:${d[5]}:${d[6]}`);
      } catch (e) {
        console.warn(`! could not read ${path.basename(sidecar)}: ${e.message}`);
      }
      break;
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
    // Full-size JPEG for the download button, also without metadata.
    const full = path.join(OUT, `${id}.jpg`);
    keep.add(`${id}.jpg`);
    if (await newer(src, full)) await sharp(src).rotate().jpeg({ quality: 92, mozjpeg: true }).toFile(full);

    const file = rel.replace(/\\/g, "/");
    const name = path.basename(rel).replace(/\.[^.]+$/, "");
    const v = name.match(VERSION);
    const date = meta.DateTimeOriginal ?? meta.CreateDate ?? null;
    images.push({
      id, file, w, h, name: `${name}.jpg`, // download name
      date: date instanceof Date && !isNaN(date) ? date.toISOString() : null,
      group: path.posix.dirname(file) + "/" + (v ? v[1] : name).toLowerCase(),
      version: v ? Number(v[2]) : 0,
      tags: readTags(meta, tagFile[file]),
    });
  }

  const groups = new Map();
  for (const img of images) {
    if (!groups.has(img.group)) groups.set(img.group, []);
    groups.get(img.group).push(img);
  }

  const photos = [];
  const tags = {};
  for (const versions of groups.values()) {
    versions.sort((a, b) => a.version - b.version || a.file.localeCompare(b.file));
    const main = versions[0];
    const all = new Map(); // slug -> { name, kind }, across every version
    for (const v of versions) for (const t of v.tags) if (!all.has(slugify(t.name))) all.set(slugify(t.name), t);
    for (const [slug, t] of all) {
      tags[slug] ??= { name: t.name, kind: t.kind, count: 0 };
      tags[slug].count++;
    }
    if (!all.size) console.warn(`! ${main.file} has no tags`);
    photos.push({
      id: main.id, file: main.file, name: main.name, w: main.w, h: main.h,
      date: main.date ?? versions.find((v) => v.date)?.date ?? null,
      tags: [...all.keys()],
      ...(versions.length > 1 && { versions: versions.map(({ id, name, w, h }) => ({ id, name, w, h })) }),
    });
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
    // The cover can be any version, e.g. the black-and-white one.
    const coverImage = cover && images.find((p) => p.file === cover || path.basename(p.file) === cover);
    const coverPhoto = coverImage && photos.find((p) => p.id === coverImage.id || p.versions?.some((v) => v.id === coverImage.id));
    if (cover && !coverImage) console.warn(`! home.txt: cover "${cover}" not found in /photos`);
    if (coverPhoto && !coverPhoto.tags.includes(slug)) console.warn(`! home.txt: "${cover}" is not tagged "${name}" (using it anyway)`);
    if (!home.some((h) => h.tag === slug)) home.push({ tag: slug, cover: coverImage?.id });
  }
  const byCount = Object.keys(tags).sort((a, b) => tags[b].count - tags[a].count || a.localeCompare(b));
  for (const slug of byCount) {
    if (home.length >= HOME_SPOTS) break;
    if (!home.some((h) => h.tag === slug)) home.push({ tag: slug });
  }
  for (const h of home) h.cover ??= photos.find((p) => p.tags.includes(h.tag))?.id;

  const tagOut = Object.fromEntries(Object.entries(tags).map(([s, t]) => [s, { name: t.name, kind: t.kind }]));
  await writeFile(MANIFEST, JSON.stringify({ photos, tags: tagOut, home: home.slice(0, HOME_SPOTS) }));
  console.log(`✓ ${photos.length} photos (${images.length} files), ${Object.keys(tags).length} subjects`);
}

main().catch((e) => { console.error(e); process.exit(1); });
