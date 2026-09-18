import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCafeBrowserProvider, UncertainSendError } from "./provider.mjs";

const URL = "https://cafe.naver.com/f-e/cafes/30182989/articles/10374";
const FRAME_URL = "https://cafe.naver.com/ca-fe/cafes/30182989/articles/10374";
const selectors = {
  article: "article", title: "h1", authorLink: ".writer", boardLink: ".board",
  image: ".art", commentsReady: ".comments-ready", commentsMore: ".more-comments",
  commentRow: ".comment", commentIdAttribute: "data-id", commentParentIdAttribute: "data-parent",
  commentAuthorLink: ".author", commentText: ".text", signedInMemberLink: ".signed-in",
  commentInput: "textarea", commentSubmit: "button.submit", blockers: [".captcha", ".login-required"],
};
type Comment = { id: string; parentId: string | null; authorId: string; text: string };
type Options = {
  author?: string;
  board?: string;
  account?: string | null;
  accountHref?: string;
  ambiguousAccount?: boolean;
  extra?: string;
  outside?: string;
  noConfirmation?: boolean;
  collapseText?: boolean;
  comments?: Comment[];
  disabledInput?: boolean;
  disabledSubmit?: boolean;
  mutateOnInput?: "blocker" | "remove-account" | "change-account";
  frame?: boolean;
};
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
afterAll(async () => { await browser?.close(); });

async function fixture(options: Options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const comments = [...options.comments ?? []];
  let submissions = 0;
  await page.route("**/*", async route => {
    const request = route.request();
    if (request.url() === "https://cafe.naver.com/fixture-submit") {
      submissions++;
      const text = JSON.parse(request.postData() ?? "{}").text;
      const comment = { id: String(100 + submissions), parentId: null, authorId: "operator-key", text };
      if (!options.noConfirmation) comments.push(comment);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(options.noConfirmation ? null : comment) });
      return;
    }
    if (request.url() !== URL && request.url() !== FRAME_URL) { await route.abort(); return; }
    const account = options.account === null ? "" : `<a class="signed-in" href="${options.accountHref ?? `/ca-fe/cafes/30182989/members/${options.account ?? "operator-key"}`}">operator</a>`;
    const duplicateAccount = options.ambiguousAccount ? '<a class="signed-in" href="/ca-fe/cafes/30182989/members/operator-key">duplicate</a>' : "";
    const article = `<article><h1>대장장이 김모잉</h1>
      <a class="writer" href="/ca-fe/cafes/30182989/members/${options.author ?? "artist-key"}">작가</a>
      <a class="board" href="/ArticleList.nhn?search.clubid=30182989&search.menuid=${options.board ?? "38"}">팬아트</a>
      <img class="art" src="https://cafefiles.pstatic.net/example/art.png" alt="art">
      <div class="comments-ready"></div><div id="comments"></div>
      <textarea aria-label="댓글" ${options.disabledInput ? "disabled" : ""}></textarea><button class="submit" ${options.disabledSubmit ? "disabled" : ""}>등록</button>
      ${options.extra ?? ""}</article>
      <script>
      const rows = document.querySelector('#comments');
      function append(c) {
        const row = document.createElement('div'); row.className='comment';
        row.dataset.id=c.id; if(c.parentId) row.dataset.parent=c.parentId;
        const author=document.createElement('a'); author.className='author'; author.href='/ca-fe/cafes/30182989/members/'+c.authorId; author.textContent=c.authorId;
        const text=document.createElement('span'); text.className='text'; text.textContent=c.text;
        row.append(author,text); rows.append(row);
      }
      ${JSON.stringify(comments)}.forEach(append);
      document.querySelector('textarea').addEventListener('input', () => {
        const mutation = ${JSON.stringify(options.mutateOnInput ?? null)};
        if (mutation === 'blocker') document.body.insertAdjacentHTML('beforeend', '<div class="captcha">verify</div>');
        if (mutation === 'remove-account') parent.document.querySelectorAll('.signed-in').forEach(node => node.remove());
        if (mutation === 'change-account') parent.document.querySelector('.signed-in')?.setAttribute('href', '/ca-fe/cafes/30182989/members/intruder-key');
      });
      document.querySelector('button.submit').onclick=async () => {
        const res=await fetch('/fixture-submit',{method:'POST',body:JSON.stringify({text:document.querySelector('textarea').value})});
        const c=await res.json(); if(c) append(c);
      };
      </script>`;
    const style = `<style>.text { white-space: ${options.collapseText ? "normal" : "pre-wrap"}; }</style>`;
    const body = options.frame && request.url() === URL
      ? `${account}${duplicateAccount}${options.outside ?? ""}<iframe id="cafe_main" src="${FRAME_URL}"></iframe>`
      : `${options.frame ? "" : account + duplicateAccount + (options.outside ?? "")}${article}`;
    await route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${body}</body></html>` });
  });
  const provider = createCafeBrowserProvider({ page, selectors: options.frame ? { ...selectors, frame: "#cafe_main" } : selectors, operatorMemberKey: "operator-key", timeoutMs: 500 });
  return { page, context, provider, submissions: () => submissions };
}

describe("cafe browser provider against intercepted local DOM", () => {
  it("reads stable article identities and does not confuse a comment author with the artist", async () => {
    const f = await fixture({ comments: [{ id: "1", parentId: null, authorId: "visitor", text: "hello" }] });
    try {
      const snapshot = await f.provider.inspect(URL);
      expect(snapshot).toMatchObject({ sourceUrl: URL, title: "대장장이 김모잉", authorId: "artist-key", boardId: "38" });
      expect(snapshot.images).toHaveLength(1);
      expect(snapshot.images[0].url).toBe("https://cafefiles.pstatic.net/example/art.png");
      expect(snapshot.comments[0]).toEqual({ id: "1", parentId: null, authorId: "visitor", text: "hello" });
      expect(snapshot.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(f.submissions()).toBe(0);
    } finally { await f.context.close(); }
  });

  it.each([
    ["missing", { account: null }],
    ["wrong", { account: "wrong-account" }],
    ["ambiguous", { ambiguousAccount: true }],
    ["invalid", { accountHref: "/ca-fe/cafes/30182989/members/not%20a%20key" }],
  ] as const)("fails inspection closed for a %s signed-in identity", async (_label, options) => {
    const f = await fixture(options);
    try {
      await expect(f.provider.inspect(URL)).rejects.toThrow();
      expect(f.submissions()).toBe(0);
    } finally { await f.context.close(); }
  });

  it("accepts inspection only for the configured signed-in identity", async () => {
    const f = await fixture({ account: "operator-key" });
    try {
      await expect(f.provider.inspect(URL)).resolves.toMatchObject({ authorId: "artist-key", boardId: "38" });
      expect(f.submissions()).toBe(0);
    } finally { await f.context.close(); }
  });

  it("writes one marked comment and reconciles the same request without resubmission", async () => {
    const f = await fixture();
    try {
      expect(await f.provider.sendRequest(URL, "permission request", "[moingfans:test]")).toEqual({ commentId: "101" });
      expect(await f.provider.sendRequest(URL, "permission request", "[moingfans:test]")).toEqual({ commentId: "101" });
      const snapshot = await f.provider.inspect(URL);
      expect(snapshot.comments).toEqual([{ id: "101", parentId: null, authorId: "operator-key", text: "permission request\n\n[moingfans:test]" }]);
      expect(f.submissions()).toBe(1);
    } finally { await f.context.close(); }
  });

  it.each([
    ["wrong board", { board: "39" }],
    ["missing author key", { author: "" }],
    ["incomplete comments", { extra: '<button class="more-comments">more</button>' }],
    ["captcha", { extra: '<div class="captcha">verify</div>' }],
  ] as const)("blocks inspection for %s", async (_label, options) => {
    const f = await fixture(options);
    try { await expect(f.provider.inspect(URL)).rejects.toThrow(); expect(f.submissions()).toBe(0); }
    finally { await f.context.close(); }
  });

  it.each([
    ["another account", { account: "wrong-account" }],
    ["ambiguous input", { extra: "<textarea></textarea>" }],
    ["ambiguous submit", { extra: '<button class="submit">other submit</button>' }],
    ["login restriction", { extra: '<div class="login-required">login</div>' }],
    ["disabled input", { disabledInput: true }],
    ["disabled submit", { disabledSubmit: true }],
  ] as const)("never submits with %s", async (_label, options) => {
    const f = await fixture(options);
    try { await expect(f.provider.sendRequest(URL, "request", "[moingfans:test]")).rejects.toThrow(); expect(f.submissions()).toBe(0); }
    finally { await f.context.close(); }
  });

  it.each([
    ["a blocker", "blocker"],
    ["a removed login", "remove-account"],
    ["a changed login", "change-account"],
  ] as const)("rechecks %s introduced by filling before submission", async (_label, mutateOnInput) => {
    const f = await fixture({ mutateOnInput });
    try {
      await expect(f.provider.inspect(URL)).resolves.toMatchObject({ authorId: "artist-key" });
      await expect(f.provider.sendRequest(URL, "request", "[moingfans:test]")).rejects.toThrow();
      expect(f.submissions()).toBe(0);
    } finally { await f.context.close(); }
  });

  it("reports an uncertain remote result without clicking twice", async () => {
    const f = await fixture({ noConfirmation: true });
    try {
      const error = await f.provider.sendRequest(URL, "request", "[moingfans:test]").catch(caught => caught);
      expect(error).toBeInstanceOf(UncertainSendError);
      expect(error).toMatchObject({ code: "UNCERTAIN_SEND" });
      expect(f.submissions()).toBe(1);
    } finally { await f.context.close(); }
  });

  it("reconciles posted text when the renderer collapses whitespace", async () => {
    const f = await fixture({ collapseText: true });
    try {
      expect(await f.provider.sendRequest(URL, "permission\nrequest", "[moingfans:test]")).toEqual({ commentId: "101" });
      expect(f.submissions()).toBe(1);
    } finally { await f.context.close(); }
  });

  it("rejects foreign cafe and arbitrary URLs before navigating", async () => {
    const f = await fixture();
    try {
      for (const source of ["http://127.0.0.1/", "https://evil.test/", "https://cafe.naver.com/f-e/cafes/1/articles/10374"]) {
        await expect(f.provider.inspect(source)).rejects.toThrow();
      }
      expect(f.page.url()).toBe("about:blank");
    } finally { await f.context.close(); }
  });

  it("keeps article fingerprint independent of comment activity", async () => {
    const f = await fixture();
    try {
      const before = await f.provider.inspect(URL);
      await f.provider.sendRequest(URL, "request", "[moingfans:test]");
      const after = await f.provider.inspect(URL);
      expect(after.fingerprint).toBe(before.fingerprint);
    } finally { await f.context.close(); }
  });

  it("requires explicit selectors instead of guessing authenticated site controls", () => {
    expect(() => createCafeBrowserProvider({ page: {} as Page, selectors: {} as typeof selectors, operatorMemberKey: "operator-key" })).toThrow();
  });

  it("ignores title, author, image and comment decoys outside the article", async () => {
    const f = await fixture({ outside: `
      <h1>decoy title</h1>
      <a class="writer" href="/ca-fe/cafes/30182989/members/decoy-author">decoy author</a>
      <img class="art" src="https://evil.test/decoy.png">
      <div class="comment" data-id="decoy"><a class="author" href="/ca-fe/cafes/30182989/members/decoy-commenter"></a><span class="text">decoy comment</span></div>
    ` });
    try {
      const snapshot = await f.provider.inspect(URL);
      expect(snapshot).toMatchObject({ title: "대장장이 김모잉", authorId: "artist-key" });
      expect(snapshot.images.map(image => image.url)).toEqual(["https://cafefiles.pstatic.net/example/art.png"]);
      expect(snapshot.comments).toEqual([]);
    } finally { await f.context.close(); }
  });

  it("inspects and submits through an explicitly configured same-article iframe", async () => {
    const f = await fixture({ frame: true });
    try {
      await expect(f.provider.inspect(URL)).resolves.toMatchObject({ sourceUrl: URL, authorId: "artist-key" });
      await expect(f.provider.sendRequest(URL, "permission request", "[moingfans:test]")).resolves.toEqual({ commentId: "101" });
      expect(f.submissions()).toBe(1);
    } finally { await f.context.close(); }
  });

  it("rejects an iframe for a different article before inspecting its controls", async () => {
    const f = await fixture();
    try {
      await f.page.route(URL, route => route.fulfill({ contentType: "text/html", body: '<a class="signed-in" href="/ca-fe/cafes/30182989/members/operator-key">operator</a><iframe id="cafe_main" src="https://cafe.naver.com/ca-fe/cafes/30182989/articles/99999"></iframe>' }));
      const provider = createCafeBrowserProvider({ page: f.page, selectors: { ...selectors, frame: "#cafe_main" }, operatorMemberKey: "operator-key", timeoutMs: 500 });
      await expect(provider.inspect(URL)).rejects.toThrow("Cafe browser: frame points to a different article");
      expect(f.submissions()).toBe(0);
    } finally { await f.context.close(); }
  });

  it("rejects duplicate comment identities instead of trusting the first author", async () => {
    const f = await fixture({ comments: [
      { id: "1", parentId: null, authorId: "artist-key", text: "yes" },
      { id: "1", parentId: null, authorId: "other", text: "no" },
    ] });
    try { await expect(f.provider.inspect(URL)).rejects.toThrow(/comment identity/); }
    finally { await f.context.close(); }
  });

  it("rejects external images and oversized comment collections", async () => {
    const imageFixture = await fixture({ extra: '<img class="art" src="https://evil.test/picture.png">' });
    try { await expect(imageFixture.provider.inspect(URL)).rejects.toThrow(/image source/); }
    finally { await imageFixture.context.close(); }
    const commentFixture = await fixture({ comments: Array.from({ length: 101 }, (_, i) => ({ id: String(i), parentId: null, authorId: "artist", text: "hello" })) });
    try { await expect(commentFixture.provider.inspect(URL)).rejects.toThrow(/too many comments/); }
    finally { await commentFixture.context.close(); }
  });
});
