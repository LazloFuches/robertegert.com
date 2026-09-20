import { getFile, createAtomicCommit } from '../_lib/github.js';
import { buildNjkContent } from '../_lib/njk.js';

export async function onRequestGet({ env }) {
  try {
    const { content } = await getFile(env, 'src/_data/projects.json', 'dev');
    return new Response(content, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const { projects } = await request.json();
    if (!Array.isArray(projects)) {
      return new Response(JSON.stringify({ error: 'projects must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await createAtomicCommit(env, 'dev', [{
      path: 'src/_data/projects.json',
      content: JSON.stringify(projects, null, 2) + '\n',
    }], 'Reorder collections via admin');

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

export async function onRequestPost({ request, env }) {
  try {
    const { title, year, studio, section } = await request.json();
    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { content: projContent } = await getFile(env, 'src/_data/projects.json', 'dev');
    const projects = JSON.parse(projContent);

    if (projects.some(p => p.slug === slug)) {
      return new Response(JSON.stringify({ error: 'A collection with this name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = {
      title: title.trim(),
      slug,
      year: year || new Date().getFullYear().toString(),
      studio: studio || '',
      thumbnail: '/assets/images/placeholder.jpg',
      count: 0,
      section: section || 'catalogue',
    };

    projects.unshift(entry);

    const njkContent = buildNjkContent({
      title: entry.title,
      year: entry.year,
      layout: 'project.njk',
      images: [],
    });

    await createAtomicCommit(env, 'dev', [
      { path: 'src/_data/projects.json', content: JSON.stringify(projects, null, 2) + '\n' },
      { path: `src/projects/${slug}.njk`, content: njkContent },
    ], `Create collection "${entry.title}" via admin`);

    return new Response(JSON.stringify({ ok: true, slug }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
