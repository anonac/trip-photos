# Trip photos

A minimal photo site: a diamond of subjects → every photo of that subject → one photo with its tags.
No login, no database. **Your Lightroom keywords are the tags**, and pushing to GitHub publishes the site.

## Adding photos

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
