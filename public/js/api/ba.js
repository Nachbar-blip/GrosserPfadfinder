/**
 * api/ba.js — Links auf die offiziellen Seiten der Bundesagentur für Arbeit.
 *
 * KEIN fetch! Die BA-Jobsuche-API blockt Browser-fetch per CORS (X-API-Key
 * erzwingt einen Preflight ohne Access-Control-Allow-Origin — verifiziert,
 * offenes Issue seit 2021). Backend-frei lösen wir das, indem wir die
 * vorbefüllte offizielle Suchseite in einem neuen Tab öffnen. Siehe
 * docs/datenquellen.md. Damit bleibt CSP connect-src 'self'.
 */

function enc(s) {
  return encodeURIComponent(s || '');
}

/** Berufsname für die Suche säubern (Schrägstrich-Formen wie "Tischler/in" → "Tischler"). */
function suchname(beruf) {
  return (beruf.name || '').replace(/\s*\/.*$/, '').replace(/\(.*?\)/g, '').trim();
}

/**
 * Link zu konkreten Ausbildungsstellen / Studienangeboten "in der Nähe".
 * @returns {{url:string, label:string}}
 */
export function stellenLink(beruf, ort, umkreisKm) {
  const was = suchname(beruf);
  if (beruf.ausbildungsart === 'studium') {
    return {
      url: `https://web.arbeitsagentur.de/studiensuche/suche?suchbegriff=${enc(was)}`,
      label: 'Studienangebote ansehen',
    };
  }
  // betriebliche/schulische Ausbildung + duales Studium = angebotsart 4 (Ausbildung)
  const km = umkreisKm || 50;
  return {
    url: `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was=${enc(was)}&wo=${enc(ort || '')}&umkreis=${km}`,
    label: 'Ausbildungsstellen in deiner Nähe',
  };
}

/** Link zum vollständigen BERUFENET-Steckbrief (öffentliche Seite). */
export function berufenetLink(beruf) {
  return `https://web.arbeitsagentur.de/berufenet/beruf/${beruf.id}`;
}
