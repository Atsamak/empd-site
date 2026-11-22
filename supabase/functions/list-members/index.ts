import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = 'https://www.wswg.cm';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  const origin = req.headers.get('origin');
  if (origin && origin !== allowedOrigin) return json({ error: 'Origine non autorisée.' }, 403);

  try {
    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return json({ error: 'Connexion administrateur requise.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
    const secretKey = secretKeysRaw
      ? JSON.parse(secretKeysRaw).default
      : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !secretKey) {
      console.error('Configuration serveur Supabase incomplète.');
      return json({ error: 'Le service membres est momentanément indisponible.' }, 500);
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Session invalide. Reconnecte-toi.' }, 401);

    const { data: callerRole, error: roleError } = await admin
      .from('user_roles').select('role').eq('user_id', authData.user.id).maybeSingle();
    if (roleError) throw roleError;
    if (callerRole?.role !== 'admin') return json({ error: 'Action réservée aux administrateurs.' }, 403);

    const allUsers = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const batch = data.users || [];
      allUsers.push(...batch);
      if (batch.length < 1000) break;
    }

    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, newsletter_subscribed'),
      admin.from('user_roles').select('user_id, role'),
    ]);
    if (profilesError) throw profilesError;
    if (rolesError) throw rolesError;

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const roleMap = new Map((roles || []).map((entry) => [entry.user_id, entry.role]));
    const members = allUsers.map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email || profile?.email || '',
        full_name: profile?.full_name || user.user_metadata?.full_name || '',
        role: roleMap.get(user.id) || 'member',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        banned_until: user.banned_until || null,
        newsletter_subscribed: profile?.newsletter_subscribed === true,
      };
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    return json({ ok: true, members, total: members.length });
  } catch (error) {
    console.error('list-members:', error instanceof Error ? error.message : 'Erreur inconnue');
    return json({ error: 'Impossible de charger la liste des membres.' }, 500);
  }
});
