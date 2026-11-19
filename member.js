import { supabase, supabaseConfigured } from './supabaseClient.js';
const root = document.querySelector('#member-root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (!supabaseConfigured) {
  root.innerHTML = '<p class="admin-warning">Le service membre sera disponible après la configuration Supabase.</p>';
} else {
  const { data: { session } } = await supabase.auth.getSession();
  const recovery = ['recovery','invite'].includes(new URLSearchParams(location.hash.slice(1)).get('type'))
    || ['recovery','invite'].includes(new URLSearchParams(location.search).get('type'));
  if (!session) {
    location.href = '/connexion.html';
  } else if (recovery) {
    root.innerHTML = `<section class="cms-auth-card">
      <span class="eyebrow">Activation sécurisée du compte</span><h1>Choisir un mot de passe</h1>
      <p>Choisis ton mot de passe pour activer ou sécuriser ton compte EMPD.</p>
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
    const [{ data: profile, error: profileError }, { data: role }] = await Promise.all([
      supabase.from('profiles').select('full_name,created_at,newsletter_subscribed').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    ]);
    if (profileError) {
      root.innerHTML = `<section class="cms-auth-card"><h1>Profil indisponible</h1><p>${esc(profileError.message)}</p></section>`;
    } else {
      const subscribed = profile?.newsletter_subscribed === true;
      root.innerHTML = `<section class="cms-auth-card">
        <span class="eyebrow">Espace membre EMPD</span><h1>Bienvenue ${esc(profile?.full_name || user.email)}</h1>
        <p>Adresse e-mail : ${esc(user.email)}</p><p>Statut : ${role?.role === 'admin' ? 'Administrateur' : 'Membre'}</p>
        <form id="profile-form" class="cms-form"><label>Nom complet<input name="full_name" value="${esc(profile?.full_name || '')}" maxlength="100"></label><button class="btn gold">Mettre à jour mon profil</button></form>
        <section class="cms-newsletter-settings">
          <h2>Préférences e-mail</h2>
          <p>Choisis si tu souhaites recevoir les actualités, annonces et communications de l’EMPD.</p>
          <label class="cms-consent-option"><input id="newsletter-preference" type="checkbox" disabled ${subscribed ? 'checked' : ''}><span><b>${subscribed ? 'Abonné aux actualités EMPD' : 'Désabonné des actualités EMPD'}</b><small>Tu peux modifier ce choix à tout moment sans supprimer ton compte.</small></span></label>
          <button class="btn outline" id="save-newsletter" type="button">${subscribed ? 'Me désabonner' : 'Me réabonner'}</button>
          <p id="newsletter-message" role="status" aria-live="polite"></p>
        </section>
        <div class="cms-member-links"><a class="btn outline" href="/publications.html">Lire les publications</a>${role?.role === 'admin' ? '<a class="btn gold" href="/admin.html">Ouvrir l’administration</a>' : ''}</div>
        <button class="btn outline" id="member-signout">Déconnexion</button>
      </section>`;
      document.querySelector('#profile-form').addEventListener('submit', async e => {
        e.preventDefault();
        const full_name = String(new FormData(e.currentTarget).get('full_name') || '').trim();
        const { error } = await supabase.from('profiles').update({ full_name, updated_at: new Date().toISOString() }).eq('id', user.id);
        const message = document.createElement('p');
        message.textContent = error ? error.message : 'Profil mis à jour.';
        e.currentTarget.append(message);
      });
      document.querySelector('#save-newsletter').addEventListener('click', async e => {
        const button = e.currentTarget;
        const checkbox = document.querySelector('#newsletter-preference');
        const message = document.querySelector('#newsletter-message');
        const previousValue = checkbox.checked;
        const nextValue = !previousValue;
        checkbox.checked = nextValue;
        button.disabled = true;
        message.textContent = 'Enregistrement…';
        try {
          const { error } = await supabase.from('profiles')
            .update({ newsletter_subscribed: nextValue })
            .eq('id', user.id);
          if (error) throw error;
          checkbox.checked = nextValue;
          button.textContent = nextValue ? 'Me désabonner' : 'Me réabonner';
          checkbox.nextElementSibling.querySelector('b').textContent = nextValue
            ? 'Abonné aux actualités EMPD'
            : 'Désabonné des actualités EMPD';
          message.textContent = nextValue
            ? 'Ton réabonnement est enregistré.'
            : 'Ton désabonnement est enregistré. Tu ne recevras plus les actualités par e-mail.';
        } catch (error) {
          checkbox.checked = previousValue;
          message.textContent = error.message || 'Impossible d’enregistrer ce choix.';
        } finally {
          button.disabled = false;
        }
      });
    }
    document.querySelector('#member-signout')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.href = '/connexion.html';
    });
  }
}