/**
 * patch_reha_flag.js — Einmal-Migration: setzt reha_ausbildung=true auf bestehende
 * Reha-/Fachpraktiker-Ausbildungen (§66 BBiG / §42r/§42m HwO) in der bereits
 * generierten public/data/berufe.json, ohne die teure Tagging-Pipeline neu laufen
 * zu lassen. Dieselbe Erkennung steckt seit jetzt auch in 03_tag_berufe.js
 * (normalisiere), sodass ein künftiger Refresh das Flag automatisch wieder setzt.
 *
 * Idempotent: mehrfaches Ausführen ändert nichts. Aufruf: node build/patch_reha_flag.js
 */
const fs = require('fs');
const path = require('path');

const DATEI = path.join(__dirname, '..', 'public', 'data', 'berufe.json');
const REHA = /§\s?66\s?BBiG|§\s?42[rm]\s?HwO/i;

const berufe = JSON.parse(fs.readFileSync(DATEI, 'utf8'));
let getroffen = 0;
let neu = 0;
for (const b of berufe) {
  if (REHA.test(b.name || '')) {
    getroffen++;
    if (b.reha_ausbildung !== true) {
      b.reha_ausbildung = true;
      neu++;
    }
  }
}

// Exakt dasselbe Format wie die Pipeline (JSON.stringify(_, null, 2), kein Schluss-Newline),
// damit der Diff minimal bleibt.
fs.writeFileSync(DATEI, JSON.stringify(berufe, null, 2), 'utf8');
console.log(`Reha-Berufe erkannt: ${getroffen} | neu markiert: ${neu} | Datei geschrieben: ${path.relative(process.cwd(), DATEI)}`);
