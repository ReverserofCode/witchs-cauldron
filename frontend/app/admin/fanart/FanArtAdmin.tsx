"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { permissionRequest, type FanArtStatus, type FanArtWork } from "@/app/lib/fanart/model";
import type { FanArtAuditEvent } from "@/app/lib/fanart/repository";
import ReviewForm from "./ReviewForm";
import OutreachPanel from "./OutreachPanel";

const states: Record<FanArtStatus, string> = { candidate: "후보", requested: "허락 요청", ready: "게시 준비", published: "게시 중", withdrawn: "철회", rejected: "거절" };
const fieldClass = "mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-sm";
type Audit = FanArtAuditEvent;
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 409 ? `${data?.error ?? "저장 충돌"} 상세 새로고침 후 확인해 주세요.` : data?.error ?? `요청 실패 (${response.status}). 관리자 인증 및 설정을 확인해 주세요.`);
  return data as T;
}
function json(method: string, body: unknown): RequestInit { return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }; }
function fetchWorks(filter: string, offset: number) {
  return api<{ works: FanArtWork[]; hasMore: boolean }>(`/api/admin/fanart?limit=20&offset=${offset}${filter ? `&status=${filter}` : ""}`);
}

export default function FanArtAdmin() {
  const [works, setWorks] = useState<FanArtWork[]>([]);
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<FanArtWork | null>(null);
  const [events, setEvents] = useState<Audit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const listGeneration = useRef(0);
  const loadList = useCallback(async () => {
    const generation = ++listGeneration.current;
    try {
      const result = await fetchWorks(filter, offset);
      if (generation === listGeneration.current) { setWorks(result.works); setHasMore(result.hasMore); }
    } catch (failure) { if (generation === listGeneration.current) setError((failure as Error).message); }
  }, [filter, offset]);
  useEffect(() => {
    let active = true;
    const generation = ++listGeneration.current;
    fetchWorks(filter, offset).then(result => {
      if (active && generation === listGeneration.current) { setWorks(result.works); setHasMore(result.hasMore); }
    }).catch(failure => { if (active && generation === listGeneration.current) setError((failure as Error).message); });
    return () => { active = false; };
  }, [filter, offset]);

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  async function open(work: FanArtWork) {
    const result = await api<{ work: FanArtWork; events: Audit[] }>(`/api/admin/fanart/${work.id}`);
    setSelected(result.work); setEvents(result.events); setFile(null);
  }
  async function changed(work: FanArtWork, text: string) { await open(work); setMessage(text); await loadList(); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await run(async () => {
      const result = await api<{ work: FanArtWork }>("/api/admin/fanart", json("POST", { sourceUrl: values.get("sourceUrl"), title: values.get("title"), credit: values.get("credit") }));
      await changed(result.work, "후보를 등록했습니다. 아직 이미지는 공개되지 않습니다."); form.reset();
    });
  }
  async function action(name: "publish" | "withdraw" | "reject", text: string) {
    if (!selected) return;
    if (name !== "publish" && !window.confirm(`「${selected.title}」 작품을 ${name === "withdraw" ? "철회" : "거절"}할까요? 이 버전에서는 다시 게시할 수 없습니다.`)) return;
    await run(async () => {
      const result = await api<{ work: FanArtWork }>(`/api/admin/fanart/${selected.id}/${name}`, json("POST", { version: selected.version }));
      await changed(result.work, text);
    });
  }
  const editable = selected && !["published", "withdrawn", "rejected"].includes(selected.status);
  const manualEditable = editable && (!selected.outreach || selected.outreach.status === "cancelled");
  const canUpload = manualEditable && selected.permission.display && selected.permission.resize && selected.permission.credit && selected.permission.confirmedAt && selected.permission.evidence.trim() && selected.review.creatorConfirmedAt && selected.review.confirmedAt && selected.review.status === "confirmed_non_generative";

  return <main className="mx-auto max-w-6xl px-4 py-10 text-purple-950">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">팬아트 검수함</h1><p className="mt-2 text-sm">작품별 허락과 검수 후 게시합니다. 등록 후보만 요청하며, 실제 카페 작업은 전용 로그인 작업자가 수행합니다.</p></div><a href="/admin/analytics" className="btn">방문 분석</a></div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-green-900">{message}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 space-y-5">
        <form onSubmit={create} className="rounded-2xl border border-purple-200 bg-white p-5">
          <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 font-semibold">원문 등록</legend>
            <label className="block">원문 URL<input name="sourceUrl" type="url" maxLength={2048} required className={fieldClass} placeholder="https://cafe.naver.com/moinge/123" /></label>
            <label className="block">작품 제목<input name="title" maxLength={200} required className={fieldClass} /></label>
            <label className="block">작가 표기명<input name="credit" maxLength={100} required className={fieldClass} /></label>
            <p className="text-xs text-purple-700">등록 후 원문·제목·작가명은 수정할 수 없습니다. 등록 전에 확인해 주세요.</p>
            <button type="submit" className="btn btn-primary">후보 등록</button>
          </fieldset>
        </form>
        <div className="rounded-2xl border border-purple-200 bg-white p-5">
          <label>상태 필터<select className={fieldClass} disabled={busy} value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}><option value="">전체</option>{Object.entries(states).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <ul className="my-3 divide-y divide-purple-100">{works.map(work => <li key={work.id}><button disabled={busy} type="button" className="w-full break-words py-3 text-left hover:text-purple-600" onClick={() => void run(() => open(work))}>{work.title}<span className="ml-2 text-xs">{states[work.status]} · {work.credit}</span><span className="block text-xs text-purple-700">{new Date(work.updatedAt).toLocaleString("ko-KR")}</span></button></li>)}</ul>
          {!works.length && <p className="my-3 text-sm">목록에 작품이 없습니다.</p>}
          <div className="flex gap-2"><button className="btn" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>이전</button><button className="btn" disabled={busy || !hasMore} onClick={() => setOffset(offset + 20)}>다음</button></div>
        </div>
      </section>
      <section className="min-w-0 rounded-2xl border border-purple-200 bg-white p-5">
        {!selected ? <p>작품을 등록하거나 목록에서 선택해 주세요.</p> : <div className="space-y-6">
          <header className="space-y-2"><h2 className="break-words text-xl font-bold">{selected.title}</h2><p className="text-sm">{selected.credit} · {states[selected.status]} · 버전 {selected.version}</p><a className="text-sm underline" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">팬카페 원문 보기</a><button className="btn ml-3" disabled={busy} onClick={() => void run(() => open(selected))}>상세 새로고침</button></header>
          <div><h3 className="mb-2 font-semibold">1. 허락 요청문</h3><textarea aria-label="허락 요청문" readOnly value={permissionRequest(selected)} rows={7} className={fieldClass} /><button className="btn mt-2" disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(permissionRequest(selected)); setMessage("요청문을 복사했습니다. 운영자가 직접 전달해 주세요."); })}>요청문 복사</button></div>
          <OutreachPanel key={`outreach:${selected.id}:${selected.version}`} work={selected} disabled={busy} onChanged={work => changed(work, "요청 작업 상태를 저장했습니다. 대기 작업은 독립 작업자가 처리합니다.")} />
          <ReviewForm key={`${selected.id}:${selected.version}`} work={selected} disabled={busy || !manualEditable} onSave={input => run(async () => {
            const result = await api<{ work: FanArtWork }>(`/api/admin/fanart/${selected.id}`, json("PATCH", { version: selected.version, review: input })); await changed(result.work, "허락·검수 기록을 저장했습니다.");
          })} />
          <div className="space-y-3"><h3 className="font-semibold">3. 허락받은 파일 준비</h3><p className="text-xs">PNG/JPEG/WebP 단일 이미지, 최대 10 MiB. 파일 교체 시 작가 확인과 운영자 검수를 다시 기록해야 합니다.</p>
            <label className="block">허락받은 이미지 파일<input key={`${selected.id}:${selected.version}`} className={fieldClass} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !canUpload} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
            <button className="btn" disabled={busy || !canUpload || !file} onClick={() => void run(async () => { if (!file) return; const body = new FormData(); body.set("version", String(selected.version)); body.set("file", file); const result = await api<{ work: FanArtWork }>(`/api/admin/fanart/${selected.id}/asset`, { method: "POST", body }); await changed(result.work, "이미지를 준비했습니다."); })}>이미지 업로드</button>
            {selected.asset && <p className="text-xs">준비된 이미지: {selected.asset.width}×{selected.asset.height}px · {Math.ceil(selected.asset.bytes / 1024)} KiB</p>}
          </div>
          <div className="space-y-3"><h3 className="font-semibold">4. 게시 및 철회</h3><div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !manualEditable || selected.status !== "ready"} onClick={() => void action("publish", "작업실에 게시했습니다.")}>게시 승인</button>
            <button className="btn" disabled={busy || selected.status !== "published"} onClick={() => void action("withdraw", "게시를 철회했습니다.")}>게시 철회</button>
            <button className="btn" disabled={busy || !editable} onClick={() => void action("reject", "후보를 거절했습니다.")}>후보 거절</button>
          </div><p className="text-xs">철회·거절한 원문은 다시 등록할 수 없습니다. 기존 정적 팬아트의 철회는 별도 작업이 필요합니다.</p></div>
          <details><summary className="cursor-pointer font-semibold">처리 기록</summary><ul className="mt-2 space-y-1 text-xs">{events.map(event => <li key={event.id}>{new Date(event.createdAt).toLocaleString("ko-KR")} · {event.type} · v{event.version}</li>)}</ul></details>
        </div>}
      </section>
    </div>
  </main>;
}
