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

  const errors = [];

  // 1. Buscar usuario en auth por email
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!listRes.ok) {
    return Response.json({ error: 'No se pudo consultar usuarios de auth' }, { status: listRes.status });
  }
  const listData = await listRes.json();
  const authUser = (listData.users || []).find(u => u.email === email);

  // 2. Eliminar de auth.users (si existe)
  if (authUser?.id) {
    const delAuth = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!delAuth.ok) errors.push(`auth.users: ${delAuth.status}`);
  }

  // 3. Eliminar de cloud_licenses
  const delLic = await fetch(`${SUPABASE_URL}/rest/v1/cloud_licenses?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
  if (!delLic.ok) errors.push(`cloud_licenses: ${delLic.status}`);

  // 4. Eliminar de account_devices
  const delDev = await fetch(`${SUPABASE_URL}/rest/v1/account_devices?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
  if (!delDev.ok) errors.push(`account_devices: ${delDev.status}`);

  // 5. Eliminar de cloud_backups (si existe)
  const delBack = await fetch(`${SUPABASE_URL}/rest/v1/cloud_backups?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
  });
  if (!delBack.ok) errors.push(`cloud_backups: ${delBack.status}`);

  if (errors.length > 0) {
    return Response.json({ ok: false, error: `Errores parciales: ${errors.join(', ')}` }, { status: 207 });
  }

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
