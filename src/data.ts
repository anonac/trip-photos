import raw from "./photos.gen.json";

export type Kind = "person" | "place" | "thing";
export type Tag = { slug: string; name: string; kind: Kind };
export type Version = { id: string; name: string; w: number; h: number };
/** A photo, plus its other versions (black and white, edits…) when it has any. */
export type Photo = Version & { date: string | null; tags: string[]; versions?: Version[] };

type Manifest = {
  photos: Photo[];
  tags: Record<string, { name: string; kind: Kind }>;
  home: { tag: string; cover?: string }[];
};
const data = raw as Manifest;

export const photos = data.photos;
export const photoById = new Map(photos.map((p) => [p.id, p]));
export const tagBySlug = new Map(
  Object.entries(data.tags).map(([slug, t]) => [slug, { slug, ...t } as Tag]),
);
export const photosByTag = new Map<string, Photo[]>();
for (const p of photos)
  for (const t of p.tags) {
    if (!photosByTag.has(t)) photosByTag.set(t, []);
    photosByTag.get(t)!.push(p);
  }

export const home = data.home
  .map((h) => ({ tag: tagBySlug.get(h.tag)!, cover: h.cover }))
  .filter((h) => h.tag);

export const src = (p: Version, size: "s" | "l") => `img/${p.id}-${size}.webp`;
export const srcOf = (id: string, size: "s" | "l") => `img/${id}-${size}.webp`;
/** Full-size JPEG for downloading. */
export const fullOf = (v: Version) => `img/${v.id}.jpg`;
