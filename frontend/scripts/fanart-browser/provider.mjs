import { createHash } from "node:crypto";

const CAFE = "30182989";
const IMAGE_HOSTS = new Set(["cafefiles.pstatic.net", "cafeptthumb-phinf.pstatic.net", "postfiles.pstatic.net"]);
const REQUIRED = ["article", "title", "authorLink", "boardLink", "image", "commentsReady", "commentsMore", "commentRow", "commentIdAttribute", "commentParentIdAttribute", "commentAuthorLink", "commentText", "signedInMemberLink", "commentInput", "commentSubmit"];
const digest = value => createHash("sha256").update(value).digest("hex");
const renderedText = value => value.trim().replace(/\s+/g, " ");

function fail(message) { throw new Error(`Cafe browser: ${message}`); }

export function validateCafeSelectors(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("explicit selectors are required");
  for (const key of REQUIRED) {
    if (typeof value[key] !== "string" || !value[key].trim() || value[key].length > 500) fail(`missing or invalid selector: ${key}`);
  }
  if (value.frame !== undefined && (typeof value.frame !== "string" || !value.frame.trim() || value.frame.length > 500)) fail("invalid frame selector");
  if (!Array.isArray(value.blockers) || value.blockers.length < 1 || value.blockers.length > 10 || value.blockers.some(s => typeof s !== "string" || !s.trim() || s.length > 500)) fail("explicit login/captcha blocker selectors are required");
  for (const key of ["commentIdAttribute", "commentParentIdAttribute"]) {
    if (!/^(?:data-[a-z0-9-]+|id)$/.test(value[key])) fail("invalid comment identity attribute");
  }
  return Object.freeze({ ...value, blockers: Object.freeze([...value.blockers]) });
}

function source(raw) {
  let url;
  try { url = new URL(raw); } catch { fail("invalid source URL"); }
  if (url.protocol !== "https:" || url.hostname !== "cafe.naver.com" || url.port || url.username || url.password) fail("unsupported source origin");
  const match = url.pathname.match(/^\/moinge\/([1-9]\d*)\/?$/)
    ?? url.pathname.match(/^\/f-e\/cafes\/30182989\/articles\/([1-9]\d*)\/?$/);
  if (!match) fail("unsupported cafe or article URL");
  return `https://cafe.naver.com/f-e/cafes/${CAFE}/articles/${match[1]}`;
}

function member(raw) {
  if (!raw) fail("missing author identity");
  let url;
  try { url = new URL(raw, "https://cafe.naver.com"); } catch { fail("invalid member link"); }
  if (url.protocol !== "https:" || url.hostname !== "cafe.naver.com" || url.port || url.username || url.password) fail("invalid member origin");
  const match = url.pathname.match(/^\/(?:ca-fe|f-e)\/cafes\/30182989\/members\/([A-Za-z0-9_-]{1,128})\/?$/);
  if (!match) fail("missing or foreign member identity");
  return match[1];
}

function board(raw) {
  if (!raw) fail("missing board link");
  const url = new URL(raw, "https://cafe.naver.com");
  if (url.protocol !== "https:" || url.hostname !== "cafe.naver.com" || url.port || url.username || url.password) fail("invalid board origin");
  const cafe = url.searchParams.get("search.clubid") ?? url.searchParams.get("clubid") ?? url.pathname.match(/\/cafes\/(\d+)\//)?.[1];
  const menu = url.searchParams.get("search.menuid") ?? url.searchParams.get("menuid") ?? url.pathname.match(/\/menus\/(\d+)/)?.[1];
  if (cafe !== CAFE || menu !== "38") fail("not the configured fanart board");
  return menu;
}

async function unique(locator, label) {
  if (await locator.count() !== 1) fail(`expected exactly one ${label}`);
  return locator;
}

/** Browser-only adapter. No hidden endpoints, credential capture, or automatic login. */
export function createCafeBrowserProvider({ page, selectors, operatorMemberKey, timeoutMs = 10000 }) {
  const s = validateCafeSelectors(selectors);
  if (typeof operatorMemberKey !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(operatorMemberKey)) fail("operator member identity is required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) fail("invalid timeout");

  async function scope() {
    let scope = page;
    if (s.frame) {
      await page.locator(s.frame).waitFor({ state: "attached", timeout: timeoutMs });
      await unique(page.locator(s.frame), "article frame");
      const src = await page.locator(s.frame).getAttribute("src");
      if (!src || new URL(src, page.url()).origin !== "https://cafe.naver.com") fail("unexpected article frame origin");
      const frameUrl = new URL(src, page.url());
      frameUrl.pathname = frameUrl.pathname.replace(/^\/ca-fe\//, "/f-e/");
      if (source(frameUrl.href) !== source(page.url())) fail("frame points to a different article");
      scope = page.frameLocator(s.frame);
    }
    for (const blocker of s.blockers) {
      for (const owner of s.frame ? [page, scope] : [page]) {
        const matches = owner.locator(blocker);
        if (await matches.count() > 20) fail("ambiguous blocker selector");
        for (const match of await matches.all()) {
          if (await match.isVisible()) fail("login or verification requires operator intervention");
        }
      }
    }
    await scope.locator(s.article).waitFor({ state: "attached", timeout: timeoutMs });
    return unique(scope.locator(s.article), "article container");
  }

  async function readCurrent(canonical) {
    if (source(page.url()) !== canonical) fail("article navigation changed unexpectedly");
    const root = await scope();
    await root.locator(s.commentsReady).waitFor({ state: "attached", timeout: timeoutMs });
    await unique(root.locator(s.commentsReady), "complete comment marker");
    for (const more of await root.locator(s.commentsMore).all()) {
      if (await more.isVisible()) fail("comments are incomplete; operator must calibrate pagination");
    }
    const title = (await (await unique(root.locator(s.title), "article title")).innerText()).trim();
    if (!title || title.length > 200) fail("invalid article title");
    const authorId = member(await (await unique(root.locator(s.authorLink), "article author")).getAttribute("href"));
    const boardId = board(await (await unique(root.locator(s.boardLink), "board link")).getAttribute("href"));
    const imageNodes = root.locator(s.image);
    if (await imageNodes.count() > 20) fail("too many image candidates");
    const images = [];
    for (const node of await imageNodes.all()) {
      const raw = await node.getAttribute("src");
      if (!raw) fail("image not loaded or missing source");
      const url = new URL(raw, canonical);
      if (url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname) || url.port || url.username || url.password || url.hash) fail("unsupported image source");
      if (url.href.length > 4096) fail("image URL too long");
      if (!images.some(image => image.url === url.href)) images.push({ id: digest(url.href), url: url.href });
    }
    const rows = root.locator(s.commentRow);
    if (await rows.count() > 100) fail("too many comments for safe inspection");
    const comments = [];
    for (const row of await rows.all()) {
      const id = await row.getAttribute(s.commentIdAttribute);
      const parentId = await row.getAttribute(s.commentParentIdAttribute) || null;
      if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || (parentId && !/^[A-Za-z0-9_-]{1,128}$/.test(parentId)) || comments.some(c => c.id === id)) fail("missing or ambiguous comment identity");
      const authorId = member(await (await unique(row.locator(s.commentAuthorLink), "comment author")).getAttribute("href"));
      const text = (await (await unique(row.locator(s.commentText), "comment text")).innerText()).trim();
      if (!text || text.length > 4000) fail("invalid comment text");
      comments.push({ id, parentId, authorId, text });
    }
    return { sourceUrl: canonical, title, authorId, boardId, images, comments,
      fingerprint: digest(JSON.stringify({ sourceUrl: canonical, title, authorId, boardId, images })) };
  }

  async function inspect(raw) {
    const canonical = source(raw);
    await page.goto(canonical, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return readCurrent(canonical);
  }

  async function sendRequest(raw, text, marker) {
    if (typeof marker !== "string" || !/^\[moingfans:[A-Za-z0-9-]{1,80}\]$/.test(marker)) fail("invalid request marker");
    if (typeof text !== "string" || !text.trim() || text.length + marker.length + 2 > 4000 || text.includes("[moingfans:")) fail("invalid request text");
    const snapshot = await inspect(raw);
    const account = await unique(page.locator(s.signedInMemberLink), "signed-in account");
    if (member(await account.getAttribute("href")) !== operatorMemberKey) fail("signed-in account does not match configured operator");
    const existing = snapshot.comments.filter(c => c.authorId === operatorMemberKey && c.parentId === null && c.text.endsWith(marker));
    if (existing.length > 1) fail("duplicate request markers require reconciliation");
    if (existing.length === 1) return { commentId: existing[0].id };
    const root = await scope();
    const input = await unique(root.locator(s.commentInput), "comment input");
    const button = await unique(root.locator(s.commentSubmit), "comment submit button");
    if (!await input.isVisible() || !await input.isEnabled() || !await button.isVisible() || !await button.isEnabled()) fail("comment writing is unavailable");
    await input.fill(`${text.trim()}\n\n${marker}`, { timeout: timeoutMs });
    try {
      await button.click({ timeout: timeoutMs });
      await root.locator(s.commentRow).filter({ hasText: marker }).waitFor({ state: "visible", timeout: timeoutMs });
      const after = await readCurrent(snapshot.sourceUrl);
      const matches = after.comments.filter(c => c.authorId === operatorMemberKey && c.parentId === null && renderedText(c.text) === renderedText(`${text}\n\n${marker}`));
      if (matches.length !== 1) fail("request comment could not be reconciled");
      return { commentId: matches[0].id };
    } catch {
      fail("uncertain send result; do not resubmit automatically");
    }
  }
  return { inspect, sendRequest };
}
