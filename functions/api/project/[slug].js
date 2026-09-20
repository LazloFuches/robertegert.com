import { getFile, createAtomicCommit } from '../../_lib/github.js';
import { parseYamlFrontmatter, buildNjkContent } from '../../_lib/njk.js';

async function getProjectsData(env) {
  const { content, sha } = await getFile(env, 'src/_data/projects.json', 'dev');
  return { projects: JSON.parse(content), sha };
}

export async function onRequestGet({ env, params }) {
  const { slug } = params;
  try {
    const { content, sha } = await getFile(env, `src/projects/${slug}.njk`, 'dev');
    const { frontmatter } = parseYamlFrontmatter(content);
    const { projects } = await getProjectsData(env);
    const meta = projects.find(p => p.slug === slug) || {};

    return new Response(JSON.stringify({
      slug, sha,
      ...frontmatter,
      studio: meta.studio || '',
      section: meta.section || 'catalogue',
      thumbnail: meta.thumbnail || '',
      count: meta.count || 0,
    }), {
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
    const { content } = await getFile(env, `src/projects/${slug}.njk`, 'dev');
    const { frontmatter } = parseYamlFrontmatter(content);
    const { projects } = await getProjectsData(env);
    const projectIndex = projects.findIndex(p => p.slug === slug);

    if (updates.images) frontmatter.images = updates.images;
    if (updates.title) frontmatter.title = updates.title;
    if (updates.year) frontmatter.year = updates.year;

    const changes = [{
      path: `src/projects/${slug}.njk`,
      content: buildNjkContent(frontmatter),
    }];

    let needsProjectsUpdate = false;
    if (projectIndex !== -1) {
      if (updates.title) { projects[projectIndex].title = updates.title; needsProjectsUpdate = true; }
      if (updates.year) { projects[projectIndex].year = updates.year; needsProjectsUpdate = true; }
      if (updates.studio !== undefined) { projects[projectIndex].studio = updates.studio; needsProjectsUpdate = true; }
      if (updates.section) { projects[projectIndex].section = updates.section; needsProjectsUpdate = true; }
      if (updates.thumbnail) { projects[projectIndex].thumbnail = updates.thumbnail; needsProjectsUpdate = true; }
    }

    if (needsProjectsUpdate) {
      changes.push({
        path: 'src/_data/projects.json',
        content: JSON.stringify(projects, null, 2) + '\n',
      });
    }

    const message = updates.thumbnail
      ? `Set thumbnail for ${frontmatter.title} via admin`
      : `Update ${frontmatter.title} via admin`;

    await createAtomicCommit(env, 'dev', changes, message);

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
