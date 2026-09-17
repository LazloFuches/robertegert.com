import { compareBranches, listPRs } from '../lib/github.js';

export async function onRequestGet({ env }) {
  try {
    let ahead = 0;
    let files = [];
    try {
      const comparison = await compareBranches(env, 'main', 'dev');
      ahead = comparison.ahead_by || 0;
      files = (comparison.files || []).map(f => f.filename);
    } catch (e) {
      if (!e.message.includes('404')) throw e;
    }

    const prs = await listPRs(env, 'dev', 'main', 'open');
    const hasOpenPR = prs.length > 0;
    const prUrl = hasOpenPR ? prs[0].html_url : null;
    const prNumber = hasOpenPR ? prs[0].number : null;

    return new Response(JSON.stringify({ ahead, files, hasOpenPR, prUrl, prNumber }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
