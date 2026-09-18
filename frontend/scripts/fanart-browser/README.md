# Cafe browser provider

This is a **configurable DOM adapter**, not an official cafe comment API. It performs normal browser navigation, reads article/comment elements, fills one comment input and clicks one submit button. It does not use undocumented network endpoints, export cookies, solve verification challenges, or log in automatically.

## Verification status

The tests use local HTML served through Playwright request interception. All unmatched requests are aborted. No actual cafe comments are sent. Selectors below describe those fixtures, **not the authenticated Naver cafe DOM**. Before using a real account, the operator must supply and verify selectors in a dedicated browser profile. A successful fixture test is not proof that the real cafe is connected.

Run from `frontend` after installing the project's browser dependency:

```powershell
npx playwright install chromium
npx vitest run --config scripts/fanart-browser/vitest.config.mts
```

This separate test configuration intentionally does not launch Chromium during the normal unit suite. A CI caller must run it after installing Chromium.

## Configuration contract

`createCafeBrowserProvider({ page, selectors, operatorMemberKey })` consumes a Playwright Page, an explicitly validated selector object and the stable member key of the intended signed-in operator. The worker CLI supplies these; no account password belongs in this JSON. Every `inspect` and `sendRequest` operation fails closed unless `signedInMemberLink` resolves to exactly one valid same-cafe member link matching `operatorMemberKey`. Logged-out, expired, ambiguous, malformed and mismatched identities are never accepted.

Fixture-only example:

```json
{
  "article": "article",
  "title": "h1",
  "authorLink": ".writer",
  "boardLink": ".board",
  "image": ".art",
  "commentsReady": ".comments-ready",
  "commentsMore": ".more-comments",
  "commentRow": ".comment",
  "commentIdAttribute": "data-id",
  "commentParentIdAttribute": "data-parent",
  "commentAuthorLink": ".author",
  "commentText": ".text",
  "signedInMemberLink": ".signed-in",
  "commentInput": "textarea",
  "commentSubmit": "button.submit",
  "blockers": [".captcha", ".login-required"]
}
```

- `frame` is optional. If supplied, it must match exactly one same-cafe, same-article iframe. `article` contains the article body and comments. All article/comment selectors are scoped to this root, except `signedInMemberLink`, which is scoped to the top-level page.
- `commentsReady` must identify a fully loaded comment list, including an explicit loaded-empty state. `commentsMore` detects pagination/load-more; if visible, the adapter stops rather than assume the list is complete. This first version does not paginate comments automatically.
- `authorLink`, `commentAuthorLink`, and `signedInMemberLink` must expose same-cafe `/f-e/cafes/30182989/members/<key>` or `/ca-fe/cafes/30182989/members/<key>` links. Display names are not account identity.
- `boardLink` must expose cafe30182989 and menu38 through its URL. A valid article URL alone does not establish its board.
- `commentIdAttribute` is a stable ID and `commentParentIdAttribute` is the parent comment ID (absent/empty for top-level). Do not map a nickname, row index, or CSS class as an ID. A provider unable to extract stable IDs cannot be enabled.
- `image` must select the intended article image elements, not profile pictures, stickers or related-post thumbnails. At most20 images and100 comments are supported; exceeding those bounds stops the adapter.
- `blockers` must cover the actual login/verification/blocked-account states visible in the chosen browser. Their appearance stops work. The adapter also fails if required account identity or controls are missing/ambiguous.
- Keep selector configuration, dedicated profile and stop file in an operator-controlled non-public directory. Profile storage contains authentication material: exclude it from Git, container image build contexts, public assets, screenshots and logs. Do not point the worker at a personal browser's existing profile.

## Sending and uncertainty

Requests use a stable `[moingfans:<work UUID>]` marker. Callers pass plain request text without the marker; the adapter appends the marker exactly once. It verifies the configured signed-in member and reconciles an existing own top-level marked request before any click. It requires one visible enabled input and submit control, then rechecks blockers and the exact operator identity after filling and immediately before the one allowed click. After that click, it waits for a uniquely identified own matching comment. Missing/ambiguous confirmation throws `UncertainSendError` with stable code `UNCERTAIN_SEND`; the durable service must hold the request instead of automatically retrying it. Pre-click failures are also terminal to the caller and must not be automatically retried.

The adapter does not enforce global daily/rate limits or durable ownership; those belong to the worker/service and must not be bypassed by calling this low-level module directly. A marker reconciles our own submission, not artist consent. Reply interpretation and final permission decisions remain with the administrator.

An image candidate ID is the SHA-256 of its observed URL, **not a guarantee of immutable image bytes**. The article fingerprint excludes volatile comment/like/view counts but includes its author, title, board and image URLs. Final publication must bind the actual privately prepared file hash and require human inspection, as specified in the workflow design.
