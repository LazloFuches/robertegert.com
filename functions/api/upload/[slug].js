import { getFile, listDirectory, createAtomicCommit } from '../../lib/github.js';
import { parseYamlFrontmatter, buildNjkContent } from '../../lib/njk.js';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function onRequestPost({ request, env, params }) {
  const { slug } = params;

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');
    const metadataStr = formData.get('metadata');

    if (!imageFile || !metadataStr) {
      return new Response(JSON.stringify({ error: 'Missing image or metadata' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const metadata = JSON.parse(metadataStr);
    const imageBuffer = await imageFile.arrayBuffer();
    const imageBase64 = arrayBufferToBase64(imageBuffer);

    const [dirListing, njkFile, projectsFile] = await Promise.all([
      listDirectory(env, `src/assets/images/${slug}`, 'dev'),
      getFile(env, `src/projects/${slug}.njk`, 'dev'),
      getFile(env, 'src/_data/projects.json', 'dev'),
    ]);

    const numbered = dirListing
      .filter(f => /^\d{2}\.jpg$/.test(f.name))
      .map(f => parseInt(f.name, 10));
    const nextNum = (numbered.length > 0 ? Math.max(...numbered) : 0) + 1;
    const filename = String(nextNum).padStart(2, '0') + '.jpg';
    const imagePath = `src/assets/images/${slug}/${filename}`;
    const imageSrc = `/assets/images/${slug}/${filename}`;

    const { frontmatter } = parseYamlFrontmatter(njkFile.content);
    const newImage = {
      src: imageSrc,
      title: metadata.title || '',
      medium: metadata.medium || '',
      dimensions: metadata.dimensions || '',
      date: metadata.date || '',
      collection: metadata.collection || '',
    };
    frontmatter.images.unshift(newImage);
    const updatedNjk = buildNjkContent(frontmatter);

    const projects = JSON.parse(projectsFile.content);
    const project = projects.find(p => p.slug === slug);
    if (project) project.count = (project.count || 0) + 1;
    const updatedProjects = JSON.stringify(projects, null, 2);

    const commitSha = await createAtomicCommit(env, 'dev', [
      { path: imagePath, content: imageBase64, encoding: 'base64' },
      { path: `src/projects/${slug}.njk`, content: updatedNjk },
      { path: 'src/_data/projects.json', content: updatedProjects },
    ], `Add "${metadata.title}" to ${frontmatter.title} via admin`);

    return new Response(JSON.stringify({
      ok: true,
      imagePath: imageSrc,
      filename,
      commitSha,
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
