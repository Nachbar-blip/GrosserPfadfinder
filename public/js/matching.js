/**
 * matching.js — Scoring-Algorithmus: Berufe ↔ Fragebogen-Antworten.
 *
 * Reine Logik, kein DOM, keine Globals — damit testbar (siehe build/test/).
 * Input:  berufe[], antworten{}, fragenDef{} (aus fragen.json)
 * Output: bis zu 10 gerankte, diversifizierte Treffer mit Begründungs-Daten.
 *
 * Ablauf (vgl. PFADFINDER_CLAUDE_CODE_PROMPT.md §7):
 *   harte Filter → Tag/Umgebung/Motivation-Score → Gehalt/Sinn-Bonus
 *   → Schwelle → Diversifizierung → Top 5–10.
 */

// ---- Gewichte & Schwellen (einzige Quelle, verhindert Drift) ----
export const W_TAGS = 0.6;
export const W_UMGEBUNG = 0.25;
export const W_MOTIVATION = 0.15;
// Kleine additive Nudges (verändern Reihenfolge, nicht die Grundlogik):
export const W_GEHALT = 0.08;
export const W_SINN = 0.08;
// Mobilitäts-Nudge: koppelt die Pendel-/Umzugs-Bereitschaft (umkreis-Frage) an das
// EINZIGE reale Geo-Signal pro Beruf — beruf.seltenheit (haeufig/regional/selten).
// Additiv und klein (Größenordnung der anderen Nudges), damit Interesse dominiert.
// Berufe sind nicht geokodiert, deshalb ist das eine ehrliche Heuristik, kein km-Filter.
export const W_MOBILITAET = 0.08;
export const MOBILITAET_NUDGE = {
  '25': { haeufig: 1, regional: 0.3, selten: -1 },   // in der Nähe bleiben / täglich pendeln
  '100': { haeufig: 0, regional: 0, selten: 0 },      // längeres Pendeln ok → neutral (ehrlicher Default)
  '200': { haeufig: 0, regional: 0, selten: 0.4 },    // würde umziehen → seltene Nischenberufe leicht hervorheben
};

// Berufsnamen-/Erwartungs-Boost: hebt etablierte Berufsfamilien, die das 81-Tag-System
// nur GENERISCH abbildet (kein „luftfahrt"-/„maritim"-Tag), anhand eines Schlüsselworts
// im BERUFSNAMEN — ausgelöst durch ein angekreuztes Domänen-Interesse. Additiv und klein
// (Nudge-Größenordnung), nur für Einstiegswege. Deterministisch, kein Re-Tagging.
// sport_it trägt bewusst leere triggerTags → feuert nie (dokumentierter No-Op bis ein
// Daten-Refresh „Sportinformatik" aufnimmt, P4). Siehe docs/plans/2026-06-05-…-design.md.
export const W_NAME_BOOST = 0.08;
// Annahme: max. 1 Trigger-Tag pro Domäne; Mehrfach-Trigger erfordern clusterbasierte Konkurrenz-Logik in aktiveBoostDomaenen.
export const NAME_BOOST = [
  { domaene: 'luftfahrt', triggerTags: ['flugzeug_schiff_fuehren'],
    indikatorTags: ['elektronik_loeten', 'code_schreiben'],          // Avionik/Drohnen → Luft
    keywords: ['flug', 'luftfahrt', 'fluggerät'] },
  { domaene: 'maritim', triggerTags: ['flugzeug_schiff_fuehren'],
    indikatorTags: ['boden_wasser_untersuchen', 'waren_verladen_lagern', 'holz_bearbeiten'],
    keywords: ['schiff', 'boot', 'maritim', 'nautik'] },
  { domaene: 'journalismus', triggerTags: ['recherche_journalistisch'],
    indikatorTags: [], keywords: ['journalist', 'redakteur'] },
  { domaene: 'sport_it', triggerTags: [],
    indikatorTags: [], keywords: ['sportinformatik'] },
];

/**
 * Trenn-Logik für den Berufsnamen-Boost (Indikator mit Fallback):
 * Welche NAME_BOOST-Domänen sind für die angekreuzten Tätigkeiten aktiv?
 * - Domäne ohne konkurrierenden Trigger (z. B. Journalismus) → aktiv, sobald getriggert.
 * - Bei geteiltem Trigger (Luft/Schiff): klarer Lean (Indikator nur einer Seite) → nur die;
 *   mehrdeutig (kein/beidseitiger Indikator) → beide (sichere Degradation).
 */
export function aktiveBoostDomaenen(userTags) {
  const tags = alsSet(userTags);
  const getriggert = NAME_BOOST.filter((d) => d.triggerTags.some((t) => tags.has(t)));
  return getriggert.filter((d) => {
    const konkurrenten = getriggert.filter(
      (o) => o !== d && o.triggerTags.some((t) => d.triggerTags.includes(t)),
    );
    if (konkurrenten.length === 0) return true;                    // kein Wettbewerb → aktiv
    const leanD = d.indikatorTags.some((t) => tags.has(t));
    if (leanD) return true;                                         // (Mit-)Lean zu D → aktiv
    const leanKonkurrent = konkurrenten.some((o) => o.indikatorTags.some((t) => tags.has(t)));
    return !leanKonkurrent;                                         // nur Fallback, wenn kein Konkurrent klar führt
  });
}

export const SCHWELLE_RELEVANT = 0.25; // ohne 2+ Tag-Match nötiger Mindest-Score
export const SCHWELLE_STARK = 0.6;     // „starke Passung" (Balken = 100 %)
export const MAX_ERGEBNISSE = 10;
export const MAX_PRO_KAT = 2;
export const MAX_TAG_OVERLAP = 0.6;

export const PASSUNGS_STUFEN = [
  { min: SCHWELLE_STARK, klasse: '', text: 'starke Passung' },
  { min: SCHWELLE_RELEVANT, klasse: 'mittel', text: 'mittlere Passung' },
  { min: 0, klasse: 'schwach', text: 'schwache Passung' },
];

// Schulabschluss-Rangfolge für den harten Filter (höher = mehr Berufe erreichbar).
const ABSCHLUSS_RANG = {
  hauptschule: 0,
  realschule: 1,
  fachhochschulreife: 2,
  abitur: 3,
};

// ---- kleine Helfer ----

function alsSet(x) {
  if (x instanceof Set) return x;
  if (Array.isArray(x)) return new Set(x);
  if (x == null) return new Set();
  return new Set([x]);
}

function tagUeberlapp(a, b) {
  const sa = alsSet(a);
  const sb = alsSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let gemeinsam = 0;
  for (const t of sa) if (sb.has(t)) gemeinsam++;
  return gemeinsam / Math.min(sa.size, sb.size);
}

/**
 * Harte Filter: schließt Berufe aus, die der angestrebte Schulabschluss
 * oder der gewünschte Weg (Ausbildung/Studium) ausschließen.
 * Leere/„unsicher"/„unbekannt"-Angaben filtern bewusst NICHT (lieber zu viel zeigen).
 */
export function hartFiltern(berufe, antworten, fragenDef, { wegFilter = true } = {}) {
  const a = antworten.blockA || {};

  // 1) Schulabschluss: Beruf bleibt, wenn sein Mindestabschluss ≤ angestrebtem.
  const schulRang = ABSCHLUSS_RANG[a.schulabschluss];
  const schulFilterAktiv = a.schulabschluss && a.schulabschluss !== 'unsicher' && schulRang != null;

  // 2) Ausbildungsart: aus den gewählten Weg-Optionen die akzeptierten Arten sammeln.
  const wegWerte = alsSet(a.weg);
  const akzeptierteArten = new Set();
  let wegFilterAktiv = false;
  const wegOption = (fragenDef.block_a || []).find((f) => f.id === 'weg');
  if (wegFilter && wegOption && wegWerte.size > 0 && !wegWerte.has('unbekannt')) {
    for (const opt of wegOption.optionen) {
      if (wegWerte.has(opt.wert)) {
        for (const art of opt.akzeptiert || []) akzeptierteArten.add(art);
      }
    }
    wegFilterAktiv = akzeptierteArten.size > 0;
  }

  return berufe.filter((b) => {
    if (b.needs_review) return false;
    // Reha-/Fachpraktiker-Ausbildungen (§66 BBiG/§42r HwO): theoriereduzierte Wege für
    // Menschen mit Behinderung, Vermittlung nur über die Reha-Beratung (nicht der offene
    // Stellenmarkt). Nicht ins allgemeine Schüler-Ranking — als Datensatz bleiben sie erhalten.
    if (b.reha_ausbildung) return false;
    if (schulFilterAktiv) {
      const bMin = ABSCHLUSS_RANG[b.schulabschluss_min ?? b.schulabschluss];
      if (bMin != null && bMin > schulRang) return false;
    }
    if (wegFilterAktiv) {
      if (!akzeptierteArten.has(b.ausbildungsart)) return false;
    }
    return true;
  });
}

/** Bewertet einen einzelnen Beruf gegen die Antworten. */
export function bewerteBeruf(beruf, antworten, fragenDef, kontext) {
  const userTags = alsSet(antworten.taetigkeiten);
  const userMotiv = alsSet(antworten.motivation);
  const regler = antworten.regler || {};
  const reglerDefs = fragenDef.regler || [];
  const motivMapping = fragenDef.motivation_mapping || {};

  // 1) Tag-Score: Anteil der Beruf-Tags, die angekreuzt wurden (normalisiert).
  const berufTags = beruf.tags || [];
  const matchTags = berufTags.filter((t) => userTags.has(t));
  const tagScore = berufTags.length > 0 ? matchTags.length / berufTags.length : 0;

  // 2) Umgebungs-Score: mittlere Nähe der Regler-Werte zum Beruf-Profil.
  let umgDiff = 0;
  let reglerAnzahl = 0;
  for (const r of reglerDefs) {
    const userVal = regler[r.id];
    if (userVal == null) continue;
    const berufVal = beruf.umgebung && beruf.umgebung[r.id] != null ? beruf.umgebung[r.id] : 50;
    umgDiff += Math.abs(userVal - berufVal);
    reglerAnzahl++;
  }
  const umgebungScore = reglerAnzahl > 0 ? 1 - umgDiff / (reglerAnzahl * 100) : 0.5;

  // 3) Motivations-Score: Überlapp gewählte Motivationen ↔ Beruf-Kategorien.
  const berufKat = new Set(beruf.kategorien || []);
  let motOverlap = 0;
  if (userMotiv.size > 0 && berufKat.size > 0) {
    for (const kat of berufKat) {
      for (const m of userMotiv) {
        if ((motivMapping[m] || []).includes(kat)) {
          motOverlap++;
          break;
        }
      }
    }
  }
  const motivationScore = berufKat.size > 0 ? motOverlap / berufKat.size : 0;

  let gesamt = W_TAGS * tagScore + W_UMGEBUNG * umgebungScore + W_MOTIVATION * motivationScore;

  // 4a) Gehalt-Nudge: nur wenn dem/der Schüler:in wichtig.
  const gehaltWichtig = (antworten.blockA || {}).gehalt_wichtig;
  if (gehaltWichtig && gehaltWichtig !== 'egal' && beruf.mediangehalt && kontext && kontext.gehaltMax > 0) {
    const norm = Math.min(1, beruf.mediangehalt / kontext.gehaltMax);
    const faktor = gehaltWichtig === 'sehr' ? 1 : 0.5;
    gesamt += W_GEHALT * faktor * norm;
  }

  // 4b) Sinn-Nudge: hoher „gesellschaftlich sinnvoll"-Regler + passende Kategorie.
  const sinnWert = regler[(fragenDef.sinnvoll_frage || {}).id];
  const sinnKats = new Set(fragenDef.sinnvoll_kategorien || []);
  if (sinnWert != null && sinnKats.size > 0) {
    const hatSinnKat = (beruf.kategorien || []).some((k) => sinnKats.has(k));
    if (hatSinnKat) gesamt += W_SINN * (sinnWert / 100);
  }

  // 4c) Mobilitäts-Nudge: Pendel-/Umzugs-Bereitschaft × Standort-Seltenheit des Berufs.
  // Nur für Einstiegswege (kontext.mobilNudge) — ein Master/eine Weiterbildung ist keine
  // ortsgebundene Erstwahl, dort wäre die Abwertung seltener Anschlüsse unpassend.
  if (kontext && kontext.mobilNudge) {
    const umkreis = (antworten.blockA || {}).umkreis;
    const zeile = MOBILITAET_NUDGE[umkreis];
    if (zeile) gesamt += W_MOBILITAET * (zeile[beruf.seltenheit] || 0);
  }

  // 4d) Berufsnamen-/Erwartungs-Boost: angekreuztes Domänen-Interesse + Schlüsselwort im
  // Berufsnamen hebt generisch getaggte Berufsfamilien (Luftfahrt/maritim/Journalismus).
  // Nur Einstieg (kontext.nameBoost). Relevanz-Gate (≥1 Tag-Treffer) verhindert, dass eine
  // zufällige Namens-Kollision einen fachfremden Beruf hochzieht — bewusst lockerer als die
  // Diversifizierungs-Schwelle (≥2 Tags), da diese die finale Relevanzhürde bleibt.
  // kontext.boostDomaenen wird
  // EINMAL pro Persona in bewerteUndSortiere berechnet (hängt nur von den Tätigkeiten ab,
  // nicht vom Beruf). Siehe NAME_BOOST / aktiveBoostDomaenen.
  if (kontext && kontext.nameBoost && matchTags.length >= 1) {
    const aktiv = kontext.boostDomaenen || [];
    const name = (beruf.name || '').toLowerCase();
    if (aktiv.some((d) => d.keywords.some((kw) => name.includes(kw)))) {
      gesamt += W_NAME_BOOST;
    }
  }

  return { beruf, score: gesamt, matchTags, tagScore, umgebungScore, motivationScore };
}

// Einstieg = Wege direkt nach der Schule; Anschluss = baut darauf auf.
const EINSTIEG_STUFEN = new Set(['ausbildung', 'bachelor']);
const ANSCHLUSS_STUFEN = new Set(['master', 'weiterbildung']);

function bewerteUndSortiere(kandidaten, antworten, fragenDef, opts = {}) {
  let gehaltMax = 0;
  for (const b of kandidaten) if (b.mediangehalt && b.mediangehalt > gehaltMax) gehaltMax = b.mediangehalt;
  const nameBoost = opts.nameBoost === true;
  const kontext = {
    gehaltMax,
    mobilNudge: opts.mobilNudge === true,
    nameBoost,
    boostDomaenen: nameBoost ? aktiveBoostDomaenen(antworten.taetigkeiten) : [],
  };
  return kandidaten
    .map((b) => bewerteBeruf(b, antworten, fragenDef, kontext))
    .sort((x, y) => y.score - x.score);
}

/** Diversifizieren: max. 2 pro Oberkategorie + Skip bei ≥60 % Tag-Überlapp. */
function diversifiziere(bewertet, maxErgebnisse) {
  const relevante = bewertet.filter((b) => b.matchTags.length >= 2 || b.score >= SCHWELLE_RELEVANT);
  const top = [];
  const katZaehler = {};
  for (const b of relevante) {
    if (top.length >= maxErgebnisse) break;
    const hauptKat = (b.beruf.kategorien || [])[0] || '_unbekannt';
    if ((katZaehler[hauptKat] || 0) >= MAX_PRO_KAT) continue;
    if (top.some((best) => tagUeberlapp(b.beruf.tags, best.beruf.tags) >= MAX_TAG_OVERLAP)) continue;
    top.push(b);
    katZaehler[hauptKat] = (katZaehler[hauptKat] || 0) + 1;
  }
  return top;
}

function istEinstieg(b) {
  return EINSTIEG_STUFEN.has(b.stufe) || !b.stufe; // !stufe = ältere Daten ohne Stufe
}

/**
 * Hauptfunktion: das Spektrum der EINSTIEGS-Wege (Ausbildung + Bachelor),
 * gefiltert, bewertet, diversifiziert (max. 10). [] wenn nichts die Schwelle erreicht.
 */
export const MIN_POOL = 8;

export function matche(berufe, antworten, fragenDef) {
  const einstieg = berufe.filter(istEinstieg);
  let kandidaten = hartFiltern(einstieg, antworten, fragenDef);
  // Sicherheitsnetz: wenn der Weg-Filter den Pool kollabieren lässt (z.B. eine
  // Ausbildungsart ist in den Daten kaum vertreten), den Weg-Filter fallenlassen
  // und nach Interesse matchen, statt 2 unpassende Berufe zu zeigen.
  if (kandidaten.length < MIN_POOL) {
    kandidaten = hartFiltern(einstieg, antworten, fragenDef, { wegFilter: false });
  }
  return diversifiziere(bewerteUndSortiere(kandidaten, antworten, fragenDef, { mobilNudge: true, nameBoost: true }), MAX_ERGEBNISSE);
}

/**
 * „Wohin kann das führen?" — Master-Studiengänge und Aufstiegsfortbildungen,
 * passend zu den Interessen. KEIN Schulabschluss-/Weg-Filter (das sind
 * Anschlüsse, keine Erstwege). Max. 5.
 */
export function matcheAnschluss(berufe, antworten, fragenDef, max = 5) {
  const kandidaten = berufe.filter((b) => ANSCHLUSS_STUFEN.has(b.stufe) && !b.needs_review && !b.reha_ausbildung);
  return diversifiziere(bewerteUndSortiere(kandidaten, antworten, fragenDef, { mobilNudge: false }), max);
}

/** Passungs-Stufe (Badge + CSS-Klasse) für einen Score. Fallback auf die unterste Stufe,
 *  damit ein (durch den Mobilitäts-Malus theoretisch möglicher) negativer Score nie undefined liefert. */
export function passungsStufe(score) {
  return PASSUNGS_STUFEN.find((s) => score >= s.min) || PASSUNGS_STUFEN[PASSUNGS_STUFEN.length - 1];
}

/** Score → Prozent (SCHWELLE_STARK = 100 %), für den Match-Balken. Auf 0–100 geklemmt. */
export function scoreProzent(score) {
  return Math.max(0, Math.min(100, Math.round((score / SCHWELLE_STARK) * 100)));
}
