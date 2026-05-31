'use strict';
/**
 * ba_client.js — gemeinsamer Client für die BERUFENET-API der Bundesagentur.
 *
 * Nur für den Build (Node), NICHT fürs Frontend. Liefert:
 *  - enumeriereBerufe(bgGruppen) : alle Berufs-IDs + Namen einer Berufsgruppe
 *  - holeDetail(id)              : Steckbrief, Tätigkeitsfelder, kldb2010
 *  - steckbriefZuText(detail)    : sauberer Text fürs Tagging (HTML/SVG entfernt)
 *
 * Auth: roher Header `X-API-Key: infosysbub-berufenet` (empirisch verifiziert
 * 2026-05; dkz-rest/entgeltatlas/oauth sind tot → siehe docs/datenquellen.md).
 */

const BASE = 'https://rest.arbeitsagentur.de/infosysbub/bnet/pc/v1';
const KEY = 'infosysbub-berufenet';

// Berufsgruppen (bg) laut BERUFENET: 100er = Ausbildung, 300er = Studium.
const BG_AUSBILDUNG = '100,101,102,105';
const BG_STUDIUM = '300,301,302';

function schlaf(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function holeJson(url, { versuche = 4 } = {}) {
  let letzterFehler;
  for (let i = 0; i < versuche; i++) {
    try {
      // WICHTIG: KEIN `Accept: application/json` — die BA-WAF antwortet darauf
      // mit 406. Nur Key + deskriptiver User-Agent (verifiziert 2026-05).
      const res = await fetch(url, { headers: { 'X-API-Key': KEY, 'User-Agent': 'PfadfinderBerufsorientierung/1.0' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} (retry)`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      letzterFehler = e;
      await schlaf(800 * (i + 1));
    }
  }
  throw new Error(`Fehlgeschlagen nach ${versuche} Versuchen: ${url}\n${letzterFehler.message}`);
}

/**
 * Enumeriert alle Berufe einer oder mehrerer Berufsgruppen.
 * @param {string} bgGruppen z.B. BG_AUSBILDUNG
 * @returns {Promise<Array<{id:number,name:string,bkgrId:number,typ:string}>>}
 */
async function enumeriereBerufe(bgGruppen, { throttleMs = 120 } = {}) {
  const ergebnis = [];
  const ersteUrl = `${BASE}/berufe?suchwoerter=%2A&bg=${bgGruppen}&page=0`;
  const erste = await holeJson(ersteUrl);
  const totalPages = erste.page?.totalPages ?? 1;

  const sammle = (seite) => {
    const liste = seite._embedded?.berufSucheList || [];
    for (const e of liste) {
      ergebnis.push({
        id: e.id,
        name: korrigiereText(e.kurzBezeichnungNeutral || ''),
        bkgrId: e.bkgr?.id ?? null,
        typ: e.bkgr?.typ?.id ?? null,
      });
    }
  };
  sammle(erste);

  for (let page = 1; page < totalPages; page++) {
    await schlaf(throttleMs);
    const seite = await holeJson(`${BASE}/berufe?suchwoerter=%2A&bg=${bgGruppen}&page=${page}`);
    sammle(seite);
  }
  return ergebnis;
}

/** Holt das vollständige Berufs-Detail (JSON-Array mit 1 Element → entpackt). */
async function holeDetail(id) {
  const r = await holeJson(`${BASE}/berufe/${id}`);
  return Array.isArray(r) ? r[0] : r;
}

// ---------- Text-Aufbereitung ----------

const ENTITIES = {
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  szlig: 'ß', euro: '€', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', deg: '°', sect: '§',
  bdquo: '„', ldquo: '“', rdquo: '”', sbquo: '‚', lsquo: '‘', rsquo: '’',
};

function dekodiereEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

/** Repariert doppelt-UTF8-kodierte Umlaute (Mojibake), falls vorhanden. */
function korrigiereText(s) {
  if (!s) return '';
  if (/Ã[¤¶¼]|Ã„|Ã–|Ãœ/.test(s)) {
    try {
      return Buffer.from(s, 'latin1').toString('utf8');
    } catch (e) {
      return s;
    }
  }
  return s;
}

/** Entfernt SVG-/Grafik-Blöcke und HTML, dekodiert Entities → Reintext. */
function htmlZuText(html) {
  if (!html) return '';
  let s = String(html);
  // große Grafik-Blöcke (Schulabschluss-Charts) komplett raus
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<ba-[a-z-]+[\s\S]*?<\/ba-[a-z-]+>/gi, ' ');
  // Block-/Listenelemente zu Trennern
  s = s.replace(/<\/(p|div|section|header|li|tr|h[1-6])>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '• ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = dekodiereEntities(s);
  s = korrigiereText(s);
  return s.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

/**
 * Extrahiert die fürs Tagging relevanten Felder aus einem Berufs-Detail.
 * @returns {{beschreibung,anforderungen,steckbrief_kurz,verguetung,taetigkeitsfelder,kldb2010}}
 */
function steckbriefZuText(detail) {
  const lang = htmlZuText(detail?.steckbrief?.lang || '');
  const kurz = htmlZuText(detail?.steckbrief?.kurz || '');

  // Abschnitt „Was macht man …" als knappe Beschreibung herausziehen.
  let beschreibung = '';
  const mWas = lang.match(/Was macht man in diesem Beruf\?\s*([\s\S]*?)(?:\n[A-ZÄÖÜ][^\n]{0,60}\?|Wo arbeitet man|$)/);
  if (mWas) beschreibung = mWas[1].trim().slice(0, 700);
  if (!beschreibung) beschreibung = lang.slice(0, 700);

  const mAnf = lang.match(/Worauf kommt es an\?\s*([\s\S]*?)(?:Was verdient man|$)/);
  const anforderungen = mAnf ? mAnf[1].trim().slice(0, 600) : '';

  const mVerg = lang.match(/Was verdient man[^?]*\?\s*([\s\S]*?)$/);
  const verguetung = mVerg ? mVerg[1].trim().slice(0, 400) : '';

  const tf = (detail?.taetigkeitsfelder || [])
    .map((t) => korrigiereText(t.kurzBezeichnungNeutral || ''))
    .filter(Boolean);

  return {
    beschreibung,
    anforderungen,
    steckbrief_kurz: kurz.slice(0, 400),
    verguetung,
    taetigkeitsfelder: tf,
    kldb2010: detail?.kldb2010 || null,
  };
}

module.exports = {
  BASE, KEY, BG_AUSBILDUNG, BG_STUDIUM,
  enumeriereBerufe, holeDetail, steckbriefZuText, htmlZuText, korrigiereText, schlaf,
};
