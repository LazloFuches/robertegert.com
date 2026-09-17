import { signJWT } from '../../lib/jwt.js';

function timeSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequestPost({ request, env }) {
  const { password } = await request.json();

  if (!password || !timeSafeEqual(password, env.ADMIN_PASSWORD)) {
    await new Promise(r => setTimeout(r, 500));
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT({ sub: 'admin', iat: now, exp: now + 86400 }, env.JWT_SECRET);

  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
