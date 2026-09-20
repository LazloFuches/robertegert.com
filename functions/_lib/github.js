const API = 'https://api.github.com';

async function gh(env, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'robertegert-admin',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${body}`);
  }
  return res.json();
}

function repo(env) {
  return `/repos/${env.GITHUB_REPO}`;
}

export async function getFile(env, path, branch = 'dev') {
  const data = await gh(env, `${repo(env)}/contents/${path}?ref=${branch}`);
  const content = atob(data.content.replace(/\n/g, ''));
  return { content, sha: data.sha };
}

export async function listDirectory(env, path, branch = 'dev') {
  return gh(env, `${repo(env)}/contents/${path}?ref=${branch}`);
}

export async function putFile(env, path, content, sha, message, branch = 'dev') {
  return gh(env, `${repo(env)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: btoa(content), sha, branch }),
  });
}

export async function createAtomicCommit(env, branch, changes, message) {
  const ref = await gh(env, `${repo(env)}/git/ref/heads/${branch}`);
  const commitSha = ref.object.sha;
  const commit = await gh(env, `${repo(env)}/git/commits/${commitSha}`);
  const baseSha = commit.tree.sha;

  const tree = changes.map(c => ({
    path: c.path,
    mode: '100644',
    type: 'blob',
    ...(c.encoding === 'base64'
      ? { sha: undefined }
      : { content: c.content }),
  }));

  const blobPromises = changes
    .filter(c => c.encoding === 'base64')
    .map(async (c) => {
      const blob = await gh(env, `${repo(env)}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: c.content, encoding: 'base64' }),
      });
      return { path: c.path, sha: blob.sha };
    });

  const blobs = await Promise.all(blobPromises);

  const treeEntries = changes.map(c => {
    const blobMatch = blobs.find(b => b.path === c.path);
    if (blobMatch) {
      return { path: c.path, mode: '100644', type: 'blob', sha: blobMatch.sha };
    }
    return { path: c.path, mode: '100644', type: 'blob', content: c.content };
  });

  const newTree = await gh(env, `${repo(env)}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseSha, tree: treeEntries }),
  });

  const newCommit = await gh(env, `${repo(env)}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [commitSha] }),
  });

  await gh(env, `${repo(env)}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha;
}

export async function compareBranches(env, base, head) {
  return gh(env, `${repo(env)}/compare/${base}...${head}`);
}

export async function createPR(env, head, base, title, body) {
  return gh(env, `${repo(env)}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head, base }),
  });
}

export async function mergePR(env, pullNumber) {
  return gh(env, `${repo(env)}/pulls/${pullNumber}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'merge' }),
  });
}

export async function deleteFile(env, path, sha, message, branch = 'dev') {
  return gh(env, `${repo(env)}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

export async function listPRs(env, head, base, state = 'open') {
  return gh(env, `${repo(env)}/pulls?head=${env.GITHUB_REPO.split('/')[0]}:${head}&base=${base}&state=${state}`);
}
