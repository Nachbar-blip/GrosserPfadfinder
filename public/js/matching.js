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
export function hartFiltern(berufe, antworten, fragenDef) {
  const a = antworten.blockA || {};

  // 1) Schulabschluss: Beruf bleibt, wenn sein Mindestabschluss ≤ angestrebtem.
  const schulRang = ABSCHLUSS_RANG[a.schulabschluss];
  const schulFilterAktiv = a.schulabschluss && a.schulabschluss !== 'unsicher' && schulRang != null;

  // 2) Ausbildungsart: aus den gewählten Weg-Optionen die akzeptierten Arten sammeln.
  const wegWerte = alsSet(a.weg);
  const akzeptierteArten = new Set();
  let wegFilterAktiv = false;
  const wegOption = (fragenDef.block_a || []).find((f) => f.id === 'weg');
  if (wegOption && wegWerte.size > 0 && !wegWerte.has('unbekannt')) {
    for (const opt of wegOption.optionen) {
      if (wegWerte.has(opt.wert)) {
        for (const art of opt.akzeptiert || []) akzeptierteArten.add(art);
      }
    }
    wegFilterAktiv = akzeptierteArten.size > 0;
  }

  return berufe.filter((b) => {
    if (b.needs_review) return false;
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

  return { beruf, score: gesamt, matchTags, tagScore, umgebungScore, motivationScore };
}

/**
 * Hauptfunktion: gefilterte, bewertete, diversifizierte Top-Treffer (max. 10).
 * Gibt [] zurück, wenn nichts die Schwelle erreicht.
 */
export function matche(berufe, antworten, fragenDef) {
  const kandidaten = hartFiltern(berufe, antworten, fragenDef);

  // Gehalts-Referenz für die Normalisierung (Max über die Kandidaten).
  let gehaltMax = 0;
  for (const b of kandidaten) if (b.mediangehalt && b.mediangehalt > gehaltMax) gehaltMax = b.mediangehalt;
  const kontext = { gehaltMax };

  const bewertet = kandidaten
    .map((b) => bewerteBeruf(b, antworten, fragenDef, kontext))
    .sort((x, y) => y.score - x.score);

  // Schwelle: 2+ passende Tags ODER Score ≥ SCHWELLE_RELEVANT.
  const relevante = bewertet.filter((b) => b.matchTags.length >= 2 || b.score >= SCHWELLE_RELEVANT);

  // Diversifizieren: max. 2 pro Oberkategorie + Skip bei ≥60 % Tag-Überlapp.
  const top = [];
  const katZaehler = {};
  for (const b of relevante) {
    if (top.length >= MAX_ERGEBNISSE) break;
    const hauptKat = (b.beruf.kategorien || [])[0] || '_unbekannt';
    if ((katZaehler[hauptKat] || 0) >= MAX_PRO_KAT) continue;
    const duplikat = top.some((best) => tagUeberlapp(b.beruf.tags, best.beruf.tags) >= MAX_TAG_OVERLAP);
    if (duplikat) continue;
    top.push(b);
    katZaehler[hauptKat] = (katZaehler[hauptKat] || 0) + 1;
  }
  return top;
}

/** Passungs-Stufe (Badge + CSS-Klasse) für einen Score. */
export function passungsStufe(score) {
  return PASSUNGS_STUFEN.find((s) => score >= s.min);
}

/** Score → Prozent (SCHWELLE_STARK = 100 %), für den Match-Balken. */
export function scoreProzent(score) {
  return Math.min(100, Math.round((score / SCHWELLE_STARK) * 100));
}
