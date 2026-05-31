#!/usr/bin/env node
'use strict';
/**
 * 02_fetch_kompetenzen.js — holt pro Beruf den Steckbrief (Beschreibung,
 * Anforderungen, Tätigkeitsfelder, Ausbildungsvergütung, kldb2010) und
 * bereitet ihn als sauberen Text fürs Tagging auf.
 *
 * Liest build/raw/berufe_basis.json, schreibt build/raw/berufe_voll.json.
 * Inkrementell: bereits geholte IDs werden übersprungen (Cache = vorhandene
 * berufe_voll.json). Gedrosselt, mit Zwischenspeichern.
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

function ladeCache() {
  if (!fs.existsSync(OUT)) return new Map();
  try {
    return new Map(JSON.parse(fs.readFileSync(OUT, 'utf8')).map((b) => [b.id, b]));
  } catch (e) {
    return new Map();
  }
}

function speichere(cache, basisIds) {
  // Nur Details schreiben, die auch in der aktuellen Basis-Liste stehen
  // (pruned damit ausgeschlossene Berufe nicht in voll.json zurückbleiben).
  const arr = Array.from(cache.values())
    .filter((b) => !basisIds || basisIds.has(b.id))
    .sort((a, b) => a.id - b.id);
  fs.writeFileSync(OUT, JSON.stringify(arr, null, 2), 'utf8');
}

async function main() {
  if (!fs.existsSync(BASIS)) {
    console.error('FEHLER: build/raw/berufe_basis.json fehlt. Erst 01_fetch_berufenet.js laufen lassen.');
    process.exit(1);
  }
  const basis = JSON.parse(fs.readFileSync(BASIS, 'utf8'));
  const basisIds = new Set(basis.map((b) => b.id));
  const cache = ladeCache();
  const todo = basis.filter((b) => !cache.has(b.id)).slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`Basis: ${basis.length} | im Cache: ${cache.size} | zu holen: ${todo.length}`);
  if (todo.length === 0) {
    speichere(cache, basisIds); // ggf. ausgeschlossene Berufe aus voll.json entfernen
    console.log('Nichts zu holen (voll.json auf Basis-Umfang gekürzt).');
    return;
  }

  let fehler = 0;
  for (let i = 0; i < todo.length; i++) {
    const b = todo[i];
    try {
      const detail = await ba.holeDetail(b.id);
      const text = ba.steckbriefZuText(detail);
      cache.set(b.id, { id: b.id, name: b.name, gattung: b.gattung, bkgrId: b.bkgrId, ...text });
    } catch (e) {
      fehler++;
      console.warn(`  ✗ ${b.id} ${b.name}: ${e.message}`);
      cache.set(b.id, { id: b.id, name: b.name, gattung: b.gattung, bkgrId: b.bkgrId, beschreibung: '', anforderungen: '', steckbrief_kurz: '', verguetung: '', taetigkeitsfelder: [], kldb2010: null, _fetch_fehler: true });
    }
    if ((i + 1) % SPEICHER_INTERVALL === 0) {
      speichere(cache, basisIds);
      process.stdout.write(`  ${i + 1}/${todo.length} (${Math.round(((i + 1) / todo.length) * 100)}%)\r`);
    }
    await ba.schlaf(THROTTLE_MS);
  }
  speichere(cache, basisIds);

  console.log(`\nFertig. Detail vorhanden für ${cache.size} Berufe, ${fehler} Fehler → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
