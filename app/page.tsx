import { ReactElement } from 'react'

export default function Page(): ReactElement {
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">Next.js 시작 ✅</h1>
      <p className="text-gray-600 dark:text-gray-300">
        Docker + Windows/OneDrive 환경 최적화 구성입니다.
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>홈: /</li>
        <li>
          테스트 페이지: <a className="text-blue-600 hover:underline" href="/test">/test</a>
        </li>
        <li>
          헬스체크 API: <a className="text-blue-600 hover:underline" href="/api/health">/api/health</a>
        </li>
      </ul>
    </main>
  );
}
