#!/usr/bin/env node
'use strict';
/**
 * 03_tag_berufe.js — taggt Berufe via Claude (Tags, Kategorien, Umgebung,
 * osm_tags, Schulabschluss, Ausbildungsart, Gehalt-Schätzung, Seltenheit).
 *
 * Modi:
 *   node build/03_tag_berufe.js --sample=50   → PFLICHT-STICHPROBE: taggt 50
 *        repräsentative Berufe nach build/raw/berufe_sample.json und STOPPT.
 *        (Spec §8.3 — voller Lauf erst nach ausdrücklicher Freigabe.)
 *   node build/03_tag_berufe.js               → inkrementeller VOLLER Lauf
 *        (nur neue/geänderte Berufe) → public/data/berufe.json
 *   node build/03_tag_berufe.js --full-retag  → alles neu taggen (bei Vokabular-
 *        oder Prompt-Änderung nötig).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { erstelleTagger } = require('./lib/claude_client');

const RAW_DIR = path.join(__dirname, 'raw');
const VOLL = path.join(RAW_DIR, 'berufe_voll.json');
const TAGS_JSON = path.join(__dirname, '..', 'public', 'data', 'tags.json');
const OUT_FULL = path.join(__dirname, '..', 'public', 'data', 'berufe.json');
const OUT_SAMPLE = path.join(RAW_DIR, 'berufe_sample.json');
const OUT_REVIEW = path.join(RAW_DIR, 'review.json');

const args = process.argv.slice(2);
const sampleArg = args.find((a) => a.startsWith('--sample='));
const SAMPLE_N = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : null;
const FULL_RETAG = args.includes('--full-retag');
const NEBENLAEUFIG = 8;

// Preise Sonnet 4.5 ($/Mtok): input 3, output 15, cache-write 3.75, cache-read 0.30.
const PREIS = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

// ---- Vokabular & Validierung ----
const tagsJson = JSON.parse(fs.readFileSync(TAGS_JSON, 'utf8'));
const ALLE_TAGS = new Set();
const ALLE_KAT = new Set(Object.keys(tagsJson.kategorien));
for (const k of Object.values(tagsJson.kategorien)) for (const t of k.tags) ALLE_TAGS.add(t);
const ABSCHLUESSE = new Set(['hauptschule', 'realschule', 'fachhochschulreife', 'abitur']);
const ARTEN = new Set(['betriebliche_ausbildung', 'schulische_ausbildung', 'duales_studium', 'studium']);
const SELTENHEITEN = new Set(['haeufig', 'regional', 'selten']);

function quellHash(b) {
  return crypto
    .createHash('sha1')
    .update(`${b.name}|${b.beschreibung}|${b.anforderungen}|${(b.taetigkeitsfelder || []).join(',')}`)
    .digest('hex')
    .slice(0, 16);
}

function validiere(p, roh) {
  const fehler = [];
  // Tags/Kategorien wurden in normalisiere() bereits auf gültige Werte gefiltert.
  if (!Array.isArray(p.tags) || p.tags.length < 3) fehler.push(`weniger als 3 gültige Tags (hat ${p.tags?.length})`);
  if (!Array.isArray(p.kategorien) || p.kategorien.length < 1) fehler.push('keine gültige Kategorie');
  const u = p.umgebung || {};
  for (const k of ['drinnen_draussen', 'allein_team', 'routine_wechsel', 'anpacken_konzentriert']) {
    if (typeof u[k] !== 'number' || u[k] < 0 || u[k] > 100) fehler.push(`umgebung.${k} ungültig`);
  }
  if (!ABSCHLUESSE.has(p.schulabschluss_min)) fehler.push(`schulabschluss_min ungültig (${p.schulabschluss_min})`);
  if (!ARTEN.has(p.ausbildungsart)) fehler.push(`ausbildungsart ungültig (${p.ausbildungsart})`);
  if (!SELTENHEITEN.has(p.seltenheit)) fehler.push(`seltenheit ungültig (${p.seltenheit})`);
  if (!Array.isArray(p.osm_tags)) fehler.push('osm_tags kein Array');
  return fehler;
}

function normalisiere(p, roh) {
  // ID/Name aus dem Input erzwingen (LLM könnte abweichen).
  p.id = roh.id;
  p.name = roh.name;
  p.gattung = roh.gattung;
  // Ungültige (erfundene) Tags/Kategorien verwerfen statt den Beruf zu blockieren.
  const tagsRoh = Array.isArray(p.tags) ? p.tags : [];
  const verworfen = tagsRoh.filter((t) => !ALLE_TAGS.has(t));
  p.tags = tagsRoh.filter((t) => ALLE_TAGS.has(t)).slice(0, 6);
  p.kategorien = (Array.isArray(p.kategorien) ? p.kategorien : []).filter((k) => ALLE_KAT.has(k)).slice(0, 3);
  if (verworfen.length) p._verworfene_tags = verworfen;
  if (!Array.isArray(p.osm_tags)) p.osm_tags = [];
  p._quell_hash = quellHash(roh);
  return p;
}

// ---- repräsentative Stichprobe (Spec §8.3: gemischt über Domänen + Gattungen) ----
const KW_AUSBILDUNG = [
  'Tischler', 'Maurer', 'Dachdecker', 'Zimmer', 'Fliesenleger', 'Maler', 'Glaser', 'Steinmetz',
  'Goldschmied', 'Bäcker', 'Konditor', 'Fleischer', 'Koch', 'Friseur', 'Florist', 'Gärtner',
  'Anlagenmechaniker', 'Elektroniker', 'Kraftfahrzeug', 'Mechatroniker', 'Industriemechaniker',
  'Fachinformatiker', 'Chemielaborant', 'Medizinische Fachangestellte', 'Zahnmedizinische',
  'Pflegefach', 'Altenpfleg', 'Physiotherap', 'Augenoptiker', 'Tiermedizinische', 'Mediengestalter',
  'Bankkaufmann', 'Industriekaufmann', 'Einzelhandel', 'Büromanagement', 'Steuerfachangestellte',
  'Erzieher', 'Landwirt', 'Berufskraftfahrer', 'Lagerlogistik', 'Forstwirt', 'Notfallsanitäter',
];
const KW_STUDIUM = [
  'Informatik', 'Maschinenbau', 'Elektrotechnik', 'Betriebswirtschaft', 'Soziale Arbeit',
  'Architektur', 'Bauingenieur', 'Psychologie', 'Medizin', 'Rechtswissenschaft', 'Lehramt',
  'Biologie', 'Wirtschaftsingenieur', 'Pflege', 'Chemie',
];

function waehlePerKeywords(kandidaten, keywords, gewaehlt, limit) {
  const niedrig = kandidaten.map((b) => ({ b, lname: (b.name || '').toLowerCase() }));
  for (const kw of keywords) {
    if (gewaehlt.size >= limit) break;
    const treffer = niedrig.find((x) => !gewaehlt.has(x.b.id) && x.lname.includes(kw.toLowerCase()));
    if (treffer) gewaehlt.set(treffer.b.id, treffer.b);
  }
}

function waehleSample(berufe, n) {
  const nStudium = Math.round(n * 0.25); // ~25 % Studium, Rest Ausbildung
  const gewaehlt = new Map();
  waehlePerKeywords(berufe.filter((b) => b.gattung === 'ausbildung'), KW_AUSBILDUNG, gewaehlt, n - nStudium);
  waehlePerKeywords(berufe.filter((b) => b.gattung === 'studium'), KW_STUDIUM, gewaehlt, n);
  // Mit gleichmäßigem Durchgriff über die ID-Liste auffüllen (deterministisch).
  if (gewaehlt.size < n) {
    const rest = berufe.filter((b) => !gewaehlt.has(b.id));
    const schritt = Math.max(1, Math.floor(rest.length / (n - gewaehlt.size)));
    for (let i = 0; i < rest.length && gewaehlt.size < n; i += schritt) gewaehlt.set(rest[i].id, rest[i]);
  }
  return Array.from(gewaehlt.values()).slice(0, n);
}

// ---- einfache Nebenläufigkeits-Pool ----
async function pool(items, worker, limit) {
  const ergebnisse = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      ergebnisse[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return ergebnisse;
}

function kostenAus(usages) {
  let inp = 0, out = 0, cw = 0, cr = 0;
  for (const u of usages) {
    inp += u.input_tokens || 0;
    out += u.output_tokens || 0;
    cw += u.cache_creation_input_tokens || 0;
    cr += u.cache_read_input_tokens || 0;
  }
  const eur = ((inp * PREIS.input + out * PREIS.output + cw * PREIS.cacheWrite + cr * PREIS.cacheRead) / 1e6) * 0.92;
  return { inp, out, cw, cr, eur };
}

async function main() {
  if (!fs.existsSync(VOLL)) {
    console.error('FEHLER: build/raw/berufe_voll.json fehlt. Erst 01 + 02 laufen lassen.');
    process.exit(1);
  }
  const voll = JSON.parse(fs.readFileSync(VOLL, 'utf8')).filter((b) => !b._fetch_fehler);
  const tagger = erstelleTagger(tagsJson);

  // Cache (vorhandene berufe.json) für inkrementelles Taggen.
  const cache = new Map();
  if (!FULL_RETAG && !SAMPLE_N && fs.existsSync(OUT_FULL)) {
    try {
      for (const b of JSON.parse(fs.readFileSync(OUT_FULL, 'utf8'))) cache.set(b.id, b);
    } catch (e) { /* leerer Cache */ }
  }

  let zuTaggen;
  if (SAMPLE_N) {
    zuTaggen = waehleSample(voll, SAMPLE_N);
    console.log(`STICHPROBE: ${zuTaggen.length} repräsentative Berufe (Modell: ${tagger.MODEL}).`);
  } else {
    const ausCache = [];
    zuTaggen = [];
    for (const b of voll) {
      const cached = cache.get(b.id);
      if (cached && cached._quell_hash === quellHash(b)) ausCache.push(cached);
      else zuTaggen.push(b);
    }
    console.log(`VOLLER LAUF: ${voll.length} Berufe | aus Cache: ${ausCache.length} | neu/geändert: ${zuTaggen.length} (Modell: ${tagger.MODEL}).`);
  }

  const usages = [];
  const getaggt = [];
  let fehlerCount = 0;
  let fertig = 0;

  await pool(
    zuTaggen,
    async (roh) => {
      try {
        const { parsed, usage } = await tagger.taggeEinen(roh);
        usages.push(usage);
        const norm = normalisiere(parsed, roh);
        const fehler = validiere(norm, roh);
        if (fehler.length) {
          norm.needs_review = true;
          norm._review_grund = fehler.join('; ');
        }
        getaggt.push(norm);
      } catch (e) {
        fehlerCount++;
        console.warn(`\n  ✗ ${roh.id} ${roh.name}: ${e.message}`);
      }
      fertig++;
      if (fertig % 10 === 0 || fertig === zuTaggen.length) {
        process.stdout.write(`  ${fertig}/${zuTaggen.length}\r`);
      }
    },
    NEBENLAEUFIG,
  );

  const kosten = kostenAus(usages);

  if (SAMPLE_N) {
    getaggt.sort((a, b) => a.id - b.id);
    fs.writeFileSync(OUT_SAMPLE, JSON.stringify(getaggt, null, 2), 'utf8');
    berichteStichprobe(getaggt, fehlerCount, kosten, voll.length);
    return;
  }

  // Voller Lauf: getaggte + unveränderte aus Cache zusammenführen.
  const proId = new Map();
  for (const b of voll) {
    const cached = cache.get(b.id);
    if (cached && cached._quell_hash === quellHash(b) && !getaggt.find((g) => g.id === b.id)) proId.set(b.id, cached);
  }
  for (const g of getaggt) proId.set(g.id, g);
  const final = Array.from(proId.values()).sort((a, b) => a.id - b.id);

  fs.writeFileSync(OUT_FULL, JSON.stringify(final, null, 2), 'utf8');
  const review = final.filter((b) => b.needs_review);
  fs.writeFileSync(OUT_REVIEW, JSON.stringify(review, null, 2), 'utf8');

  console.log(`\n\n=== VOLLER LAUF FERTIG ===`);
  console.log(`Gesamt: ${final.length} | neu getaggt: ${getaggt.length} | needs_review: ${review.length} | Fehler: ${fehlerCount}`);
  console.log(`Kosten (neu getaggt): ~${kosten.eur.toFixed(2)} € (in ${kosten.inp}, out ${kosten.out}, cache-read ${kosten.cr})`);
  console.log(`→ ${path.relative(process.cwd(), OUT_FULL)} | Review: ${path.relative(process.cwd(), OUT_REVIEW)}`);
}

function berichteStichprobe(getaggt, fehlerCount, kosten, gesamtBerufe) {
  const tagVert = {};
  for (const b of getaggt) for (const t of b.tags || []) tagVert[t] = (tagVert[t] || 0) + 1;
  const haeufigste = Object.entries(tagVert).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const review = getaggt.filter((b) => b.needs_review);
  const ohneOsm = getaggt.filter((b) => (b.osm_tags || []).length === 0).length;
  const proGattung = getaggt.reduce((m, b) => ((m[b.gattung] = (m[b.gattung] || 0) + 1), m), {});
  const hochrechnung = (kosten.eur / Math.max(1, getaggt.length)) * gesamtBerufe;

  console.log(`\n\n========================= STICHPROBEN-BERICHT =========================`);
  console.log(`Datei:            ${path.relative(process.cwd(), OUT_SAMPLE)}`);
  console.log(`Getaggt:          ${getaggt.length} Berufe (${JSON.stringify(proGattung)})`);
  console.log(`needs_review:     ${review.length}${review.length ? ' → ' + review.map((b) => b.name).join(', ') : ''}`);
  console.log(`Fehler (kein JSON/Abbruch): ${fehlerCount}`);
  console.log(`Ohne osm_tags:    ${ohneOsm}`);
  console.log(`Häufigste Tags:   ${haeufigste.map(([t, n]) => `${t}(${n})`).join(', ')}`);
  console.log(`Kosten Stichprobe: ~${kosten.eur.toFixed(2)} €  →  Hochrechnung voller Lauf (${gesamtBerufe}): ~${hochrechnung.toFixed(2)} €`);
  console.log(`\n--- 5 Beispiele zur Sichtprüfung ---`);
  for (const b of getaggt.slice(0, 5)) {
    console.log(`  ${b.name} [${b.gattung}] → kat:${(b.kategorien || []).join('/')} | tags:${(b.tags || []).join(',')}`);
    console.log(`     umgebung:${JSON.stringify(b.umgebung)} osm:${JSON.stringify(b.osm_tags)} abschluss:${b.schulabschluss_min} art:${b.ausbildungsart} gehalt:${b.mediangehalt} selten:${b.seltenheit}`);
  }
  console.log(`\n⛔ PFLICHT-STOPP (Spec §8.3): voller Lauf NICHT automatisch gestartet.`);
  console.log(`   Bitte Stichprobe prüfen. >>> Freigabe für vollen Lauf? <<<`);
  console.log(`=======================================================================`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
