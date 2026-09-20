export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    hasAdminPassword: !!env.ADMIN_PASSWORD,
    hasJwtSecret: !!env.JWT_SECRET,
    hasGithubToken: !!env.GITHUB_TOKEN,
    hasGithubRepo: !!env.GITHUB_REPO,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
