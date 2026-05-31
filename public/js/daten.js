/**
 * daten.js — lädt die statischen JSON-Dateien beim Start.
 *
 * config.json (Schule), data/tags.json (Vokabular), data/fragen.json
 * (Fragebogen), data/berufe.json (generiert durch build/). Alles per fetch
 * vom selben Origin — funktioniert offline, sobald die Seite ausgeliefert ist
 * (GitHub Pages oder lokaler Server). berufe.json darf fehlen (noch nicht
 * generiert) — dann läuft der Fragebogen, nur die Ergebnisse fehlen.
 */

async function ladeJson(pfad, pflicht) {
  try {
    const res = await fetch(pfad, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (pflicht) throw new Error(`Pflichtdatei ${pfad} fehlt: ${e.message}`);
    return null;
  }
}

export async function ladeDaten() {
  const [config, tags, fragen, berufe, plz] = await Promise.all([
    ladeJson('config.json', false),
    ladeJson('data/tags.json', true),
    ladeJson('data/fragen.json', true),
    ladeJson('data/berufe.json', false),
    ladeJson('data/plz.json', false),
  ]);

  return {
    config: config || { schulname: '', default_umkreis_km: 50 },
    tags,
    fragen,
    berufe: Array.isArray(berufe) ? berufe : [],
    berufeVorhanden: Array.isArray(berufe) && berufe.length > 0,
    plz: plz || {}, // { "39356": [lat, lon] }
  };
}
