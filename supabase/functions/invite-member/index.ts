import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://www.wswg.cm',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const origin = req.headers.get('origin');
  if (origin && origin !== 'https://www.wswg.cm') {
    return json({ error: 'Origine non autorisée.' }, 403);
  }

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
      return json({ error: 'Le service d’invitation est momentanément indisponible.' }, 500);
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Session invalide. Reconnecte-toi.' }, 401);

    const { data: callerRole, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (callerRole?.role !== 'admin') return json({ error: 'Action réservée aux administrateurs.' }, 403);

    const payload = await req.json();
    const email = String(payload.email || '').trim().toLowerCase();
    const role = payload.role === 'admin' ? 'admin' : 'member';
    const fullName = String(payload.full_name || '').trim().slice(0, 100);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Saisis une adresse e-mail valide.' }, 400);
    }
    if (email === String(authData.user.email || '').toLowerCase()) {
      return json({ error: 'Tu es déjà connecté avec cette adresse.' }, 400);
    }

    const { data: invitation, error: inviteError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: 'https://www.wswg.cm/espace-membre.html',
        data: { full_name: fullName },
      },
    });

    if (inviteError) {
      const message = inviteError.message.toLowerCase().includes('already') ||
        inviteError.message.toLowerCase().includes('registered')
        ? 'Cette adresse possède déjà un compte. Retrouve-la dans la liste des membres pour modifier son rôle.'
        : inviteError.message;
      return json({ error: message }, 400);
    }
    const invitedUser = invitation.user;
    const actionLink = invitation.properties?.action_link;
    if (!invitedUser || !actionLink) return json({ error: 'Le lien d’invitation n’a pas pu être créé.' }, 500);

    const { error: updateError } = await admin
      .from('user_roles')
      .upsert({ user_id: invitedUser.id, role }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('Lien créé, mais attribution du rôle impossible:', updateError.message);
      return json({
        error: 'Le lien a été créé, mais le rôle n’a pas pu être attribué. Actualise la liste des membres et réessaie.',
      }, 500);
    }

    return json({ ok: true, email, role, user_id: invitedUser.id, invitation_link: actionLink });
  } catch (error) {
    console.error('invite-member:', error instanceof Error ? error.message : 'Erreur inconnue');
    return json({ error: 'Une erreur est survenue pendant l’envoi de l’invitation.' }, 500);
  }
});
