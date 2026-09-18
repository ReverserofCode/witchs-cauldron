import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OutreachPanel from "../../admin/fanart/OutreachPanel";
import { createCandidate } from "./model";
describe("outreach administrator controls", () => {
  it("offers deliberate request queueing and explains that no consent is inferred", () => {
    const work = createCandidate({ sourceUrl: "https://cafe.naver.com/moinge/123", title: "그림", credit: "작가" }, "2026-09-18T00:00:00Z");
    const html = renderToStaticMarkup(createElement(OutreachPanel, { work, disabled: false, onChanged: async () => {} }));
    expect(html).toContain("허락 요청 대기열에 추가"); expect(html).toContain("자동으로 허락을 판단하지 않습니다");
  });
  it("shows uncertain sends as held, never as retryable", () => {
    const work = createCandidate({ sourceUrl: "https://cafe.naver.com/moinge/123", title: "그림", credit: "작가" }, "2026-09-18T00:00:00Z");
    work.outreach = { status: "uncertain", marker: "marker", queuedAt: work.createdAt };
    const html = renderToStaticMarkup(createElement(OutreachPanel, { work, disabled: false, onChanged: async () => {} }));
    expect(html).toContain("전송 결과 확인 필요"); expect(html).not.toContain("허락 요청 대기열에 추가");
  });
});
