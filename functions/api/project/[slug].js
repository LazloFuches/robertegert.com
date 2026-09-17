import { getFile } from '../../lib/github.js';
import { parseYamlFrontmatter, buildNjkContent } from '../../lib/njk.js';

export async function onRequestGet({ env, params }) {
  const { slug } = params;
  try {
    const { content, sha } = await getFile(env, `src/projects/${slug}.njk`, 'dev');
    const { frontmatter } = parseYamlFrontmatter(content);
    return new Response(JSON.stringify({ slug, sha, ...frontmatter }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPut({ request, env, params }) {
  const { slug } = params;
  try {
    const updates = await request.json();
    const { content, sha } = await getFile(env, `src/projects/${slug}.njk`, 'dev');
    const { frontmatter } = parseYamlFrontmatter(content);

    if (updates.images) frontmatter.images = updates.images;
    if (updates.title) frontmatter.title = updates.title;
    if (updates.year) frontmatter.year = updates.year;

    const newContent = buildNjkContent(frontmatter);

    const API = 'https://api.github.com';
    const res = await fetch(`${API}/repos/${env.GITHUB_REPO}/contents/src/projects/${slug}.njk`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'robertegert-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update ${frontmatter.title} via admin`,
        content: btoa(newContent),
        sha,
        branch: 'dev',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status}: ${body}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
