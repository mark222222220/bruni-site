// Управление сотрудниками: только для руководителя. Секретный ключ есть только на сервере Supabase.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const DOMAIN = 'staff.avp-glasshouse.ru';
const ROLES = ['boss', 'acc', 'sales', 'store'];
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // кто вызывает
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(token);
  if (!who?.user) return json({ error: 'Войдите заново' }, 401);
  const { data: me } = await admin.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
  if (me?.role !== 'boss') return json({ error: 'Только руководитель управляет сотрудниками' }, 403);

  const body = await req.json().catch(() => ({}));
  const login = String(body.login ?? '').trim().toLowerCase();
  const email = login.includes('@') ? login : `${login}@${DOMAIN}`;

  if (body.action === 'list') {
    const { data: profiles } = await admin.from('profiles').select('id,name,role,created_at').order('created_at');
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const byId = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? '']));
    return json({ staff: (profiles ?? []).map((p) => ({ ...p, login: String(byId.get(p.id) ?? '').replace(`@${DOMAIN}`, '') })) });
  }

  if (body.action === 'create') {
    const name = String(body.name ?? '').trim();
    const role = String(body.role ?? '');
    const password = String(body.password ?? '');
    if (!name || !/^[a-z0-9._-]{3,30}$|@/.test(login)) return json({ error: 'Имя и логин латиницей, от 3 символов' }, 400);
    if (!ROLES.includes(role)) return json({ error: 'Неизвестная роль' }, 400);
    if (password.length < 8) return json({ error: 'Пароль — от 8 символов' }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (error) return json({ error: /already/i.test(error.message) ? 'Такой логин уже есть' : error.message }, 400);
    await admin.from('profiles').upsert({ id: data.user.id, name, role });
    return json({ ok: true });
  }

  if (body.action === 'update') {
    const id = String(body.id ?? '');
    const patch: Record<string, string> = {};
    if (body.role && ROLES.includes(body.role)) patch.role = body.role;
    if (body.name) patch.name = String(body.name).trim();
    if (id === who.user.id && patch.role && patch.role !== 'boss') return json({ error: 'Нельзя снять роль руководителя с себя' }, 400);
    if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', id);
    if (body.password) {
      if (String(body.password).length < 8) return json({ error: 'Пароль — от 8 символов' }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password: String(body.password) });
      if (error) return json({ error: error.message }, 400);
    }
    return json({ ok: true });
  }

  if (body.action === 'remove') {
    const id = String(body.id ?? '');
    if (id === who.user.id) return json({ error: 'Нельзя удалить себя' }, 400);
    await admin.auth.admin.deleteUser(id);
    return json({ ok: true });
  }

  return json({ error: 'Неизвестное действие' }, 400);
});
