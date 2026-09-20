import { getFile, deleteFile, createAtomicCommit } from '../../../_lib/github.js';
import { parseYamlFrontmatter, buildNjkContent } from '../../../_lib/njk.js';

export async function onRequestDelete({ request, env, params }) {
  const { slug } = params;
  try {
    const { src } = await request.json();
    if (!src) {
      return new Response(JSON.stringify({ error: 'src is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imagePath = src.startsWith('/') ? 'src' + src : src;

    const { content: njkRaw } = await getFile(env, `src/projects/${slug}.njk`, 'dev');
    const { frontmatter } = parseYamlFrontmatter(njkRaw);
    frontmatter.images = frontmatter.images.filter(img => img.src !== src);

    const { content: projRaw } = await getFile(env, 'src/_data/projects.json', 'dev');
    const projects = JSON.parse(projRaw);
    const pi = projects.findIndex(p => p.slug === slug);
    if (pi !== -1) {
      projects[pi].count = frontmatter.images.length;
      if (projects[pi].thumbnail === src) {
        projects[pi].thumbnail = frontmatter.images.length > 0
          ? frontmatter.images[0].src
          : '/assets/images/placeholder.jpg';
      }
    }

    const { sha: imgSha } = await getFile(env, imagePath, 'dev');
    await deleteFile(env, imagePath, imgSha, `Remove image from ${slug} via admin`);

    await createAtomicCommit(env, 'dev', [
      { path: `src/projects/${slug}.njk`, content: buildNjkContent(frontmatter) },
      { path: 'src/_data/projects.json', content: JSON.stringify(projects, null, 2) + '\n' },
    ], `Update ${slug} metadata after image removal via admin`);

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
