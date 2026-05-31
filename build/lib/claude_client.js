'use strict';
/**
 * claude_client.js — Anthropic-Wrapper fürs Tagging (nur Build, nicht Frontend).
 *
 * Baut den (gecachten) System-Prompt aus tags.json + dem verifizierten
 * OSM-Tag-Mapping und taggt einen einzelnen Beruf. Prompt-Caching spart Kosten,
 * weil das große Vokabular über alle Aufrufe wiederverwendet wird.
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 1024;

// OSM-Tag-Hinweise je Oberkategorie (taginfo-verifiziert, siehe docs/datenquellen.md).
// Der Tagger wählt daraus passende, REAL existierende OSM-Tags für osm_tags.
const OSM_HINWEISE = {
  handwerk_material: 'craft=carpenter|joiner|cabinet_maker|stonemason|glaziery|tiler|tailor|dressmaker|upholsterer|shoemaker, shop=tailor',
  technik_maschinen: 'shop=car_repair|car, craft=electrician|metal_construction|blacksmith|locksmith|agricultural_engines',
  elektronik_it: 'office=it, shop=computer|electronics',
  medizin_pflege: 'amenity=doctors|dentist|pharmacy|clinic|hospital|social_facility|nursing_home, healthcare=doctor|dentist|physiotherapist|pharmacy',
  labor_naturwissenschaft: '(meist kein Publikumsbetrieb in OSM → oft leer)',
  bau_architektur: 'craft=roofer|bricklayer|builder|painter|plumber|hvac, office=architect',
  natur_umwelt: 'craft=gardener|beekeeper, shop=garden_centre, landuse=farmyard',
  tiere: 'amenity=veterinary, healthcare=veterinary',
  gestaltung_design: 'craft=jeweller|photographer, shop=jewelry|musical_instrument',
  sprache_kommunikation: 'shop=books, office=newspaper',
  bildung_soziales: 'amenity=kindergarten|childcare|library|driving_school',
  wirtschaft_verwaltung: 'amenity=bank, office=tax_advisor|accountant|insurance|estate_agent, shop=supermarket|convenience',
  recht_sicherheit: 'office=lawyer|government',
  gastronomie_lebensmittel: 'shop=bakery|confectionery|pastry|butcher, amenity=restaurant|cafe|fast_food, craft=brewery|winery',
  verkehr_logistik: 'amenity=fuel, shop=car_repair (reine Logistik oft ohne Einzelbetrieb → ggf. leer)',
};

/**
 * Extrahiert das erste vollständige, balancierte JSON-Objekt aus dem Text —
 * robust gegen Code-Fences und nachgestellte Prosa (manche Modelle hängen nach
 * dem JSON noch Erklärungen an, was JSON.parse sonst scheitern lässt).
 */
function ersteJsonObjekt(text) {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('kein JSON-Objekt in der Antwort');
  let tiefe = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') tiefe++;
    else if (c === '}' && --tiefe === 0) return text.slice(start, i + 1);
  }
  throw new Error('unvollständiges JSON-Objekt in der Antwort');
}

function ladeEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('DEIN_')) {
    throw new Error('ANTHROPIC_API_KEY fehlt oder ist Platzhalter (.env).');
  }
}

function baueSystemPrompt(tagsJson) {
  const osmText = Object.entries(OSM_HINWEISE).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  return `Du taggst einen Ausbildungsberuf oder Studiengang für ein Berufsorientierungs-Tool für Schüler:innen (Klasse 9–12).

REGELN:
- Verwende für "kategorien" und "tags" AUSSCHLIESSLICH Werte, die WÖRTLICH im unten stehenden Vokabular stehen. Kopiere die Tag-Strings exakt. Erfinde KEINE neuen Tags und ändere keine Schreibweise — frei erfundene Tags werden verworfen.
- Vergib IMMER mindestens 3 gültige Tags. Wenn kein exakt passender existiert, nimm den semantisch NÄCHSTEN aus der Liste, statt einen zu erfinden. Beispiele: Ton/Keramik/Modellieren/Gips → stein_keramik_formen; Papier/Karton/Buchbinden → produkt_entwerfen + praezisionsarbeit_hand; Reinigen/Pflegen von Oberflächen → maschine_bedienen + praezisionsarbeit_hand; medizinische Hilfsmittel/Prothesen fertigen → praezisionsarbeit_hand + metall_bearbeiten + produkt_entwerfen.
- 3 bis 6 Tags, die CHARAKTERISTISCH sind (nicht nur am Rande zutreffend). 1 bis 3 Oberkategorien.
- Schätze vier Umgebungs-Werte (0–100):
    drinnen_draussen: 0 = komplett drinnen, 100 = komplett draußen
    allein_team: 0 = allein, 100 = im Team
    routine_wechsel: 0 = ruhige Routine, 100 = ständiger Wechsel
    anpacken_konzentriert: 0 = körperlich anpackend, 100 = still konzentriert
- "osm_tags": 0–3 REAL existierende OpenStreetMap-Tags ("key=value"), mit denen man typische Betriebe dieses Berufs auf einer Karte findet. Nur wenn es solche Publikums-/Handwerksbetriebe gibt; reine Industrie-/Bürotätigkeiten ohne auffindbaren Einzelbetrieb bekommen []. Orientiere dich an diesen geprüften Mustern je Kategorie:
${osmText}
- "schulabschluss_min": realistischer Mindest-Schulabschluss, einer von: hauptschule, realschule, fachhochschulreife, abitur. (Studiengänge i.d.R. fachhochschulreife oder abitur.)
- "ausbildungsart": einer von: betriebliche_ausbildung (duale Ausbildung in Betrieb+Berufsschule), schulische_ausbildung (an einer Berufsfachschule), duales_studium, studium (Hochschulstudium), weiterbildung (Aufstiegsfortbildung wie Meister/Techniker/Fachwirt, baut auf einer Ausbildung auf). Richte dich nach dem Feld "stufe" im Input: stufe=master → studium; stufe=weiterbildung → weiterbildung; stufe=bachelor → studium; stufe=ausbildung → betriebliche_ oder schulische_ausbildung bzw. duales_studium laut Steckbrief.
- "ki_risiko": realistische Einschätzung, wie stark Künstliche Intelligenz und Automatisierung diesen Beruf in den nächsten ~10 Jahren verändern oder Tätigkeiten ersetzen — einer von: niedrig, mittel, hoch. Differenziere ehrlich: körpernahe, handwerkliche, pflegerische, zwischenmenschliche und unvorhersehbare Tätigkeiten eher niedrig; stark standardisierte Routine-, Büro-, Sachbearbeitungs- und reine Datentätigkeiten eher hoch. Keine pauschale Panik.
- "zukunft_text": ein bis zwei ehrliche, konkrete Sätze auf Deutsch: WAS verändert KI/Automatisierung in diesem Beruf konkret und wie zukunftssicher gilt er? Sachlich, ohne Angstmacherei und ohne Schönfärberei.
- "mediangehalt": grobe SCHÄTZUNG des monatlichen Brutto-Einstiegsgehalts NACH der Ausbildung/dem Studium in Euro (ganze Zahl), basierend auf deinem Wissen und der genannten Ausbildungsvergütung. Kein exakter Wert nötig.
- "dauer_jahre": typische Dauer in Jahren (Zahl, ggf. Dezimal), aus dem Input ableiten.
- "seltenheit": Verfügbarkeit von Ausbildungs-/Studienplätzen in Deutschland — einer von: haeufig (überall), regional (nur in manchen Regionen), selten (bundesweit nur wenige Standorte, z.B. Orgelbauer, Geigenbauer).
- "needs_review": true, wenn die Beschreibung zu unklar ist oder der Beruf nicht sinnvoll ins Vokabular passt.
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Keine Prosa, kein Markdown-Codeblock.

FORMAT:
{"id":<id>,"name":"<name>","kategorien":["..."],"tags":["..."],"umgebung":{"drinnen_draussen":<0-100>,"allein_team":<0-100>,"routine_wechsel":<0-100>,"anpacken_konzentriert":<0-100>},"osm_tags":["key=value"],"schulabschluss_min":"<...>","ausbildungsart":"<...>","mediangehalt":<zahl>,"dauer_jahre":<zahl>,"seltenheit":"<...>","ki_risiko":"<niedrig|mittel|hoch>","zukunft_text":"<1-2 Sätze>","needs_review":<true|false>}

VOKABULAR:
${JSON.stringify(tagsJson, null, 2)}`;
}

function erstelleTagger(tagsJson, { model } = {}) {
  ladeEnv();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = baueSystemPrompt(tagsJson);
  const MODEL = model || process.env.TAG_MODEL || DEFAULT_MODEL;

  async function taggeEinen(rohBeruf) {
    const userMessage = `Beruf-Input:\n${JSON.stringify(
      {
        id: rohBeruf.id,
        name: rohBeruf.name,
        gattung: rohBeruf.gattung,
        stufe: rohBeruf.stufe,
        beschreibung: rohBeruf.beschreibung,
        anforderungen: rohBeruf.anforderungen,
        taetigkeitsfelder: rohBeruf.taetigkeitsfelder,
        ausbildung_steckbrief: rohBeruf.steckbrief_kurz,
        ausbildungsverguetung: rohBeruf.verguetung,
        kldb2010: rohBeruf.kldb2010,
      },
      null,
      1,
    )}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content.map((c) => c.text || '').join('').trim();
    const usage = response.usage || {};
    return { parsed: JSON.parse(ersteJsonObjekt(text)), usage };
  }

  return { taggeEinen, MODEL, systemPrompt };
}

module.exports = { erstelleTagger, baueSystemPrompt, DEFAULT_MODEL };
