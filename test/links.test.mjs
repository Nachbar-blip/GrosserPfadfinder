/**
 * links.test.mjs — Tests für die Link-Builder (BA-Jobsuche, Studiensuche, BERUFENET, Karte).
 * Die URL-Formate wurden am 2026-10-19 im echten Browser gegen die Zielseiten geprüft
 * (siehe docs/datenquellen.md §4). Ohne Test-Framework: node test/links.test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stellenLink, berufenetLink } from '../public/js/api/ba.js';
import { betriebeLink, kartenBegriff } from '../public/js/api/karte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const berufe = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', 'berufe.json'), 'utf8'));

let bestanden = 0;
let fehlgeschlagen = 0;
function ok(bedingung, name) {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name}`); }
}
const param = (url, key) => new URL(url).searchParams.get(key);

console.log('links.test.mjs');

// --- Jobsuche: offizieller BERUFENET-Name 1:1 (die Jobbörse erkennt ihn als Beruf) ---
{
  const mfa = { name: 'Medizinische/r Fachangestellte/r', ausbildungsart: 'betriebliche_ausbildung' };
  const l = stellenLink(mfa, '10115', 50);
  ok(param(l.url, 'was') === 'Medizinische/r Fachangestellte/r', 'Jobsuche: voller Name statt abgeschnittenem „Medizinische“');
  ok(param(l.url, 'wo') === '10115' && param(l.url, 'umkreis') === '50', 'Jobsuche: PLZ + Umkreis übernommen');
  ok(param(l.url, 'angebotsart') === '4', 'Jobsuche: Angebotsart Ausbildung');

  const buero = { name: 'Kaufmann/-frau für Büromanagement', ausbildungsart: 'betriebliche_ausbildung' };
  ok(param(stellenLink(buero, '', 50).url, 'was') === 'Kaufmann/-frau für Büromanagement', 'Jobsuche: Kaufmann/-frau für … bleibt vollständig');

  const imker = { name: 'Tierwirt/in - Imkerei', ausbildungsart: 'betriebliche_ausbildung' };
  ok(param(stellenLink(imker, '', 50).url, 'was') === 'Tierwirt/in - Imkerei', 'Jobsuche: Fachrichtung bleibt erhalten');

  const dual = { name: 'Informatik (dual)', ausbildungsart: 'duales_studium' };
  ok(stellenLink(dual, '', 50).url.startsWith('https://www.arbeitsagentur.de/jobsuche/suche?'), 'Duales Studium → Jobsuche (Ausbildung)');
}

// --- Studiensuche: Parameter ssw (nicht suchbegriff), Klammerzusatz weg, nur grundständig ---
{
  const vi = { name: 'Verwaltungsinformatik (grundständig)', ausbildungsart: 'studium', stufe: 'bachelor' };
  const l = stellenLink(vi, '10115', 50);
  ok(l.url.startsWith('https://web.arbeitsagentur.de/studiensuche/suche?'), 'Studium → Studiensuche');
  ok(param(l.url, 'ssw') === 'Verwaltungsinformatik', 'Studiensuche: Suchbegriff in ssw, ohne „(grundständig)“');
  ok(param(l.url, 'suchbegriff') === null, 'Studiensuche: alter, ignorierter Parameter suchbegriff entfernt');
  ok(param(l.url, 'st') === '0', 'Studiensuche: Filter grundständig (st=0)');
  ok(param(l.url, 'sty') === '0', 'Studiensuche: Suchtyp Suchbegriffe (sty=0)');

  const theo = { name: 'Theologie - Katholische Theologie (grundständig außer kirchliche Abschlüsse)', ausbildungsart: 'studium', stufe: 'bachelor' };
  ok(param(stellenLink(theo, '', 50).url, 'ssw') === 'Theologie - Katholische Theologie', 'Studiensuche: langer Klammerzusatz entfernt');
}

// --- BERUFENET: unverändert über die ID ---
ok(berufenetLink({ id: 4460 }) === 'https://web.arbeitsagentur.de/berufenet/beruf/4460', 'BERUFENET-Link über ID');

// --- Karte: Google-Maps-Suche mit deutschem Branchenbegriff + PLZ ---
{
  const tischler = { name: 'Tischler/in', osm_tags: ['craft=carpenter', 'craft=joiner'] };
  ok(kartenBegriff(tischler) === 'Tischlerei', 'Kartenbegriff: craft=carpenter → Tischlerei');
  const l = betriebeLink(tischler, '10115');
  ok(l && l.url.startsWith('https://www.google.com/maps/search/?api=1&query='), 'Karte: offizielles Google-Maps-URL-Format');
  ok(l && param(l.url, 'query') === 'Tischlerei 10115', 'Karte: Suchbegriff + PLZ');
  ok(betriebeLink(tischler, '') === null, 'Karte: ohne PLZ kein Button');
  ok(betriebeLink({ name: 'Büro', osm_tags: [] }, '10115') === null, 'Karte: ohne osm_tags kein Button');
  ok(kartenBegriff({ osm_tags: ['gibt=esnicht', 'amenity=hospital'] }) === 'Krankenhaus', 'Kartenbegriff: unbekannter Tag → nächster Tag');
  ok(kartenBegriff({ osm_tags: ['leisure=pitch,sport=tennis'] }) === 'Tennisverein', 'Kartenbegriff: kaputter Kombi-Tag abgedeckt');
}

// --- Abdeckung: jeder Einstiegsberuf mit osm_tags bekommt einen Kartenbegriff ---
{
  const einstieg = berufe.filter((b) => (b.stufe === 'ausbildung' || b.stufe === 'bachelor') && (b.osm_tags || []).length);
  const ohne = einstieg.filter((b) => !kartenBegriff(b));
  ok(ohne.length === 0, `Abdeckung: alle ${einstieg.length} Einstiegsberufe mit osm_tags haben einen Kartenbegriff`);
  if (ohne.length) console.log('    fehlend:', ohne.slice(0, 10).map((b) => `${b.name} ${JSON.stringify(b.osm_tags)}`));
  const alleTags = new Set(berufe.flatMap((b) => b.osm_tags || []));
  const ungelabelt = [...alleTags].filter((t) => !kartenBegriff({ osm_tags: [t] }));
  ok(ungelabelt.length === 0, `Abdeckung: alle ${alleTags.size} OSM-Tags in berufe.json haben ein deutsches Label`);
  if (ungelabelt.length) console.log('    ohne Label:', ungelabelt.join(' '));
}

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
if (fehlgeschlagen) process.exit(1);
