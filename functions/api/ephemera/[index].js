import { getFile, deleteFile, createAtomicCommit } from '../../_lib/github.js';

export async function onRequestPut({ request, env, params }) {
  const index = parseInt(params.index, 10);
  try {
    const updates = await request.json();
    const { content: ephRaw } = await getFile(env, 'src/_data/ephemera.json', 'dev');
    const ephemera = JSON.parse(ephRaw);

    if (isNaN(index) || index < 0 || index >= ephemera.length) {
      return new Response(JSON.stringify({ error: 'Invalid index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = ephemera[index];

    if (updates.title !== undefined) {
      entry.title = updates.title;
      entry.alt = updates.title;
      entry.gallery = updates.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (updates.type !== undefined) entry.type = updates.type;
    if (updates.date !== undefined) entry.date = updates.date;
    if (updates.description !== undefined) {
      entry.description = updates.description;
      entry.text = updates.description ? [updates.description] : [entry.title];
    }
    if (updates.externalLink !== undefined) entry.externalLink = updates.externalLink || null;

    await createAtomicCommit(env, 'dev', [
      { path: 'src/_data/ephemera.json', content: JSON.stringify(ephemera, null, 2) + '\n' },
    ], `Update ephemera "${entry.title}" via admin`);

    return new Response(JSON.stringify({ ok: true, entry }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete({ env, params }) {
  const index = parseInt(params.index, 10);
  try {
    const { content: ephRaw } = await getFile(env, 'src/_data/ephemera.json', 'dev');
    const ephemera = JSON.parse(ephRaw);

    if (isNaN(index) || index < 0 || index >= ephemera.length) {
      return new Response(JSON.stringify({ error: 'Invalid index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = ephemera[index];
    const title = entry.title;

    for (const imgPath of (entry.images || [])) {
      const filePath = imgPath.startsWith('/') ? 'src' + imgPath : imgPath;
      try {
        const { sha } = await getFile(env, filePath, 'dev');
        await deleteFile(env, filePath, sha, `Remove ephemera image via admin`);
      } catch (_) {}
    }

    ephemera.splice(index, 1);

    await createAtomicCommit(env, 'dev', [
      { path: 'src/_data/ephemera.json', content: JSON.stringify(ephemera, null, 2) + '\n' },
    ], `Remove ephemera "${title}" via admin`);

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
