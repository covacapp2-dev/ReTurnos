// ============================================
// ReTurnos - Edge Function: admin-api
//
// Panel de administración (solo la cuenta admin).
//   action: 'list'          → lista todos los usuarios con su negocio
//   action: 'grant_forever' → suscripción permanente (gratis para siempre)
//   action: 'delete_user'   → elimina el usuario y todo lo suyo
//   action: 'notify'        → manda un mensaje a la campanita de todos
//
// Secretos: SUPABASE_SERVICE_ROLE_KEY (se crea solo)
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const ADMIN_EMAIL = 'covacapp2@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function listAllUserIds(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  const perPage = 200;

  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    ids.push(...users.map((u) => u.id));
    if (users.length < perPage) break;
    page++;
  }

  return ids;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'No autorizado' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Quién pide ---
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: 'No autorizado' }, 401);
    const requester = authData.user;

    // --- Solo la cuenta admin ---
    if ((requester.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
      return json({ error: 'Solo el administrador puede hacer esto' }, 403);
    }

    const body = await req.json();
    const action = body?.action as string;

    // ---------- LISTAR USUARIOS ----------
    if (action === 'list') {
      const { data: usersData, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (error) return json({ error: error.message }, 500);

      const users = usersData?.users ?? [];
      const ids = users.map((u) => u.id);

      const [profilesRes, businessesRes] = await Promise.all([
        admin
          .from('profiles')
          .select('id, email, full_name, created_at')
          .in('id', ids),
        admin
          .from('businesses')
          .select(
            'id, owner_id, name, slug, subscription_status, trial_ends_at, subscription_ends_at, created_at'
          )
          .in('owner_id', ids),
      ]);

      const profiles = profilesRes.data ?? [];
      const businesses = businessesRes.data ?? [];

      const rows = users.map((u) => {
        const profile = profiles.find((p) => p.id === u.id);
        const biz = businesses.find((b) => b.owner_id === u.id);
        return {
          id: u.id,
          email: u.email ?? profile?.email ?? '',
          name: profile?.full_name ?? '',
          created_at: u.created_at,
          business_id: biz?.id ?? null,
          business_name: biz?.name ?? null,
          subscription_status: biz?.subscription_status ?? null,
          trial_ends_at: biz?.trial_ends_at ?? null,
          subscription_ends_at: biz?.subscription_ends_at ?? null,
        };
      });

      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return json({ users: rows });
    }

    // ---------- GRATIS PARA SIEMPRE ----------
    if (action === 'grant_forever') {
      const userId: string = body?.user_id;
      if (!userId) return json({ error: 'Falta el usuario' }, 400);

      const { data: biz } = await admin
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();

      if (!biz) {
        return json({
          error: 'Este usuario todavía no tiene negocio (todavía no ingresó a la app)',
        }, 404);
      }

      const { error } = await admin
        .from('businesses')
        .update({
          subscription_status: 'active',
          subscription_started_at: new Date().toISOString(),
          subscription_ends_at: null,
          trial_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', biz.id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ---------- ELIMINAR USUARIO ----------
    if (action === 'delete_user') {
      const userId: string = body?.user_id;
      if (!userId) return json({ error: 'Falta el usuario' }, 400);
      if (userId === requester.id) return json({ error: 'No podés eliminarte a vos mismo' }, 400);

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ---------- MENSAJE A TODOS (campanita) ----------
    if (action === 'notify') {
      const title: string = (body?.title ?? '').toString().trim();
      const message: string = (body?.message ?? '').toString().trim();
      if (!title || !message) return json({ error: 'Faltan el título o el mensaje' }, 400);

      const ids = await listAllUserIds(admin);
      if (ids.length === 0) return json({ ok: true, sent: 0 });

      const rows = ids.map((id) => ({ user_id: id, title, message }));
      const { error } = await admin.from('user_notifications').insert(rows);
      if (error) return json({ error: error.message }, 500);

      return json({ ok: true, sent: rows.length });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error en admin-api' }, 500);
  }
});
