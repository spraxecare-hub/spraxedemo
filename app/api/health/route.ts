// Simple health check endpoint for Render (or any load balancer).
// Keeps the app easy to monitor and prevents "unhealthy" routing issues.

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response('ok', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Avoid CDN/proxy caching stale health statuses
      'cache-control': 'no-store, max-age=0',
    },
  });
}
