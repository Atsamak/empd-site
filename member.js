import { supabase, supabaseConfigured } from './supabaseClient.js';
const root = document.querySelector('#member-root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (!supabaseConfigured) {
  root.innerHTML = '<p class="admin-warning">Le service membre sera disponible après la configuration Supabase.</p>';
} else {
  const { data: { session } } = await supabase.auth.getSession();
  const recovery = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery'
    || new URLSearchParams(location.search).get('type') === 'recovery';
  if (!session) {
    location.href = '/connexion.html';
  } else if (recovery) {
    root.innerHTML = `<section class="cms-auth-card">
      <span class="eyebrow">Sécurité du compte</span><h1>Choisir un nouveau mot de passe</h1>
      <p>Saisis un nouveau mot de passe pour sécuriser ton compte EMPD.</p>
      <form id="recovery-form" class="cms-form">
        <label>Nouveau mot de passe<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        <label>Confirmer le mot de passe<input name="confirm" type="password" minlength="8" required autocomplete="new-password"></label>
        <button class="btn gold" type="submit">Mettre à jour le mot de passe</button>
      </form><p id="recovery-message" role="status" aria-live="polite"></p>
    </section>`;
    document.querySelector('#recovery-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const password = String(fd.get('password') || '');
      if (password !== String(fd.get('confirm') || '')) {
        document.querySelector('#recovery-message').textContent = 'Les deux mots de passe ne correspondent pas.';
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      document.querySelector('#recovery-message').textContent = error ? error.message : 'Mot de passe modifié. Tu peux maintenant utiliser ton nouveau mot de passe.';
      if (!error) history.replaceState(null, '', '/espace-membre.html');
    });
  } else {
    const user = session.user;
    const [{ data: profile }, { data: role }] = await Promise.all([
      supabase.from('profiles').select('full_name,created_at').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    ]);
    root.innerHTML = `<section class="cms-auth-card">
      <span class="eyebrow">Espace membre EMPD</span><h1>Bienvenue ${esc(profile?.full_name || user.email)}</h1>
      <p>Adresse e-mail : ${esc(user.email)}</p><p>Statut : ${role?.role === 'admin' ? 'Administrateur' : 'Membre'}</p>
      <form id="profile-form" class="cms-form"><label>Nom complet<input name="full_name" value="${esc(profile?.full_name || '')}" maxlength="100"></label><button class="btn gold">Mettre à jour mon profil</button></form>
      <div class="cms-member-links"><a class="btn outline" href="/publications.html">Lire les publications</a>${role?.role === 'admin' ? '<a class="btn gold" href="/admin.html">Ouvrir l’administration</a>' : ''}</div>
      <button class="btn outline" id="member-signout">Déconnexion</button>
    </section>`;
    document.querySelector('#profile-form').addEventListener('submit', async e => {
      e.preventDefault();
      const full_name = new FormData(e.currentTarget).get('full_name').trim();
      const { error } = await supabase.from('profiles').update({ full_name, updated_at: new Date().toISOString() }).eq('id', user.id);
      const message = document.createElement('p');
      message.textContent = error ? error.message : 'Profil mis à jour.';
      e.currentTarget.append(message);
    });
    document.querySelector('#member-signout').addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.href = '/connexion.html';
    });
  }
}