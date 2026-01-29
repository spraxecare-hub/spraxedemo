import { headers } from 'next/headers';
import { getSiteUrl } from '@/lib/supabase/server';
import { getRequestOrigin } from '@/lib/site-url.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const h = headers();
  const origin = getRequestOrigin(getSiteUrl());

  const obj = {
    origin,
    host: h.get('host'),
    x_forwarded_host: h.get('x-forwarded-host'),
    x_forwarded_proto: h.get('x-forwarded-proto'),
    user_agent: h.get('user-agent'),
    via: h.get('via'),
    cf_ray: h.get('cf-ray'),
  };

  return new Response(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}
