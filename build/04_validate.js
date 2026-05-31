#!/usr/bin/env node
'use strict';
/**
 * 04_validate.js — prüft public/data/berufe.json auf Konsistenz (Spec §8.4/§12.2).
 *
 * - jeder Beruf ≥ 3 Tags, alle Tags im Vokabular
 * - jeder Tag in ≥ 5 Berufen (sonst "toter" Tag)
 * - keine Oberkategorie über 35 % / unter 2 %
 * - needs_review-Fälle separat zählen
 * Exit-Code 1 bei harten Fehlern.
 *
 * Aufruf:  node build/04_validate.js
 */

const fs = require('fs');
const path = require('path');

const BERUFE = path.join(__dirname, '..', 'public', 'data', 'berufe.json');
const TAGS = path.join(__dirname, '..', 'public', 'data', 'tags.json');

function main() {
  if (!fs.existsSync(BERUFE)) {
    console.error('FEHLER: public/data/berufe.json fehlt. Erst 03_tag_berufe.js (voller Lauf) ausführen.');
    process.exit(1);
  }
  const berufe = JSON.parse(fs.readFileSync(BERUFE, 'utf8'));
  const tagsJson = JSON.parse(fs.readFileSync(TAGS, 'utf8'));
  const alleTags = new Set();
  const alleKat = new Set(Object.keys(tagsJson.kategorien));
  for (const k of Object.values(tagsJson.kategorien)) for (const t of k.tags) alleTags.add(t);

  const fehler = [];
  const warnung = [];

  // pro Beruf
  const tagCount = {};
  const katCount = {};
  let review = 0;
  for (const b of berufe) {
    if (b.needs_review) review++;
    if (!Array.isArray(b.tags) || b.tags.length < 3) {
      // < 3 Tags ist nur ein harter Fehler bei Berufen, die im Tool angezeigt
      // werden. needs_review-Berufe sind bewusst vom Matching ausgeschlossen.
      const msg = `${b.id} ${b.name}: < 3 Tags`;
      if (b.needs_review) warnung.push(`${msg} (needs_review → vom Matching ausgeschlossen)`);
      else fehler.push(msg);
    }
    for (const t of b.tags || []) {
      if (!alleTags.has(t)) fehler.push(`${b.id} ${b.name}: unbekannter Tag "${t}"`);
      tagCount[t] = (tagCount[t] || 0) + 1;
    }
    const hauptKat = (b.kategorien || [])[0];
    if (hauptKat) katCount[hauptKat] = (katCount[hauptKat] || 0) + 1;
  }

  // tote Tags (< 5 Berufe)
  const toteTags = [...alleTags].filter((t) => (tagCount[t] || 0) < 5);
  if (toteTags.length) warnung.push(`Tags in < 5 Berufen (${toteTags.length}): ${toteTags.join(', ')}`);

  // Kategorienverteilung
  const gesamt = berufe.length || 1;
  for (const k of alleKat) {
    const anteil = (katCount[k] || 0) / gesamt;
    if (anteil > 0.35) fehler.push(`Oberkategorie "${k}" überrepräsentiert: ${(anteil * 100).toFixed(1)} %`);
    if (anteil < 0.02) warnung.push(`Oberkategorie "${k}" unterrepräsentiert: ${(anteil * 100).toFixed(1)} %`);
  }

  console.log(`=== VALIDIERUNG ===`);
  console.log(`Berufe: ${berufe.length} | needs_review: ${review}`);
  console.log(`Tags benutzt: ${Object.keys(tagCount).length}/${alleTags.size}`);
  console.log(`\nKategorien-Verteilung (Hauptkategorie):`);
  for (const [k, n] of Object.entries(katCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n} (${((n / gesamt) * 100).toFixed(1)} %)`);
  }
  if (warnung.length) {
    console.log(`\n⚠  WARNUNGEN (${warnung.length}):`);
    for (const w of warnung) console.log(`  - ${w}`);
  }
  if (fehler.length) {
    console.log(`\n✗ FEHLER (${fehler.length}):`);
    for (const f of fehler.slice(0, 40)) console.log(`  - ${f}`);
    if (fehler.length > 40) console.log(`  … und ${fehler.length - 40} weitere`);
    process.exit(1);
  }
  console.log(`\n✓ Keine harten Fehler.`);
}

main();
