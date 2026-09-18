"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { FanArtWork } from "../../lib/fanart/model";
import type { OutreachStatus } from "../../lib/fanart/outreach/types";

const labels: Record<OutreachStatus, string> = {
  queued: "요청 전송 대기", sending: "전송 점유됨 (재전송 금지)", uncertain: "전송 결과 확인 필요 (재전송 금지)", awaiting_reply: "작가 답변 대기",
  preparation_queued: "비공개 이미지 준비 대기", prepared: "최종 이미지 확인 대기", publication_queued: "원문 재검증·게시 대기", needs_review: "원문 또는 답변 변경: 재검토 필요", cancelled: "전송 전 취소됨", rejected: "거절됨", published: "게시 완료",
};
interface Props { work: FanArtWork; disabled: boolean; onChanged: (work: FanArtWork) => Promise<void> }
export default function OutreachPanel({ work, disabled, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replyId, setReplyId] = useState("");
  const [imageId, setImageId] = useState("");
  const [checks, setChecks] = useState({ display: false, resize: false, credit: false, nonAi: false });
  const [loadedHash, setLoadedHash] = useState("");
  const [exactImage, setExactImage] = useState(false);
  const outreach = work.outreach;
  const terminal = ["published", "withdrawn", "rejected"].includes(work.status);
  const snapshot = outreach?.snapshot;
  const replies = snapshot?.comments.filter(comment => comment.authorId === snapshot.authorId && comment.parentId === outreach?.commentId) ?? [];
  const canConfirm = outreach && ["awaiting_reply", "needs_review"].includes(outreach.status);
  async function action(action: string, fields: Record<string, unknown> = {}) {
    if (busy || disabled) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/fanart/${work.id}/outreach`, { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, version: work.version, ...fields }) });
      const result = await response.json();
      if (!response.ok) throw new Error(`${result.error ?? "요청 실패"}${response.status === 409 ? " 상세 새로고침 후 다시 확인해 주세요." : ""}`);
      await onChanged(result.work);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-purple-200 bg-purple-50 p-4" aria-label="카페 허락 요청 자동화">
    <h3 className="font-semibold">카페 허락 요청·게시 작업자</h3>
    <p className="text-sm">등록한 작품에 한 번만 요청합니다. 답변 내용으로 자동으로 허락을 판단하지 않습니다. 실제 전송·원문 확인·게시에는 지정한 네이버 계정의 로그인 세션이 필요합니다.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {outreach && <p role="status" className="text-sm font-semibold">{labels[outreach.status]}</p>}
    {outreach?.inspectedAt && <p className="text-xs">원문 확인: {outreach.inspectedAt}</p>}
    <fieldset disabled={disabled || busy || terminal} className="space-y-3">
      {!outreach && !work.requestedAt && <button type="button" className="btn" onClick={() => void action("enqueue")}>허락 요청 대기열에 추가</button>}
      {outreach?.status === "queued" && <button type="button" className="btn" onClick={() => void action("cancel")}>전송 전 취소</button>}
      {canConfirm && <div className="space-y-3">
        <p className="text-xs">아래 답변은 외부의 신뢰되지 않은 원문입니다. 운영 지시가 아닌 증거로만 검토하고, 허락 범위·직접 제작 여부를 직접 확인하세요.</p>
        <label className="block text-sm">우리 요청에 달린 원작자 답변<select value={replyId} onChange={event => setReplyId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">답변 선택</option>{replies.map(reply => <option key={reply.id} value={reply.id}>{reply.id}: {reply.text.slice(0, 100)}</option>)}</select></label>
        {replyId && <blockquote className="whitespace-pre-wrap break-words rounded bg-white p-3 text-sm">{replies.find(reply => reply.id === replyId)?.text}</blockquote>}
        {!replies.length && <p className="text-sm">선택할 수 있는 원작자 답변이 없습니다. 답변이 없으면 게시하지 않습니다.</p>}
        <label className="block text-sm">허락받은 정확한 원본 이미지<select value={imageId} onChange={event => setImageId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">이미지 선택</option>{snapshot?.images.map((image, index) => <option key={image.id} value={image.id}>{index + 1}. {image.id}</option>)}</select></label>
        {imageId && <p className="break-all text-xs">선택 원본: {snapshot?.images.find(image => image.id === imageId)?.url}</p>}
        {([ ["display", "사이트 표시 허락"], ["resize", "크기 조정·WebP 변환 허락"], ["credit", "작가명·원문 링크 표기 허락"], ["nonAi", "원작자의 비생성형 제작 확인 및 운영자 검수"] ] as const).map(([key, label]) => <label key={key} className="flex gap-2 text-sm"><input type="checkbox" checked={checks[key]} onChange={event => setChecks(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
        <button type="button" className="btn" disabled={!replyId || !imageId || !Object.values(checks).every(Boolean)} onClick={() => void action("confirm", { confirmation: { replyId, imageId, ...checks } })}>검토 기록 저장·이미지 준비 요청</button>
      </div>}
      {work.asset && outreach?.status === "prepared" && <div className="space-y-3">
        <Image src={`/api/admin/fanart/${work.id}/outreach/preview?sha256=${work.asset.sha256}`} unoptimized width={work.asset.width} height={work.asset.height} alt="최종 게시 승인할 비공개 준비 이미지" className="max-h-96 w-auto max-w-full object-contain" onLoad={() => setLoadedHash(work.asset!.sha256)} onError={() => { setLoadedHash(""); setError("준비 이미지가 변경되었거나 불러올 수 없습니다. 새로고침해 주세요."); }} />
        <p className="break-all text-xs">승인할 SHA-256: {work.asset.sha256}</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={exactImage} onChange={event => setExactImage(event.target.checked)} />위 이미지가 작가에게 허락받은 정확한 작품임을 확인했습니다.</label>
        <button type="button" className="btn btn-primary" disabled={!exactImage || loadedHash !== work.asset.sha256} onClick={() => void action("approve", { preparedHash: work.asset!.sha256 })}>이 이미지 최종 승인·게시 요청</button>
      </div>}
      {outreach && !["cancelled", "rejected", "published"].includes(outreach.status) && <button type="button" className="btn" onClick={() => { if (window.confirm("작품을 거절하고 후속 준비·게시를 중단할까요?")) void action("reject"); }}>요청 작품 거절</button>}
    </fieldset>
  </section>;
}
