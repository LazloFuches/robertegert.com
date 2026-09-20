export async function onRequestGet({ env }) {
  const pw = env.ADMIN_PASSWORD;
  return new Response(JSON.stringify({
    ok: true,
    hasAdminPassword: !!pw,
    adminPasswordType: typeof pw,
    adminPasswordStr: typeof pw === 'object' ? JSON.stringify(pw) : String(pw).substring(0, 3) + '***',
    adminPasswordToString: pw != null ? String(pw).substring(0, 3) + '***' : 'null',
    envKeys: Object.keys(env),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
