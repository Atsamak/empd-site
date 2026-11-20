import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = 'https://empd-site.vercel.app';
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
    if (!supabaseUrl || !secretKey) return json({ error: 'Service de gestion des membres indisponible.' }, 500);
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Session invalide. Reconnecte-toi.' }, 401);
    const { data: callerRole, error: callerError } = await admin.from('user_roles')
      .select('role').eq('user_id', authData.user.id).maybeSingle();
    if (callerError) throw callerError;
    if (callerRole?.role !== 'admin') return json({ error: 'Action réservée aux administrateurs.' }, 403);
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const action = body.action;
    if (!userId || !['deactivate', 'reactivate', 'delete'].includes(action)) return json({ error: 'Compte ou action invalide.' }, 400);
    if (userId === authData.user.id) return json({ error: 'Tu ne peux pas désactiver ou supprimer ton propre compte.' }, 400);
    const { data: targetRole, error: targetRoleError } = await admin.from('user_roles')
      .select('role').eq('user_id', userId).maybeSingle();
    if (targetRoleError) throw targetRoleError;
    const role = targetRole?.role || 'member';
    if (action === 'delete') {
      if (role === 'admin') {
        const { count, error: countError } = await admin.from('user_roles')
          .select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
        if (countError) throw countError;
        if ((count ?? 0) <= 1) return json({ error: 'Impossible de supprimer le dernier administrateur. Désigne d’abord un autre administrateur.' }, 409);
      }
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
      return json({ ok: true, action, user_id: userId });
    }
    const banDuration = action === 'deactivate' ? '876000h' : 'none';
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
    if (updateError) throw updateError;
    return json({ ok: true, action, user_id: userId });
  } catch (error) {
    console.error('manage-member:', error instanceof Error ? error.message : 'Erreur inconnue');
    return json({ error: error instanceof Error ? error.message : 'Impossible de traiter ce compte.' }, 500);
  }
});