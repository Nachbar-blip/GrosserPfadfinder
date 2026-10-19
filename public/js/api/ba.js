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

/**
 * Studienfach-Name für die Studiensuche: nur den Klammerzusatz entfernen
 * ("Verwaltungsinformatik (grundständig)" → "Verwaltungsinformatik").
 */
function studienname(beruf) {
  return (beruf.name || '').replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Link zu konkreten Ausbildungsstellen / Studienangeboten "in der Nähe".
 * URL-Formate am 2026-10-19 im Browser geprüft (docs/datenquellen.md §4.1).
 * @returns {{url:string, label:string}}
 */
export function stellenLink(beruf, ort, umkreisKm) {
  if (beruf.ausbildungsart === 'studium') {
    // ssw = Suchbegriff, sty=0 = Suchtyp „Suchbegriffe“, st=0 = nur grundständige Studiengänge.
    // (Der frühere Parameter `suchbegriff` wird ignoriert → man landete auf der leeren Startseite.)
    return {
      url: `https://web.arbeitsagentur.de/studiensuche/suche?sty=0&ssw=${enc(studienname(beruf))}&st=0`,
      label: 'Studienangebote ansehen',
    };
  }
  // betriebliche/schulische Ausbildung + duales Studium = angebotsart 4 (Ausbildung).
  // Den offiziellen BERUFENET-Namen 1:1 übergeben: Die Jobbörse erkennt ihn als Beruf
  // („Medizinische/r Fachangestellte/r" → genau dieser Beruf). Früher wurde ab dem ersten
  // „/" abgeschnitten → Suche nach „Medizinische", „Kaufmann", „Fachpraktiker" usw.
  const km = umkreisKm || 50;
  return {
    url: `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was=${enc(beruf.name)}&wo=${enc(ort || '')}&umkreis=${km}`,
    label: 'Ausbildungsstellen in deiner Nähe',
  };
}

/** Link zum vollständigen BERUFENET-Steckbrief (öffentliche Seite). */
export function berufenetLink(beruf) {
  return `https://web.arbeitsagentur.de/berufenet/beruf/${encodeURIComponent(beruf.id)}`;
}
