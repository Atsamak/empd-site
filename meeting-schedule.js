const CAMEROON_TIME_ZONE = 'Africa/Douala';
const MEETING_DAYS = new Set([4, 5]); // Thursday and Friday
const MEETING_START_HOUR_UTC = 16; // 17:00 in Cameroon (UTC+1)
const MEETING_DURATION_MS = 60 * 60 * 1000;

function cameroonNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMEROON_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function nextMeeting(now = new Date()) {
  const { year, month, day } = cameroonNowParts(now);
  const today = Date.UTC(year, month - 1, day);
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(today + offset * 86400000);
    if (!MEETING_DAYS.has(date.getUTCDay())) continue;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), MEETING_START_HOUR_UTC));
    const end = new Date(start.getTime() + MEETING_DURATION_MS);
    if (now < end) return { start, end, active: now >= start };
  }
  return null;
}

function formatMeetingDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: CAMEROON_TIME_ZONE,
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(date);
}

function updateMeetingCountdown(root) {
  const now = new Date();
  const meeting = nextMeeting(now);
  if (!meeting) return;
  const target = meeting.active ? meeting.end : meeting.start;
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  root.querySelector('[data-meeting-date]').textContent = formatMeetingDate(meeting.start);
  root.querySelector('[data-meeting-status]').textContent = meeting.active
    ? 'La rencontre est en cours - fin a 18 h 00'
    : 'Prochaine rencontre au centre EMPD';
  root.querySelector('[data-meeting-countdown]').textContent = meeting.active ? 'Fin dans' : 'Debut dans';
  root.querySelector('[data-days]').textContent = String(days).padStart(2, '0');
  root.querySelector('[data-hours]').textContent = String(hours).padStart(2, '0');
  root.querySelector('[data-minutes]').textContent = String(minutes).padStart(2, '0');
  root.querySelector('[data-seconds]').textContent = String(seconds).padStart(2, '0');
}

function mountMeetingSchedule() {
  const hero = document.querySelector('.hero');
  if (!hero || document.querySelector('#empd-meeting-schedule')) return;
  hero.insertAdjacentHTML('afterend', `
    <section class="meeting-schedule" id="empd-meeting-schedule" aria-labelledby="meeting-title">
      <div class="wrap meeting-schedule-inner">
        <div class="meeting-copy">
          <span class="eyebrow">Rendez-vous au centre EMPD</span>
          <h2 id="meeting-title">Grandissons ensemble dans la Parole.</h2>
          <p class="meeting-days">Chaque jeudi et chaque vendredi - de 17 h 00 a 18 h 00</p>
          <p class="meeting-location">Au centre EMPD - heure du Cameroun (UTC+1)</p>
        </div>
        <div class="meeting-countdown" aria-live="polite">
          <strong data-meeting-status>Prochaine rencontre au centre EMPD</strong>
          <span class="meeting-date" data-meeting-date></span>
          <span class="meeting-countdown-label" data-meeting-countdown>Debut dans</span>
          <div class="meeting-time-units" aria-label="Compte a rebours">
            <div><b data-days>00</b><small>Jours</small></div>
            <div><b data-hours>00</b><small>Heures</small></div>
            <div><b data-minutes>00</b><small>Minutes</small></div>
            <div><b data-seconds>00</b><small>Secondes</small></div>
          </div>
        </div>
      </div>
    </section>
  `);
  const root = document.querySelector('#empd-meeting-schedule');
  updateMeetingCountdown(root);
  window.setInterval(() => updateMeetingCountdown(root), 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMeetingSchedule, { once: true });
} else {
  mountMeetingSchedule();
}
