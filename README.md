# Trip photos

A minimal photo site: a diamond of subjects → every photo of that subject → one photo with its tags.
No login, no database. Tag with the built-in tagger or Lightroom keywords, and pushing to GitHub publishes the site.

## Adding photos

There are two ways to tag. You can use either one, or both together.

### Option A — the built-in tagger (no Lightroom needed)

1. Copy your photos (JPEG) into the [`photos/`](photos) folder.
2. Double-click **Tag photos.html**. It opens in Microsoft Edge or Chrome.
   (If it opens in another browser: right-click it → Open with → Microsoft Edge.)
3. Click **Choose folder…**, pick this `site` folder and click **Allow / Edit files** when the browser asks.
4. Click a photo, then add **People**, **Places** and **Things**. Click a tag you already used to reuse it.
   Ctrl- or Shift-click several photos to tag them all at once. The **Untagged** filter shows what's left.
5. Tags save automatically to `photos/tags.json`. Commit and push in GitHub Desktop as usual.

Tip: add both `Turkey` and `Istanbul` as places if you want the photo under both.

### Option C — darktable tags

Tag in darktable as usual. Its `.xmp` sidecar files (`photo.jpg.xmp`) go in `photos/` next to the
photos — the site reads the tags from them. darktable's own automatic tags (`darktable|format|jpg`) are ignored,
and underscores show as spaces (`leh_market` → "leh market").

To have people and places grouped on the photo page, tag them as `people|sarthak` and `places|likir`
(darktable's tagging module creates the hierarchy when you type the `|`). Plain tags count as things.

### Option B — Lightroom Classic keywords

1. **Tag in Lightroom Classic** using a keyword hierarchy (Library → Keyword List):

   ```
   People
     Marul
     Deniz
   Places
     Turkey
       Istanbul
       Kaş
   Things
     Ferry
     Tea
   ```

   Nested places count for both: a photo tagged `Istanbul` also shows up under `Turkey`.
   Keywords outside People/Places/Things are treated as things.

2. **Export** (File → Export) with these settings — save them as a preset:
   - *Image Sizing*: Long Edge 3000 px (keeps the repo small; the site makes its own sizes)
   - *File Settings*: JPEG, quality 80
   - *Metadata*: **All Metadata** (or "All Except Camera & Camera Raw Info"),
     tick **Remove Location Info** (the repository is public), leave **Remove Person Info** unticked
     (it would strip people keywords), and tick
     **Write Keywords as Lightroom Hierarchy**
   - *Keywording* (Keyword List → Edit Keyword Tag on each parent `People`, `Places`, `Things`):
     leave **Include on Export** ticked.

3. Put the exported JPEGs in the [`photos/`](photos) folder (subfolders are fine), then commit and push.
   GitHub builds and publishes the site in a minute or two (see the **Actions** tab).

To change tags later: re-tag in Lightroom, re-export over the same file names, push again.
To remove a photo: delete it from `photos/` and push.

## Versions of a photo (black & white, edits…)

Name the files the same, ending in `_1`, `_2`, `_3`:

    sarthak_likir_portrait_1.jpg   ← the main one, shown in grids
    sarthak_likir_portrait_2.jpg   ← stacked behind it on the photo page
    sarthak_likir_portrait_3.jpg

On the photo page the other versions peek out behind the picture; click it (or press ↑ ↓) to flip through.
Tag any one version — the tags apply to all of them. Only 1–2 digit endings count,
so camera names like `DSC_0001.jpg` are never mistaken for versions.
A home page cover in `home.txt` can be any version, e.g. `Sarthak | sarthak_likir_portrait_2.jpg`.

## Choosing the home page

Edit [`home.txt`](home.txt): one subject per line, in order (rows of 1, 2, 3, 4, 3, 2, 1).
Add `| FILE_NAME.jpg` to pick the cover. Unfilled spots use the most-photographed subjects.

## Previewing on your computer (optional)

```
npm install
npm run dev
```

The terminal lists any photo without keywords or any `home.txt` line that doesn't match a tag.

## Visibility

The site is public but unlisted: search engines are asked not to index it (`robots.txt` + `noindex`).
Anyone with the link can see it, and the GitHub repository itself is public.
