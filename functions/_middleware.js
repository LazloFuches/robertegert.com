import { verifyJWT } from './lib/jwt.js';

export const onRequest = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (url.hostname === 'my-art-site-48k.pages.dev') {
    return Response.redirect(`https://robertegert.com${url.pathname}${url.search}`, 301);
  }

  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/login') {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const token = auth.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    context.data = { ...context.data, user: payload };
  }

  return next();
};
