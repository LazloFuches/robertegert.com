import { getFile } from '../_lib/github.js';

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
