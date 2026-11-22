import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = 'https://www.wswg.cm';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    const secretKey = secretKeysRaw ? JSON.parse(secretKeysRaw).default : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !secretKey) return json({ error: 'Le service de gestion des rôles est indisponible.' }, 500);
    const admin = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Session invalide. Reconnecte-toi.' }, 401);
    const { data: callerRole, error: callerError } = await admin.from('user_roles').select('role').eq('user_id', authData.user.id).maybeSingle();
    if (callerError) throw callerError;
    if (callerRole?.role !== 'admin') return json({ error: 'Action réservée aux administrateurs.' }, 403);
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const role = body.role;
    if (!userId || !['admin', 'member'].includes(role)) return json({ error: 'Compte ou rôle invalide.' }, 400);
    if (userId === authData.user.id) return json({ error: 'Tu ne peux pas modifier ton propre rôle depuis cette action.' }, 400);
    const { data: target, error: targetError } = await admin.from('user_roles').select('user_id, role').eq('user_id', userId).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return json({ error: 'Ce compte est introuvable.' }, 404);
    if (target.role === role) return json({ ok: true, role });
    const { error: updateError } = await admin.rpc('set_member_role', { p_user_id: userId, p_role: role });
    if (updateError) {
      if (updateError.code === '23514') return json({ error: 'Impossible de retirer les droits du dernier administrateur. Désigne d’abord un autre administrateur.' }, 409);
      if (updateError.code === 'P0002') return json({ error: 'Ce compte est introuvable.' }, 404);
      throw updateError;
    }
    return json({ ok: true, user_id: userId, role });
  } catch (error) {
    console.error('set-member-role:', error instanceof Error ? error.message : 'Erreur inconnue');
    return json({ error: 'Impossible de modifier le rôle de ce compte.' }, 500);
  }
});