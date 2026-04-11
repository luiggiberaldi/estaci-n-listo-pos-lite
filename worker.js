const SUPABASE_URL = 'https://fgzwmwrugerptfqfrsjd.supabase.co';

async function handleDeleteUser(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) {
    return Response.json({ error: 'No configurado' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { email } = body;
  if (!email) return Response.json({ error: 'email requerido' }, { status: 400 });

  // 1. Buscar usuario en auth por email
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const listData = await listRes.json();
  const authUser = (listData.users || []).find(u => u.email === email);

  // 2. Eliminar de auth.users (si existe)
  if (authUser?.id) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }

  // 3. Eliminar de cloud_licenses
  await fetch(`${SUPABASE_URL}/rest/v1/cloud_licenses?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });

  // 4. Eliminar de account_devices
  await fetch(`${SUPABASE_URL}/rest/v1/account_devices?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });

  // 5. Eliminar de cloud_backups (si existe)
  await fetch(`${SUPABASE_URL}/rest/v1/cloud_backups?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });

  return Response.json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/delete-user') {
      return handleDeleteUser(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
