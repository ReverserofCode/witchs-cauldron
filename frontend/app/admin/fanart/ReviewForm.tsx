"use client";

import { useState, type FormEvent } from "react";
import type { FanArtWork, ReviewInput, FanArtReviewStatus } from "@/app/lib/fanart/model";

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function iso(value: string) { return value ? new Date(value).toISOString() : null; }
const inputClass = "mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-sm text-purple-950";

export default function ReviewForm({ work, disabled, onSave }: { work: FanArtWork; disabled: boolean; onSave: (input: ReviewInput) => Promise<void> }) {
  const [display, setDisplay] = useState(work.permission.display);
  const [resize, setResize] = useState(work.permission.resize);
  const [credit, setCredit] = useState(work.permission.credit);
  const [requested, setRequested] = useState(Boolean(work.requestedAt));
  const [permissionDate, setPermissionDate] = useState(localDate(work.permission.confirmedAt));
  const [creatorDate, setCreatorDate] = useState(localDate(work.review.creatorConfirmedAt));
  const [reviewDate, setReviewDate] = useState(localDate(work.review.confirmedAt));
  const [evidence, setEvidence] = useState(work.permission.evidence);
  const [status, setStatus] = useState<FanArtReviewStatus>(work.review.status);
  const [note, setNote] = useState(work.review.note);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ requested, permission: { display, resize, credit, confirmedAt: iso(permissionDate), evidence }, review: { status, creatorConfirmedAt: iso(creatorDate), confirmedAt: iso(reviewDate), note } });
  }
  return <form onSubmit={submit}>
    <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
      <legend className="mb-3 font-semibold">2. 허락 및 제작 방식 확인</legend>
      <p className="text-xs text-purple-800">날짜는 현재 브라우저의 현지 시각입니다. 실제 확인한 내용만 기록해 주세요. 무응답은 동의가 아닙니다.</p>
      <label className="flex gap-2"><input type="checkbox" checked={requested} onChange={e => setRequested(e.target.checked)} />허락 요청을 직접 전달함</label>
      <label className="flex gap-2"><input type="checkbox" checked={display} onChange={e => setDisplay(e.target.checked)} />외부 사이트 이미지 표시 허락</label>
      <label className="flex gap-2"><input type="checkbox" checked={resize} onChange={e => setResize(e.target.checked)} />크기 조정·WebP 변환 허락</label>
      <label className="flex gap-2"><input type="checkbox" checked={credit} onChange={e => setCredit(e.target.checked)} />작가명·원문 링크 표기 허락</label>
      <label className="block">허락 확인일<input className={inputClass} type="datetime-local" value={permissionDate} onChange={e => setPermissionDate(e.target.value)} /></label>
      <label className="block">허락 증빙 메모<textarea className={inputClass} rows={2} maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
      <p className="text-xs text-purple-800">확인 위치·일시 등 최소 참조만 남기세요. 비밀번호, 쿠키, 연락처 전체, 대화 캡처는 저장하지 마세요. 이 기록은 공개되지 않습니다.</p>
      <label className="block">작가의 생성형 AI 미사용 확인일<input className={inputClass} type="datetime-local" value={creatorDate} onChange={e => setCreatorDate(e.target.value)} /></label>
      <label className="block">운영자 제작 방식 검수<select className={inputClass} value={status} onChange={e => setStatus(e.target.value as FanArtReviewStatus)}>
        <option value="pending">검수 대기</option><option value="confirmed_non_generative">생성형 AI 미사용 확인</option><option value="unclear">불명확 — 보류</option><option value="excluded_generative">생성형 AI 사용 — 게시 제외</option>
      </select></label>
      <label className="block">운영자 검수일<input className={inputClass} type="datetime-local" value={reviewDate} onChange={e => setReviewDate(e.target.value)} /></label>
      <label className="block">검수 메모 (선택)<textarea className={inputClass} rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <button type="submit" className="btn btn-primary">허락·검수 기록 저장</button>
    </fieldset>
  </form>;
}
