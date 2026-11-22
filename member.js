import { supabase, supabaseConfigured } from './supabaseClient.js';

const root = document.querySelector('#member-root');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

if (!root) {
  console.error('Conteneur de l’espace membre introuvable.');
} else if (!supabaseConfigured) {
  root.innerHTML = '<section class="cms-auth-card"><h1>Service membre momentanément indisponible</h1><p>La connexion à la base de données n’est pas configurée. Réessaie un peu plus tard.</p><a class="btn outline" href="/">Retour à l’accueil</a></section>';
} else {
  const params = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const recovery = ['recovery','invite'].includes(params.get('type')) || ['recovery','invite'].includes(query.get('type'));

  async function currentSession() {
    let result = await supabase.auth.getSession();
    if (result.error) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session) return refreshed.data.session;
    }
    if (result.data.session) return result.data.session;
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.error ? null : refreshed.data.session;
  }

  const session = await currentSession();
  if (!session) {
    location.replace('/connexion.html?redirect=%2Fespace-membre.html');
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
    document.querySelector('#recovery-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const password = String(data.get('password') || '');
      const message = document.querySelector('#recovery-message');
      if (password !== String(data.get('confirm') || '')) {
        message.textContent = 'Les deux mots de passe ne correspondent pas.';
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      message.textContent = error ? error.message : 'Mot de passe modifié. Tu peux maintenant utiliser ton nouveau mot de passe.';
      if (!error) history.replaceState(null, '', '/espace-membre.html');
    });
  } else {
    const user = session.user;
    let profileResult = await supabase.from('profiles')
      .select('id,full_name,email,created_at,newsletter_subscribed')
      .eq('id', user.id).maybeSingle();

    // Une session ancienne peut encore être présente dans le navigateur : renouveler le jeton puis retenter la lecture.
    if (profileResult.error) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session) {
        profileResult = await supabase.from('profiles')
          .select('id,full_name,email,created_at,newsletter_subscribed')
          .eq('id', user.id).maybeSingle();
      }
    }

    const { data: roleData, error: roleError } = await supabase.from('user_roles')
      .select('role').eq('user_id', user.id).maybeSingle();
    const profile = profileResult.data || {
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
      newsletter_subscribed: user.user_metadata?.newsletter_subscribed === true
    };
    const subscribed = profile.newsletter_subscribed === true;
    const profileWarning = profileResult.error
      ? '<p class="member-inline-warning" role="status">Certaines informations du profil ne sont pas encore accessibles. Tu peux consulter ton espace et réessayer le chargement.</p><button class="btn outline" id="retry-profile" type="button">Réessayer</button>'
      : '';
    const roleLabel = roleData?.role === 'admin' ? 'Administrateur' : 'Membre';

    root.innerHTML = `<section class="cms-auth-card">
      <span class="eyebrow">Espace membre EMPD</span>
      <h1>Bienvenue ${esc(profile.full_name || user.email)}</h1>
      <p>Adresse e-mail : ${esc(user.email)}</p>
      <p>Statut : ${esc(roleLabel)}${roleError ? ' (vérification momentanément indisponible)' : ''}</p>
      ${profileWarning}
      <form id="profile-form" class="cms-form">
        <label>Nom complet<input name="full_name" value="${esc(profile.full_name || '')}" maxlength="100"></label>
        <button class="btn gold" type="submit">Mettre à jour mon profil</button>
      </form>
      <section class="cms-newsletter-settings">
        <h2>Préférences e-mail</h2>
        <p>Choisis si tu souhaites recevoir les actualités, annonces et communications de l’EMPD.</p>
        <label class="cms-consent-option"><input id="newsletter-preference" type="checkbox" disabled ${subscribed ? 'checked' : ''}><span><b>${subscribed ? 'Abonné aux actualités EMPD' : 'Désabonné des actualités EMPD'}</b><small>Tu peux modifier ce choix à tout moment sans supprimer ton compte.</small></span></label>
        <button class="btn outline" id="save-newsletter" type="button">${subscribed ? 'Me désabonner' : 'Me réabonner'}</button>
        <p id="newsletter-message" role="status" aria-live="polite"></p>
      </section>
      <div class="cms-member-links"><a class="btn outline" href="/publications.html">Lire les publications</a>${roleData?.role === 'admin' ? '<a class="btn gold" href="/admin.html">Ouvrir l’administration</a>' : ''}</div>
      <button class="btn outline" id="member-signout" type="button">Déconnexion</button>
    </section>`;

    document.querySelector('#retry-profile')?.addEventListener('click', () => location.reload());

    document.querySelector('#profile-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const full_name = String(new FormData(form).get('full_name') || '').trim();
      const button = form.querySelector('button');
      button.disabled = true;
      let message = form.querySelector('[role="status"]');
      if (!message) {
        message = document.createElement('p');
        message.setAttribute('role', 'status');
        form.append(message);
      }
      try {
        const { data, error } = await supabase.from('profiles')
          .update({ full_name, updated_at: new Date().toISOString() })
          .eq('id', user.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Aucune fiche de profil associée à ce compte. Contacte l’administration EMPD.');
        message.textContent = 'Profil mis à jour.';
      } catch (error) {
        message.textContent = error.message || 'Impossible de mettre à jour le profil pour le moment.';
      } finally {
        button.disabled = false;
      }
    });

    document.querySelector('#save-newsletter').addEventListener('click', async event => {
      const button = event.currentTarget;
      const checkbox = document.querySelector('#newsletter-preference');
      const message = document.querySelector('#newsletter-message');
      const previousValue = checkbox.checked;
      const nextValue = !previousValue;
      checkbox.checked = nextValue;
      button.disabled = true;
      message.textContent = 'Enregistrement…';
      try {
        const { data, error } = await supabase.from('profiles')
          .update({ newsletter_subscribed: nextValue })
          .eq('id', user.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('La fiche de profil est introuvable. Réessaie après avoir rechargé la page.');
        button.textContent = nextValue ? 'Me désabonner' : 'Me réabonner';
        checkbox.nextElementSibling.querySelector('b').textContent = nextValue
          ? 'Abonné aux actualités EMPD' : 'Désabonné des actualités EMPD';
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

    document.querySelector('#member-signout')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.href = '/connexion.html';
    });
  }
}
