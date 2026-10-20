import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode, type TouchEvent } from "react";
import { back, go, href, onLinkClick, swap, useRoute } from "./router";
import { fullOf, home, photoById, photos, photosByTag, src, srcOf, tagBySlug, type Photo, type Tag, type Version } from "./data";

const DIAMOND = [1, 2, 3, 4, 3, 2, 1];
const KIND_ORDER = ["person", "place", "thing"] as const;

export default function App() {
  const [section, a, b] = useRoute();

  if (section === "t" && a && tagBySlug.has(a)) {
    const id = b && photoById.get(b)?.tags.includes(a) ? b : undefined;
    return id ? <PhotoView id={id} tag={a} key="photo" /> : <SubjectView slug={a} key={a} />;
  }
  if (section === "p" && a && photoById.has(a)) return <PhotoView id={a} key="photo" />;
  if (section) location.replace("#/");
  return <HomeView />;
}

/** An image that fades in once loaded, over a quiet placeholder. */
function Img({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      {...props}
      className={`${className} ${loaded ? "is-loaded" : ""}`}
      onLoad={() => setLoaded(true)}
      ref={(el) => { if (el?.complete && el.naturalWidth && !loaded) setLoaded(true); }}
    />
  );
}

/* ── Home: the diamond of subjects ─────────────────────────────── */

function HomeView() {
  const rows: (typeof home[number] | null)[][] = [];
  let i = 0;
  for (const n of DIAMOND) {
    const row = home.slice(i, i + n);
    i += n;
    // With no photos yet, show the empty shape of the grid.
    rows.push(home.length ? row : Array(n).fill(null));
    if (home.length && i >= home.length) break;
  }

  return (
    <main className="home">
      <div className="diamond">
        {rows.map((row, r) => (
          <div className="diamond-row" key={r}>
            {row.map((cell, c) =>
              cell ? (
                <a
                  key={cell.tag.slug}
                  className="tile"
                  href={href("t", cell.tag.slug)}
                  onClick={onLinkClick}
                  aria-label={cell.tag.name}
                >
                  {cell.cover && <Img src={srcOf(cell.cover, "s")} alt="" />}
                  <span className="tile-name">{cell.tag.name}</span>
                </a>
              ) : (
                <div className="tile" key={c} />
              ),
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

/* ── Subject: every photo of one person / place / thing ────────── */

function SubjectView({ slug }: { slug: string }) {
  const tag = tagBySlug.get(slug)!;
  const list = photosByTag.get(slug) ?? [];
  return (
    <main className="subject">
      <header className="bar">
        <a className="mark" href="#/" onClick={(e) => { e.preventDefault(); back("#/"); }} aria-label="Home" />
        <h1 className="subject-name">{tag.name}</h1>
        <span className="mark-spacer" />
      </header>
      <JustifiedGrid photos={list} link={(p) => href("t", slug, p.id)} />
    </main>
  );
}

type Cell = { photo: Photo; w: number; h: number };

function JustifiedGrid({ photos, link }: { photos: Photo[]; link: (p: Photo) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current!;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const gap = width < 600 ? 4 : 8;
  const rows = useMemo(() => {
    if (!width) return [];
    const target = width < 600 ? 160 : 280;
    const out: Cell[][] = [];
    let row: Cell[] = [];
    let rowWidth = 0;
    const flush = (last: boolean) => {
      if (!row.length) return;
      const space = width - gap * (row.length - 1);
      const scale = last ? Math.min(1, space / rowWidth) : space / rowWidth;
      out.push(row.map((c) => ({ ...c, w: c.w * scale, h: c.h * scale })));
      row = [];
      rowWidth = 0;
    };
    for (const photo of photos) {
      const w = (photo.w / photo.h) * target;
      row.push({ photo, w, h: target });
      rowWidth += w;
      if (rowWidth + gap * (row.length - 1) >= width) flush(false);
    }
    flush(true);
    return out;
  }, [photos, width, gap]);

  return (
    <div ref={ref} className="grid" style={{ gap }}>
      {rows.map((row, i) => (
        <div key={i} className="grid-row" style={{ gap }}>
          {row.map(({ photo, w, h }) => (
            <a
              key={photo.id}
              href={link(photo)}
              onClick={onLinkClick}
              className="grid-cell"
              style={{ width: Math.floor(w), height: Math.floor(h) }}
            >
              <Img src={src(photo, "s")} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Photo: the picture, and its tags in one quiet line ────────── */

/**
 * The photo with its other versions stacked behind it, peeking out at the
 * top-right corner. Click the photo, a peeking card, or a number to flip
 * through them; ↑ ↓ on the keyboard.
 */
function VersionStack({ photo, alt, current, setCurrent, children }: {
  photo: Photo;
  alt: string;
  current: number;
  setCurrent: (i: number) => void;
  children?: ReactNode;
}) {
  const versions: Version[] = photo.versions ?? [photo];
  const n = versions.length;
  const front = versions[current];
  const cycle = (by: number) => setCurrent((current + by + n) % n);

  useEffect(() => {
    if (n < 2) return;
    for (const v of versions) new Image().src = src(v, "l");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); cycle(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); cycle(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className={n > 1 ? "stack has-versions" : "stack"} style={{ "--ratio": front.w / front.h } as CSSProperties}>
        {versions.map((v, i) => {
          const depth = (i - current + n) % n;
          return (
            <Img
              key={v.id}
              src={src(v, "l")}
              alt={depth === 0 ? alt : ""}
              className={`layer depth-${Math.min(depth, 3)}`}
              style={{ zIndex: n - depth }}
              onClick={n > 1 ? () => (depth ? setCurrent(i) : cycle(1)) : undefined}
            />
          );
        })}
        {children}
      </div>
      {n > 1 && (
        <div className="versions">
          {versions.map((v, i) => (
            <button key={v.id} className={i === current ? "is-current" : ""} onClick={() => setCurrent(i)} aria-label={`Version ${i + 1}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function PhotoView({ id, tag }: { id: string; tag?: string }) {
  const photo = photoById.get(id)!;
  const list = tag ? photosByTag.get(tag)! : photos;
  const index = list.findIndex((p) => p.id === id);
  const prev = list[index - 1];
  const next = list[index + 1];
  const to = (p: Photo) => (tag ? href("t", tag, p.id) : href("p", p.id));
  const close = () => back(tag ? href("t", tag) : "#/");

  // Which version is in front (back to the first one on every new photo).
  const [shown, setShown] = useState({ id, version: 0 });
  const version = shown.id === id ? shown.version : 0;
  const setVersion = (v: number) => setShown({ id, version: v });
  const front = (photo.versions ?? [photo])[version];
  const [zoomed, setZoomed] = useState(false);

  // Keyboard: ← → to browse, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prev) swap(to(prev));
      else if (e.key === "ArrowRight" && next) swap(to(next));
      else if (e.key === "Escape") close();
      else if (e.key === "z" || e.key === "Z") setZoomed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Warm the cache for the neighbours so browsing feels instant.
  useEffect(() => {
    for (const p of [prev, next]) if (p) new Image().src = src(p, "l");
  }, [prev, next]);

  // Touch: swipe sideways to browse.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && prev) swap(to(prev));
    if (dx < 0 && next) swap(to(next));
  };

  const groups = KIND_ORDER.map((kind) =>
    photo.tags.map((s) => tagBySlug.get(s)!).filter((t): t is Tag => t?.kind === kind),
  ).filter((g) => g.length);

  return (
    <main className="photo">
      <header className="bar">
        <span className="mark-spacer" />
        <div className="actions">
          <button className="icon" onClick={() => setZoomed(true)} aria-label="Zoom" title="Zoom (Z)">
            <svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M12.5 12.5 17 17M6 8.5h5M8.5 6v5" /></svg>
          </button>
          <a className="icon" href={fullOf(front)} download={front.name} aria-label="Download" title="Download">
            <svg viewBox="0 0 20 20"><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 17h12" /></svg>
          </a>
          <button className="close" onClick={close} aria-label="Close" />
        </div>
      </header>
      {zoomed && <Zoom version={front} onClose={() => setZoomed(false)} />}

      <figure className="photo-frame" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <VersionStack
          key={photo.id}
          photo={photo}
          current={version}
          setCurrent={setVersion}
          alt={photo.tags.map((s) => tagBySlug.get(s)?.name).join(", ")}
        >
          {prev && <a className="step step-prev" href={to(prev)} onClick={(e) => { e.preventDefault(); swap(to(prev)); }} aria-label="Previous" />}
          {next && <a className="step step-next" href={to(next)} onClick={(e) => { e.preventDefault(); swap(to(next)); }} aria-label="Next" />}
        </VersionStack>
      </figure>

      <nav className="tags" aria-label="Tags">
        {groups.map((g, i) => (
          <span className="tag-group" key={i}>
            {g.map((t) => (
              <a
                key={t.slug}
                href={href("t", t.slug)}
                onClick={(e) => { e.preventDefault(); t.slug === tag ? close() : go(href("t", t.slug)); }}
                className={t.slug === tag ? "tag is-current" : "tag"}
              >
                {t.name}
              </a>
            ))}
          </span>
        ))}
      </nav>
    </main>
  );
}

/**
 * The photo at full size over the whole screen. With a mouse, the view follows
 * the pointer; on touch screens you drag to look around. Click / tap / Esc closes.
 */
function Zoom({ version, onClose }: { version: Version; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const followsPointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  useEffect(() => {
    // Capture keys first so ← → Esc don't also act on the page underneath.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "z" || e.key === "Z") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const lookAt = (fx: number, fy: number) => {
    const b = box.current!;
    b.scrollLeft = (b.scrollWidth - b.clientWidth) * fx;
    b.scrollTop = (b.scrollHeight - b.clientHeight) * fy;
  };

  return (
    <div
      ref={box}
      className={followsPointer ? "zoom follows-pointer" : "zoom"}
      onClick={onClose}
      onMouseMove={followsPointer ? (e) => lookAt(e.clientX / innerWidth, e.clientY / innerHeight) : undefined}
      role="dialog"
      aria-label="Zoomed photo"
    >
      <img src={src(version, "l")} width={version.w} height={version.h} alt="" onLoad={() => lookAt(0.5, 0.5)} />
    </div>
  );
}
