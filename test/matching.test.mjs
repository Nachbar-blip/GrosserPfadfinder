/**
 * matching.test.mjs — Unit-Tests für den Matching-Algorithmus (Spec §13.6).
 * Ohne Test-Framework: node test/matching.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matche, matcheAnschluss, hartFiltern, bewerteBeruf, scoreProzent, passungsStufe } from '../public/js/matching.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fragen = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', 'fragen.json'), 'utf8'));

let bestanden = 0;
let fehlgeschlagen = 0;
function ok(bedingung, name) {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name}`); }
}

// Test-Berufe (minimal, decken die geprüften Fälle ab).
const BERUFE = [
  { id: 1, name: 'Tischler/in', kategorien: ['handwerk_material', 'gestaltung_design'], tags: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'produkt_entwerfen', 'maschine_bedienen'], umgebung: { drinnen_draussen: 20, allein_team: 40, routine_wechsel: 40, anpacken_konzentriert: 30 }, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', mediangehalt: 2400, seltenheit: 'haeufig', osm_tags: ['craft=carpenter'] },
  { id: 2, name: 'Schreiner/in', kategorien: ['handwerk_material'], tags: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'maschine_bedienen', 'produkt_entwerfen'], umgebung: { drinnen_draussen: 20, allein_team: 40, routine_wechsel: 40, anpacken_konzentriert: 30 }, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', mediangehalt: 2400, seltenheit: 'haeufig', osm_tags: ['craft=joiner'] },
  { id: 3, name: 'Zimmerer/in', kategorien: ['handwerk_material', 'bau_architektur'], tags: ['holz_bearbeiten', 'dach_decken', 'maschine_bedienen'], umgebung: { drinnen_draussen: 80, allein_team: 70, routine_wechsel: 50, anpacken_konzentriert: 20 }, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', mediangehalt: 2600, seltenheit: 'haeufig', osm_tags: ['craft=carpenter'] },
  { id: 4, name: 'Maschinenbau (Studium)', kategorien: ['technik_maschinen', 'bau_architektur'], tags: ['maschine_bedienen', 'gebaeude_planen_zeichnen', 'projekt_planen_organisieren', 'tabelle_auswerten'], umgebung: { drinnen_draussen: 30, allein_team: 60, routine_wechsel: 50, anpacken_konzentriert: 70 }, schulabschluss_min: 'abitur', ausbildungsart: 'studium', mediangehalt: 4200, seltenheit: 'haeufig', osm_tags: ['office=engineer'] },
  { id: 5, name: 'Altenpfleger/in', kategorien: ['medizin_pflege'], tags: ['senior_pflegen', 'wunde_versorgen', 'medikament_verabreichen', 'mensch_beraten_begleiten'], umgebung: { drinnen_draussen: 20, allein_team: 70, routine_wechsel: 60, anpacken_konzentriert: 40 }, schulabschluss_min: 'realschule', ausbildungsart: 'schulische_ausbildung', mediangehalt: 2900, seltenheit: 'haeufig', osm_tags: ['amenity=nursing_home'] },
];

function profil(over = {}) {
  return {
    blockA: { schulabschluss: 'abitur', weg: new Set(), umkreis: '100', gehalt_wichtig: 'mittel', ...over.blockA },
    regler: { drinnen_draussen: 50, allein_team: 50, routine_wechsel: 50, anpacken_konzentriert: 50, gesellschaftlich_sinnvoll: 50, ...over.regler },
    taetigkeiten: new Set(over.taetigkeiten || []),
    motivation: new Set(over.motivation || []),
  };
}

console.log('matching.test.mjs');

// 1) Harter Filter Schulabschluss: Realschüler:in bekommt KEINE Abitur-Berufe (Maschinenbau-Studium).
{
  const p = profil({ blockA: { schulabschluss: 'realschule' } });
  const gefiltert = hartFiltern(BERUFE, p, fragen);
  ok(!gefiltert.find((b) => b.id === 4) && gefiltert.length === 4, 'Schulabschluss-Filter: realschule schließt Abitur-Studium aus');
}

// 2) Harter Filter Weg: "Betriebliche Ausbildung" schließt Studium aus, behält
//    aber schulische Ausbildung (laut fragen.json akzeptiert beides).
{
  const p = profil({ blockA: { weg: new Set(['betriebliche_ausbildung']) } });
  const gefiltert = hartFiltern(BERUFE, p, fragen);
  const hatStudium = gefiltert.some((b) => b.ausbildungsart === 'studium');
  const hatSchulisch = gefiltert.some((b) => b.ausbildungsart === 'schulische_ausbildung');
  ok(!hatStudium && hatSchulisch, 'Weg-Filter: betriebliche_ausbildung schließt Studium aus, behält schulische');
}

// 3) Tag-Matching: Holz-Profil rankt Tischler/Schreiner ganz oben.
{
  const p = profil({ taetigkeiten: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'produkt_entwerfen'] });
  const top = matche(BERUFE, p, fragen);
  ok(top.length > 0 && ['Tischler/in', 'Schreiner/in'].includes(top[0].beruf.name), 'Tag-Matching: Holz-Profil rankt Tischler/Schreiner oben');
}

// 4) Diversifizierung: max. 2 pro Hauptkategorie (3 Holz-Berufe → höchstens 2 handwerk_material).
{
  const p = profil({ taetigkeiten: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'maschine_bedienen', 'produkt_entwerfen', 'dach_decken'] });
  const top = matche(BERUFE, p, fragen);
  const handwerk = top.filter((m) => (m.beruf.kategorien || [])[0] === 'handwerk_material').length;
  ok(handwerk <= 2, 'Diversifizierung: höchstens 2 Berufe pro Hauptkategorie');
}

// 5) Schwelle: leeres Profil (nichts angekreuzt) erzeugt keine starken Treffer.
{
  const p = profil();
  const top = matche(BERUFE, p, fragen);
  ok(top.every((m) => m.matchTags.length === 0), 'Schwelle: ohne Tätigkeiten keine Tag-Treffer');
}

// 6) Hilfsfunktionen: scoreProzent/passungsStufe plausibel.
{
  ok(scoreProzent(0.6) === 100 && scoreProzent(0.3) === 50, 'scoreProzent: 0.6 → 100 %, 0.3 → 50 %');
  ok(passungsStufe(0.7).text === 'starke Passung' && passungsStufe(0.1).klasse === 'schwach', 'passungsStufe: Stufen korrekt');
}

// 7) Stufen-Trennung: matche() liefert nur Einstieg, matcheAnschluss() nur Master/Weiterbildung.
{
  const mitStufe = [
    { ...BERUFE[0], id: 10, stufe: 'ausbildung' },
    { ...BERUFE[3], id: 11, stufe: 'bachelor' },
    { id: 12, name: 'Holztechnik (Master)', stufe: 'master', kategorien: ['handwerk_material'], tags: ['holz_bearbeiten', 'produkt_entwerfen', 'praezisionsarbeit_hand'], umgebung: { drinnen_draussen: 30, allein_team: 50, routine_wechsel: 50, anpacken_konzentriert: 60 }, schulabschluss_min: 'abitur', ausbildungsart: 'studium', mediangehalt: 4000, seltenheit: 'haeufig', osm_tags: [] },
    { id: 13, name: 'Tischlermeister/in', stufe: 'weiterbildung', kategorien: ['handwerk_material'], tags: ['holz_bearbeiten', 'produkt_entwerfen', 'projekt_planen_organisieren'], umgebung: { drinnen_draussen: 30, allein_team: 60, routine_wechsel: 50, anpacken_konzentriert: 40 }, schulabschluss_min: 'realschule', ausbildungsart: 'weiterbildung', mediangehalt: 3500, seltenheit: 'haeufig', osm_tags: [] },
  ];
  const p = profil({ taetigkeiten: ['holz_bearbeiten', 'produkt_entwerfen', 'praezisionsarbeit_hand'] });
  const einstieg = matche(mitStufe, p, fragen);
  const anschluss = matcheAnschluss(mitStufe, p, fragen);
  ok(einstieg.every((m) => ['ausbildung', 'bachelor'].includes(m.beruf.stufe)), 'matche() liefert nur Einstieg-Stufen');
  ok(anschluss.length > 0 && anschluss.every((m) => ['master', 'weiterbildung'].includes(m.beruf.stufe)), 'matcheAnschluss() liefert nur Master/Weiterbildung');
}

// 8) Sicherheitsnetz: ein Weg, den (fast) kein Beruf trägt (z.B. duales_studium),
//    darf den Pool nicht kollabieren lassen — Fallback liefert Interesse-Treffer.
{
  const p = profil({ blockA: { weg: new Set(['duales_studium']) }, taetigkeiten: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'produkt_entwerfen'] });
  // Keiner der Test-Berufe ist ausbildungsart "duales_studium" → ohne Netz wäre der Pool leer.
  const top = matche(BERUFE, p, fragen);
  ok(top.length > 0 && top.some((m) => m.beruf.tags.includes('holz_bearbeiten')), 'Sicherheitsnetz: seltener Weg kollabiert den Pool nicht (Interesse-Fallback)');
}

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
process.exit(fehlgeschlagen ? 1 : 0);
