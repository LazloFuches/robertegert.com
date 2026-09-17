import { createPR, mergePR, listPRs } from '../lib/github.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'pr';

    if (action === 'merge') {
      const prs = await listPRs(env, 'dev', 'main', 'open');
      if (prs.length === 0) {
        return new Response(JSON.stringify({ error: 'No open PR to merge' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await mergePR(env, prs[0].number);
      return new Response(JSON.stringify({ ok: true, merged: true, prUrl: prs[0].html_url }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const existing = await listPRs(env, 'dev', 'main', 'open');
    if (existing.length > 0) {
      return new Response(JSON.stringify({ ok: true, prUrl: existing[0].html_url, existing: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pr = await createPR(
      env,
      'dev',
      'main',
      body.title || 'Update artwork via admin panel',
      body.body || 'Changes made through the online admin panel.'
    );

    return new Response(JSON.stringify({ ok: true, prUrl: pr.html_url, prNumber: pr.number }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
