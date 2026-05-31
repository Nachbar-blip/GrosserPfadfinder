#!/usr/bin/env node
'use strict';
/**
 * 02_fetch_kompetenzen.js — holt pro Beruf den Steckbrief (Beschreibung,
 * Anforderungen, Tätigkeitsfelder, Ausbildungsvergütung, kldb2010) und
 * bereitet ihn als sauberen Text fürs Tagging auf.
 *
 * Basis-getrieben: Metadaten (name, gattung, stufe, bkgrId) kommen immer frisch
 * aus berufe_basis.json (so werden neue Felder wie stufe auch für bereits
 * geholte Berufe nachgetragen); die teuren Text-Felder werden gecacht und nur
 * für neue IDs per API geholt. Gedrosselt, mit Zwischenspeichern.
 *
 * Aufruf:  node build/02_fetch_kompetenzen.js [--limit=N]
 */

const fs = require('fs');
const path = require('path');
const ba = require('./lib/ba_client');

const RAW_DIR = path.join(__dirname, 'raw');
const BASIS = path.join(RAW_DIR, 'berufe_basis.json');
const OUT = path.join(RAW_DIR, 'berufe_voll.json');

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const THROTTLE_MS = 120;
const SPEICHER_INTERVALL = 25;

const TEXT_FELDER = ['beschreibung', 'anforderungen', 'steckbrief_kurz', 'verguetung', 'taetigkeitsfelder', 'kldb2010', '_fetch_fehler'];

function ladeTextCache() {
  if (!fs.existsSync(OUT)) return new Map();
  try {
    const m = new Map();
    for (const b of JSON.parse(fs.readFileSync(OUT, 'utf8'))) {
      const t = {};
      for (const k of TEXT_FELDER) if (k in b) t[k] = b[k];
      m.set(b.id, t);
    }
    return m;
  } catch (e) {
    return new Map();
  }
}

function baueEintrag(basisB, text) {
  return { id: basisB.id, name: basisB.name, gattung: basisB.gattung, stufe: basisB.stufe, bkgrId: basisB.bkgrId, ...text };
}

function speichere(basis, textCache) {
  const arr = basis.map((b) => baueEintrag(b, textCache.get(b.id) || {})).sort((a, b) => a.id - b.id);
  fs.writeFileSync(OUT, JSON.stringify(arr, null, 2), 'utf8');
}

async function main() {
  if (!fs.existsSync(BASIS)) {
    console.error('FEHLER: build/raw/berufe_basis.json fehlt. Erst 01_fetch_berufenet.js laufen lassen.');
    process.exit(1);
  }
  const basis = JSON.parse(fs.readFileSync(BASIS, 'utf8'));
  const textCache = ladeTextCache();
  const todo = basis.filter((b) => !textCache.has(b.id)).slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`Basis: ${basis.length} | Text im Cache: ${textCache.size} | zu holen: ${todo.length}`);
  if (todo.length === 0) {
    speichere(basis, textCache); // Metadaten (stufe) ggf. nachtragen
    console.log('Nichts zu holen (voll.json mit aktuellen Metadaten geschrieben).');
    return;
  }

  let fehler = 0;
  for (let i = 0; i < todo.length; i++) {
    const b = todo[i];
    try {
      const detail = await ba.holeDetail(b.id);
      textCache.set(b.id, ba.steckbriefZuText(detail));
    } catch (e) {
      fehler++;
      console.warn(`  ✗ ${b.id} ${b.name}: ${e.message}`);
      textCache.set(b.id, { beschreibung: '', anforderungen: '', steckbrief_kurz: '', verguetung: '', taetigkeitsfelder: [], kldb2010: null, _fetch_fehler: true });
    }
    if ((i + 1) % SPEICHER_INTERVALL === 0) {
      speichere(basis, textCache);
      process.stdout.write(`  ${i + 1}/${todo.length} (${Math.round(((i + 1) / todo.length) * 100)}%)\r`);
    }
    await ba.schlaf(THROTTLE_MS);
  }
  speichere(basis, textCache);

  console.log(`\nFertig. ${basis.length} Berufe in voll.json, ${fehler} Fetch-Fehler → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
