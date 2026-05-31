#!/usr/bin/env node
'use strict';
/**
 * 01_fetch_berufenet.js — sammelt alle Berufs-IDs + Namen + Stufe.
 *
 * Vier Stufen (über die Berufsgruppe bg bestimmt):
 *   ausbildung    (bg 100,101,102,105)  — Einstieg
 *   bachelor      (bg 300,301,302, grundständig)  — Einstieg
 *   master        (bg 300,301,302, weiterführend) — Anschluss ("wohin führt das")
 *   weiterbildung (bg 200,201,203,204,205) — Anschluss (Meister/Techniker/Fachwirt)
 *
 * Ergebnis: build/raw/berufe_basis.json
 * Aufruf:  node build/01_fetch_berufenet.js
 */

const fs = require('fs');
const path = require('path');
const ba = require('./lib/ba_client');

const RAW_DIR = path.join(__dirname, 'raw');
const OUT = path.join(RAW_DIR, 'berufe_basis.json');

const BG_WEITERBILDUNG = '200,201,203,204,205';
const istMaster = (b) => /weiterführend/i.test(b.name || '');

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const proId = new Map();
  const setze = (b, gattung, stufe) => {
    if (!proId.has(b.id)) proId.set(b.id, { ...b, gattung, stufe });
  };

  console.log('Enumeriere Ausbildungsberufe (bg 100,101,102,105) …');
  const ausbildung = await ba.enumeriereBerufe(ba.BG_AUSBILDUNG);
  console.log(`  ${ausbildung.length}`);
  for (const b of ausbildung) setze(b, 'ausbildung', 'ausbildung');

  console.log('Enumeriere Studiengänge (bg 300,301,302) …');
  const studium = await ba.enumeriereBerufe(ba.BG_STUDIUM);
  const bachelor = studium.filter((b) => !istMaster(b));
  const master = studium.filter(istMaster);
  console.log(`  ${bachelor.length} grundständig (Bachelor) + ${master.length} weiterführend (Master)`);
  for (const b of bachelor) setze(b, 'studium', 'bachelor');
  for (const b of master) setze(b, 'studium', 'master');

  console.log('Enumeriere Aufstiegsfortbildungen (bg 200,201,203,204,205) …');
  const weiterbildung = await ba.enumeriereBerufe(BG_WEITERBILDUNG);
  console.log(`  ${weiterbildung.length}`);
  for (const b of weiterbildung) setze(b, 'weiterbildung', 'weiterbildung');

  const alle = Array.from(proId.values()).sort((a, b) => a.id - b.id);
  const proStufe = alle.reduce((m, b) => ((m[b.stufe] = (m[b.stufe] || 0) + 1), m), {});
  fs.writeFileSync(OUT, JSON.stringify(alle, null, 2), 'utf8');

  console.log(`\nGesamt: ${alle.length} eindeutige Berufe ${JSON.stringify(proStufe)} → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
