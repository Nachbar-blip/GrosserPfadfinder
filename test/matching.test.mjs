/**
 * matching.test.mjs — Unit-Tests für den Matching-Algorithmus (Spec §13.6).
 * Ohne Test-Framework: node test/matching.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matche, matcheAnschluss, hartFiltern, bewerteBeruf, scoreProzent, passungsStufe, aktiveBoostDomaenen } from '../public/js/matching.js';

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

// 9) Reha-Filter: §66-BBiG-Berufe (reha_ausbildung) erscheinen nicht im Schüler-Ranking.
{
  const mitReha = [
    ...BERUFE,
    { id: 90, name: 'Fachpraktiker/in für Tischler (§66 BBiG/§42r HwO)', reha_ausbildung: true, kategorien: ['handwerk_material'], tags: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'maschine_bedienen'], umgebung: { drinnen_draussen: 20, allein_team: 40, routine_wechsel: 40, anpacken_konzentriert: 30 }, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', mediangehalt: 1800, seltenheit: 'haeufig', osm_tags: [] },
  ];
  const p = profil({ taetigkeiten: ['holz_bearbeiten', 'praezisionsarbeit_hand', 'produkt_entwerfen'] });
  const gefiltert = hartFiltern(mitReha, p, fragen);
  const top = matche(mitReha, p, fragen);
  ok(!gefiltert.some((b) => b.id === 90) && !top.some((m) => m.beruf.id === 90), 'Reha-Filter: §66-BBiG-Beruf wird aus dem Ranking genommen');
}

// 10) Mobilitäts-Nudge: ein seltener Beruf wird bei „in der Nähe bleiben" (25) abgewertet,
//     bei „pendeln" (100) neutral, bei „umziehen" (200) leicht aufgewertet.
{
  const selten = { id: 81, name: 'Selten-Beruf', kategorien: ['gestaltung_design'], tags: ['metall_bearbeiten'], umgebung: {}, seltenheit: 'selten', ausbildungsart: 'betriebliche_ausbildung' };
  const kontext = { gehaltMax: 0, mobilNudge: true };
  const nah = bewerteBeruf(selten, profil({ blockA: { umkreis: '25' } }), fragen, kontext).score;
  const pendeln = bewerteBeruf(selten, profil({ blockA: { umkreis: '100' } }), fragen, kontext).score;
  const umzug = bewerteBeruf(selten, profil({ blockA: { umkreis: '200' } }), fragen, kontext).score;
  ok(nah < pendeln && pendeln < umzug, 'Mobilitäts-Nudge: selten — 25 km < 100 km < 200 km im Score');
}

// 11) Mobilitäts-Nudge ist aus, wenn nicht angefordert (Anschluss-Sektion / mobilNudge:false).
{
  const selten = { id: 82, name: 'Selten-Beruf', kategorien: [], tags: ['metall_bearbeiten'], umgebung: {}, seltenheit: 'selten' };
  const aus = bewerteBeruf(selten, profil({ blockA: { umkreis: '25' } }), fragen, { gehaltMax: 0, mobilNudge: false }).score;
  const an = bewerteBeruf(selten, profil({ blockA: { umkreis: '25' } }), fragen, { gehaltMax: 0, mobilNudge: true }).score;
  ok(aus > an, 'Mobilitäts-Nudge: bei mobilNudge:false (Anschluss) keine Abwertung');
}

// 12) Integration: die Mobilitäts-Wahl kippt die Reihenfolge zweier sonst gleichwertiger Berufe.
{
  const berufe = [
    { id: 70, name: 'Metall (häufig)', stufe: 'ausbildung', kategorien: ['technik_maschinen'], tags: ['metall_bearbeiten'], umgebung: {}, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', seltenheit: 'haeufig', osm_tags: [] },
    { id: 71, name: 'Holz (selten)', stufe: 'ausbildung', kategorien: ['handwerk_material'], tags: ['holz_bearbeiten'], umgebung: {}, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', seltenheit: 'selten', osm_tags: [] },
  ];
  const taet = ['metall_bearbeiten', 'holz_bearbeiten'];
  const nah = matche(berufe, profil({ blockA: { umkreis: '25' }, taetigkeiten: taet }), fragen);
  const umzug = matche(berufe, profil({ blockA: { umkreis: '200' }, taetigkeiten: taet }), fragen);
  ok(nah[0]?.beruf.id === 70 && umzug[0]?.beruf.id === 71, 'Mobilitäts-Nudge (Integration): „in der Nähe" zeigt häufigen zuerst, „umziehen" hebt seltenen nach oben');
}

// 13) aktiveBoostDomaenen: Trenn-Logik (Indikator + Fallback).
{
  const dom = (tags) => aktiveBoostDomaenen(new Set(tags)).map((d) => d.domaene).sort();
  const sd = (a) => a.slice().sort();
  ok(dom([]).length === 0, 'Boost-Trennung: ohne Trigger keine Domäne');
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren'])) === JSON.stringify(sd(['luftfahrt', 'maritim'])), 'Boost-Trennung: mehrdeutig → beide Domänen');
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen'])) === JSON.stringify(['maritim']), 'Boost-Trennung: Wasser-Indikator → nur maritim');
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'elektronik_loeten'])) === JSON.stringify(['luftfahrt']), 'Boost-Trennung: Avionik-Indikator → nur luftfahrt');
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'elektronik_loeten', 'boden_wasser_untersuchen'])) === JSON.stringify(sd(['luftfahrt', 'maritim'])), 'Boost-Trennung: beidseitiger Indikator → beide');
  ok(JSON.stringify(dom(['recherche_journalistisch'])) === JSON.stringify(['journalismus']), 'Boost-Trennung: Journalismus-Trigger aktiv');
}

// 14) Berufsnamen-Boost: greift nur mit Trigger, hinter Relevanz-Gate, nur bei nameBoost:true.
{
  const schiffBeruf = { id: 60, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['maschine_warten_reparieren', 'hydraulik_pneumatik'], umgebung: {}, seltenheit: 'regional', ausbildungsart: 'betriebliche_ausbildung' };
  const kAn = (p) => ({ gehaltMax: 0, mobilNudge: false, nameBoost: true, boostDomaenen: aktiveBoostDomaenen(p.taetigkeiten) });
  const kAus = { gehaltMax: 0, mobilNudge: false, nameBoost: false, boostDomaenen: [] };
  const mitTrigger = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen', 'maschine_warten_reparieren'] });
  const ohneTrigger = profil({ taetigkeiten: ['maschine_warten_reparieren'] });
  const sBoost = bewerteBeruf(schiffBeruf, mitTrigger, fragen, kAn(mitTrigger)).score;
  const sOhneTrigger = bewerteBeruf(schiffBeruf, ohneTrigger, fragen, kAn(ohneTrigger)).score;
  const sNudgeAus = bewerteBeruf(schiffBeruf, mitTrigger, fragen, kAus).score;
  ok(sBoost > sNudgeAus, 'Name-Boost: mit Trigger+Keyword höher als bei nameBoost:false');
  ok(Math.abs(sOhneTrigger - sNudgeAus) < 1e-9, 'Name-Boost: ohne Trigger kein Boost');
  const fremd = { id: 61, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['zahn_behandeln'], umgebung: {}, seltenheit: 'regional', ausbildungsart: 'betriebliche_ausbildung' };
  const gateProfil = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen'] });
  const fAn = bewerteBeruf(fremd, gateProfil, fragen, kAn(gateProfil)).score;
  const fAus = bewerteBeruf(fremd, gateProfil, fragen, kAus).score;
  ok(Math.abs(fAn - fAus) < 1e-9, 'Name-Boost: Relevanz-Gate — ohne gemeinsamen Tag kein Boost');
}

// 15) Domänen-Trennung wirkt im Score: klarer Luftfahrt-Lean boostet Flug-, nicht Schiff-Beruf.
{
  const flug = { id: 62, name: 'Fluggerätmechaniker/in', kategorien: ['technik_maschinen'], tags: ['metall_bearbeiten', 'praezisionsarbeit_hand'], umgebung: {}, seltenheit: 'regional' };
  const schiff = { id: 63, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['metall_bearbeiten', 'praezisionsarbeit_hand'], umgebung: {}, seltenheit: 'regional' };
  const luftLean = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'elektronik_loeten', 'metall_bearbeiten'] });
  const kontextAn = { gehaltMax: 0, mobilNudge: false, nameBoost: true, boostDomaenen: aktiveBoostDomaenen(luftLean.taetigkeiten) };
  const flugScore = bewerteBeruf(flug, luftLean, fragen, kontextAn).score;
  const schiffScore = bewerteBeruf(schiff, luftLean, fragen, kontextAn).score;
  ok(flugScore > schiffScore, 'Name-Boost: Luftfahrt-Lean boostet Flug- über Schiff-Beruf');
}

// 16) Journalismus: Trigger recherche_journalistisch boostet Journalist/in.
{
  const journo = { id: 64, name: 'Journalist/in (Ausbildung)', kategorien: ['sprache_kommunikation'], tags: ['recherche_journalistisch', 'text_schreiben_redigieren'], umgebung: {}, seltenheit: 'regional' };
  const p = profil({ taetigkeiten: ['recherche_journalistisch', 'text_schreiben_redigieren'] });
  const an = bewerteBeruf(journo, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: true, boostDomaenen: aktiveBoostDomaenen(p.taetigkeiten) }).score;
  const aus = bewerteBeruf(journo, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: false, boostDomaenen: [] }).score;
  ok(an > aus, 'Name-Boost: Journalismus-Trigger hebt Journalist/in');
}

// 17) matcheAnschluss boostet NICHT (nameBoost bleibt aus).
{
  const anschlussBeruf = { id: 65, name: 'Schiffbau, Meerestechnik (weiterführend)', stufe: 'master', kategorien: ['technik_maschinen'], tags: ['maschine_warten_reparieren', 'schweissen_loeten'], umgebung: {}, seltenheit: 'regional' };
  const p = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen', 'maschine_warten_reparieren'] });
  const res = matcheAnschluss([anschlussBeruf], p, fragen);
  const direkt = bewerteBeruf(anschlussBeruf, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: false, boostDomaenen: [] }).score;
  ok(res.length === 1 && Math.abs(res[0].score - direkt) < 1e-9, 'Name-Boost: Anschluss-Sektion erhält keinen Boost');
}

// 18) Integration: Bei sonst gleichwertigen Bewerbern hebt der Boost den Familienberuf
//     mit Domänen-Keyword über den neutralen Beruf.
{
  const berufe = [
    { id: 80, name: 'Industriemechaniker/in', stufe: 'ausbildung', kategorien: ['technik_maschinen'], tags: ['maschine_warten_reparieren', 'hydraulik_pneumatik'], umgebung: {}, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', seltenheit: 'haeufig', osm_tags: [] },
    { id: 81, name: 'Schiffsmechaniker/in', stufe: 'ausbildung', kategorien: ['verkehr_logistik'], tags: ['maschine_warten_reparieren', 'hydraulik_pneumatik'], umgebung: {}, schulabschluss_min: 'hauptschule', ausbildungsart: 'betriebliche_ausbildung', seltenheit: 'regional', osm_tags: [] },
  ];
  const p = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen', 'maschine_warten_reparieren', 'hydraulik_pneumatik'] });
  const top = matche(berufe, p, fragen);
  ok(top[0]?.beruf.id === 81, 'Integration: maritimes Interesse hebt Schiffsmechaniker an die Spitze');
}

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
process.exit(fehlgeschlagen ? 1 : 0);
