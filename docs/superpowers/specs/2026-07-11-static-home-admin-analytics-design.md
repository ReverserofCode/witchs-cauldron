# Static Home, Clip Catalog, and Admin Analytics Design

## Goals

- Make `/` an ISR route instead of rendering it dynamically for every request.
- Keep newly collected clips visible without rebuilding the whole application.
- Reduce repeated Chzzk and YouTube work in the browser.
- Fix KST date defaults and the verified responsive defects in `/admin/analytics`.
- Preserve the current Moing visual language on the public page and the restrained slate language in the admin tool.

## Main Page Architecture

The page is generated with a five-minute ISR window. Build-time and ISR renders read an initial clip catalog, fan art, birthday state, and other static sections. Live status no longer participates in the server render; one client-side provider owns the status request and shares its state with every hero status view.

Clip discovery moves to `app/lib/clips/catalog.ts`. A process-local cache stores the catalog for 30 seconds and shares an in-flight scan between concurrent callers. `GET /api/clips/catalog` exposes the same catalog with a short browser/CDN freshness window and an ETag. The static page renders the initial catalog, while a client component refreshes it after hydration and when the tab becomes visible. A failed refresh keeps the last usable list.

This separation keeps `/` static while allowing runtime clip updates to appear without a deployment. File names remain encoded in URLs, and human titles are normalized in one shared place.

## Public UX and Performance

- Profile images use the Next image optimizer.
- The invalid binary `app/icon.svg` is removed; existing metadata favicon files remain authoritative.
- The YouTube Shorts player initially renders a thumbnail and only creates the iframe after an explicit play action.
- Clip and Shorts viewers no longer intercept mouse-wheel page scrolling.
- Carousel controls use at least 44px targets, and mobile pagination uses a compact numeric indicator.
- The embedded schedule shows days with events and one compact empty-week state instead of seven repeated empty rows; the full modal retains the complete calendar.

## Admin Analytics UX

The admin page remains a single operational dashboard. The public header and footer are hidden when `.admin-page` is present, with a compact link back to the site in the dashboard header.

Date presets are computed with the shared `Asia/Seoul` contract helpers. At and after KST midnight, `오늘` and the initial seven-day range therefore select the correct Korean calendar dates.

Verified responsive corrections:

- The title uses a container-safe size and wrapping behavior.
- The mobile section navigation remains sticky, but the date toolbar is sticky only on large screens.
- Date labels are explicitly associated with their inputs.
- The seven health facts use a predictable seven-column desktop grid and wrap without ellipsis.
- KPI groups stack as full-width sections with four cards per desktop row, avoiding unequal panel heights and the large blank area seen in the baseline capture.
- Refresh state is announced through `aria-live` and controls retain stable dimensions.

## Cache and Failure Semantics

- Missing or unreadable clip directories resolve to an empty catalog, not a page failure.
- A cache refresh is atomic: callers receive either the previous valid list or the completed new list.
- Catalog responses include `Cache-Control: public, max-age=15, stale-while-revalidate=45` and a deterministic ETag.
- Chzzk upstream data uses a short server revalidation window; browser polling pauses while hidden.

## Verification

- Unit tests cover clip title normalization, sorting, TTL reuse, expiry, concurrent scan deduplication, and KST preset boundaries.
- Build output must classify `/` as static/ISR rather than dynamic.
- Browser smoke checks verify poster-first Shorts, scroll behavior, image optimization, clip API headers, admin label associations, no sticky overlap, and no mobile overflow or clipped summary text.
- Before/after desktop and mobile screenshots are compared at matching viewports.
