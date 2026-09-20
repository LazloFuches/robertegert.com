import { getFile, listDirectory, createAtomicCommit } from '../_lib/github.js';

function extractYear(dateStr) {
  const match = dateStr.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function onRequestGet({ env }) {
  try {
    const { content } = await getFile(env, 'src/_data/ephemera.json', 'dev');
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

export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const title = formData.get('title');
    const type = formData.get('type');
    const date = formData.get('date');
    const description = formData.get('description') || '';

    if (!title || !type || !date) {
      return new Response(JSON.stringify({ error: 'Title, type, and date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { content: ephRaw } = await getFile(env, 'src/_data/ephemera.json', 'dev');
    const ephemera = JSON.parse(ephRaw);

    const gallery = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const changes = [];
    let imageSrc = null;

    if (image && image.size > 0) {
      const files = await listDirectory(env, 'src/assets/images/ephemera', 'dev');
      const numbered = files
        .filter(f => f.type === 'file' && /^\d{2}\.jpg$/.test(f.name))
        .map(f => parseInt(f.name, 10));
      const next = (numbered.length > 0 ? Math.max(...numbered) : 0) + 1;
      const filename = String(next).padStart(2, '0') + '.jpg';
      imageSrc = `/assets/images/ephemera/${filename}`;

      const buf = await image.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

      changes.push({
        path: `src/assets/images/ephemera/${filename}`,
        content: base64,
        encoding: 'base64',
      });
    }

    const entry = {
      type,
      title,
      date,
      images: imageSrc ? [imageSrc] : [],
      gallery,
      description: description || title,
      alt: title,
      text: description ? [description] : [title],
      download: null,
      externalLink: null,
    };

    const newYear = extractYear(date);
    let insertIndex = 0;
    for (let i = 0; i < ephemera.length; i++) {
      if (extractYear(ephemera[i].date) >= newYear) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    ephemera.splice(insertIndex, 0, entry);

    changes.push({
      path: 'src/_data/ephemera.json',
      content: JSON.stringify(ephemera, null, 2) + '\n',
    });

    await createAtomicCommit(env, 'dev', changes, `Add ephemera "${title}" via admin`);

    return new Response(JSON.stringify({ ok: true, imagePath: imageSrc }), {
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
