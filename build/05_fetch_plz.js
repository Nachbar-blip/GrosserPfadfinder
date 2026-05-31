#!/usr/bin/env node
'use strict';
/**
 * 05_fetch_plz.js — baut public/data/plz.json: alle deutschen Postleitzahlen
 * mit Koordinaten, damit die App ortsunabhängig läuft (Nutzer:in tippt PLZ ein,
 * statt fest an eine Schule gebunden zu sein).
 *
 * Quelle: WZBSocialScienceCenter/plz_geocoord (CSV: plz,lat,lng). Offene Daten.
 * Format der Ausgabe: { "39356": [52.2754, 11.0833], ... } (lat/lon gerundet).
 *
 * Aufruf:  node build/05_fetch_plz.js
 */

const fs = require('fs');
const path = require('path');

const QUELLE = 'https://raw.githubusercontent.com/WZBSocialScienceCenter/plz_geocoord/master/plz_geocoord.csv';
const OUT = path.join(__dirname, '..', 'public', 'data', 'plz.json');

async function main() {
  console.log('Lade PLZ-Koordinaten …');
  const res = await fetch(QUELLE, { headers: { 'User-Agent': 'PfadfinderBuild/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} beim Laden von ${QUELLE}`);
  const csv = await res.text();

  const zeilen = csv.split(/\r?\n/);
  const map = {};
  for (let i = 1; i < zeilen.length; i++) {
    const z = zeilen[i].trim();
    if (!z) continue;
    const [plz, lat, lng] = z.split(',');
    if (!/^\d{5}$/.test(plz)) continue;
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    map[plz] = [Math.round(la * 1e4) / 1e4, Math.round(lo * 1e4) / 1e4];
  }

  const anzahl = Object.keys(map).length;
  if (anzahl < 5000) throw new Error(`Nur ${anzahl} PLZ geparst — Quelle vermutlich kaputt, Abbruch.`);
  fs.writeFileSync(OUT, JSON.stringify(map), 'utf8');
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`${anzahl} Postleitzahlen → ${path.relative(process.cwd(), OUT)} (${kb} KB)`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
