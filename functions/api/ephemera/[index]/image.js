import { getFile, deleteFile, listDirectory, createAtomicCommit } from '../../../_lib/github.js';

export async function onRequestPost({ request, env, params }) {
  const index = parseInt(params.index, 10);
  try {
    const formData = await request.formData();
    const images = formData.getAll('images');
    const validImages = images.filter(img => img && img.size > 0);

    if (validImages.length === 0) {
      return new Response(JSON.stringify({ error: 'No images provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { content: ephRaw } = await getFile(env, 'src/_data/ephemera.json', 'dev');
    const ephemera = JSON.parse(ephRaw);

    if (isNaN(index) || index < 0 || index >= ephemera.length) {
      return new Response(JSON.stringify({ error: 'Invalid index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const files = await listDirectory(env, 'src/assets/images/ephemera', 'dev');
    const numbered = files
      .filter(f => f.type === 'file' && /^\d{2}\.jpg$/.test(f.name))
      .map(f => parseInt(f.name, 10));
    let next = (numbered.length > 0 ? Math.max(...numbered) : 0) + 1;

    const changes = [];
    const newPaths = [];

    for (const image of validImages) {
      const filename = String(next).padStart(2, '0') + '.jpg';
      const imgPath = `/assets/images/ephemera/${filename}`;
      newPaths.push(imgPath);

      const buf = await image.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let j = 0; j < bytes.length; j += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(j, j + 8192));
      }
      const base64 = btoa(binary);

      changes.push({
        path: `src/assets/images/ephemera/${filename}`,
        content: base64,
        encoding: 'base64',
      });
      next++;
    }

    ephemera[index].images = (ephemera[index].images || []).concat(newPaths);

    changes.push({
      path: 'src/_data/ephemera.json',
      content: JSON.stringify(ephemera, null, 2) + '\n',
    });

    await createAtomicCommit(env, 'dev', changes, `Add images to ephemera "${ephemera[index].title}" via admin`);

    return new Response(JSON.stringify({ ok: true, imagePaths: newPaths }), {
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

export async function onRequestDelete({ request, env, params }) {
  const index = parseInt(params.index, 10);
  try {
    const { src } = await request.json();
    if (!src) {
      return new Response(JSON.stringify({ error: 'src is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { content: ephRaw } = await getFile(env, 'src/_data/ephemera.json', 'dev');
    const ephemera = JSON.parse(ephRaw);

    if (isNaN(index) || index < 0 || index >= ephemera.length) {
      return new Response(JSON.stringify({ error: 'Invalid index' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entry = ephemera[index];
    entry.images = (entry.images || []).filter(img => img !== src);

    const filePath = src.startsWith('/') ? 'src' + src : src;
    try {
      const { sha } = await getFile(env, filePath, 'dev');
      await deleteFile(env, filePath, sha, `Remove image from ephemera via admin`);
    } catch (_) {}

    await createAtomicCommit(env, 'dev', [
      { path: 'src/_data/ephemera.json', content: JSON.stringify(ephemera, null, 2) + '\n' },
    ], `Remove image from ephemera "${entry.title}" via admin`);

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
