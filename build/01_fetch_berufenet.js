#!/usr/bin/env node
'use strict';
/**
 * 01_fetch_berufenet.js — sammelt alle Berufs-IDs + Namen.
 *
 * Enumeriert Ausbildungsberufe (bg 100,101,102,105) und Studiengänge
 * (bg 300,301,302) über die BERUFENET-Liste und schreibt das Roh-Ergebnis
 * nach build/raw/berufe_basis.json. Kein API-Key fürs Frontend nötig.
 *
 * Aufruf:  node build/01_fetch_berufenet.js
 */

const fs = require('fs');
const path = require('path');
const ba = require('./lib/ba_client');

const RAW_DIR = path.join(__dirname, 'raw');
const OUT = path.join(RAW_DIR, 'berufe_basis.json');

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  console.log('Enumeriere Ausbildungsberufe (bg 100,101,102,105) …');
  const ausbildung = await ba.enumeriereBerufe(ba.BG_AUSBILDUNG);
  console.log(`  ${ausbildung.length} Ausbildungsberufe`);

  console.log('Enumeriere Studiengänge (bg 300,301,302) …');
  const studium = await ba.enumeriereBerufe(ba.BG_STUDIUM);
  console.log(`  ${studium.length} Studiengänge`);

  // Zusammenführen, nach id deduplizieren (ein Beruf kann in mehreren bg liegen).
  const proId = new Map();
  for (const b of ausbildung) proId.set(b.id, { ...b, gattung: 'ausbildung' });
  for (const b of studium) if (!proId.has(b.id)) proId.set(b.id, { ...b, gattung: 'studium' });

  // Weiterführende (Master-)Studiengänge ausschließen: nicht zielgruppenrelevant
  // (Klasse 9–12 wählt einen Erstweg: Ausbildung oder grundständiges Studium)
  // und in BERUFENET ohne Steckbrief-Text. Spart außerdem ~34 % Tagging-Budget.
  const istWeiterfuehrend = (b) => /weiterführend/i.test(b.name || '');
  const ausgeschlossen = Array.from(proId.values()).filter(istWeiterfuehrend).length;
  const alle = Array.from(proId.values()).filter((b) => !istWeiterfuehrend(b)).sort((a, b) => a.id - b.id);
  console.log(`  (${ausgeschlossen} weiterführende Studiengänge ausgeschlossen)`);
  fs.writeFileSync(OUT, JSON.stringify(alle, null, 2), 'utf8');

  console.log(`\nGesamt: ${alle.length} eindeutige Berufe → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
