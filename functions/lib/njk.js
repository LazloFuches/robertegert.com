export function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();

  const fm = {};
  fm.title = (yamlStr.match(/^title:\s*(.+)$/m) || [])[1] || '';
  fm.year = (yamlStr.match(/^year:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
  fm.layout = (yamlStr.match(/^layout:\s*(.+)$/m) || [])[1] || 'project.njk';
  const summaryMatch = yamlStr.match(/^summary:\s*(.+)$/m);
  if (summaryMatch) fm.summary = summaryMatch[1];

  fm.images = [];
  const imageBlocks = yamlStr.split(/\n  - src:/);
  for (let i = 1; i < imageBlocks.length; i++) {
    const block = '  - src:' + imageBlocks[i];
    const img = {};
    const srcMatch = block.match(/src:\s*(.+)/);
    const titleMatch = block.match(/title:\s*(.+)/);
    const mediumMatch = block.match(/medium:\s*(.+)/);
    const dimMatch = block.match(/dimensions:\s*(.+)/);
    const dateMatch = block.match(/date:\s*"?(.+?)"?\s*$/m);
    const collMatch = block.match(/collection:\s*(.+)/);

    img.src = srcMatch ? srcMatch[1].trim() : '';
    img.title = titleMatch ? titleMatch[1].trim() : '';
    img.medium = mediumMatch ? mediumMatch[1].trim() : '';
    img.dimensions = dimMatch ? dimMatch[1].trim() : '';
    img.date = dateMatch ? dateMatch[1].trim() : '';
    img.collection = collMatch ? collMatch[1].trim() : '';

    if (img.src) fm.images.push(img);
  }

  return { frontmatter: fm, body };
}

export function buildNjkContent(fm) {
  let yaml = `---\ntitle: ${fm.title}\nyear: "${fm.year}"\nlayout: ${fm.layout || 'project.njk'}\n`;
  if (fm.summary) yaml += `summary: ${fm.summary}\n`;
  yaml += 'images:\n';

  for (const img of fm.images) {
    yaml += `  - src: ${img.src}\n`;
    yaml += `    title: ${img.title}\n`;
    yaml += `    medium: ${img.medium}\n`;
    yaml += `    dimensions: ${img.dimensions}\n`;
    yaml += `    date: "${img.date}"\n`;
    yaml += `    collection: ${img.collection || ''}\n`;
  }

  yaml += '---';
  return yaml;
}
