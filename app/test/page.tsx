import { ReactElement } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

export default function TestPage(): ReactElement {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sandbox"
        title="테스트 페이지"
        description="기본 레이아웃과 스타일이 올바르게 적용되었는지 확인할 수 있는 샌드박스 영역입니다."
      />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">빠른 체크리스트</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm text-slate-600 dark:text-slate-300">
          <li>공통 헤더/푸터가 표시되는지 확인하세요.</li>
          <li>Tailwind 유틸리티 클래스가 정상 적용되는지 확인하세요.</li>
          <li>
            <Link className="text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400" href="/api/health">
              헬스체크 API
            </Link>{' '}
            응답이 200인지 확인하세요.
          </li>
        </ul>
      </section>
    </div>
  )
}
