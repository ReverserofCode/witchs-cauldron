export async function GET() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    status: 200,
  });
}
