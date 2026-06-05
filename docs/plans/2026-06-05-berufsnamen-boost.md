# Berufsnamen-/Erwartungs-Boost (P2) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ein kleiner, deterministischer additiver Nudge in `matching.js`, der generisch
getaggte Berufsfamilien (Luftfahrt/maritim/Journalismus) über ein Schlüsselwort im
Berufsnamen nach oben holt — ausgelöst durch ein angekreuztes Domänen-Interesse.

**Architecture:** Deklarative Konfig-Tabelle `NAME_BOOST` + Gewicht `W_NAME_BOOST` als
exportierte „einzige Quelle". Eine reine Helper-Funktion `aktiveBoostDomaenen(userTags)`
setzt die Indikator-mit-Fallback-Trennung um. Der Boost selbst sitzt in `bewerteBeruf`
(Abschnitt 4d), nur für Einstiegswege (`kontext.nameBoost`), hinter einem Relevanz-Gate
(`matchTags.length ≥ 1`). Keine neuen Daten, keine Signatur-Brüche.

**Tech Stack:** Vanilla ES-Module (`public/js/matching.js`), Node-Test ohne Framework
(`test/matching.test.mjs`, eigene `ok()`-Assertions), Sim-Harness (`build/raw/sim/*.mjs`).

**Design-Referenz:** `docs/plans/2026-06-05-berufsnamen-boost-design.md`
**Branch:** `feat/berufsnamen-boost` (bereits angelegt, Design committet `3315694`).

**Tests laufen mit:** `node test/matching.test.mjs` (Exit 0 = grün).
**Keyword-Validierung (bereits erfolgt):** alle Keywords treffen nur fachlich passende
Einstiegs-Namen, keine Fehltreffer; `sportinformatik` trifft 0 (dokumentierter No-Op).

---

### Task 1: Konfig-Tabelle + Trenn-Helper `aktiveBoostDomaenen`

**Files:**
- Modify: `public/js/matching.js` (nach dem `MOBILITAET_NUDGE`-Block, ~Zeile 29)
- Test: `test/matching.test.mjs` (neue Fälle ans Ende, vor der Schluss-Zusammenfassung)

**Step 1: Failing-Test für die Trenn-Logik schreiben**

In `test/matching.test.mjs` den Import (Zeile 9) erweitern um `aktiveBoostDomaenen`:

```js
import { matche, matcheAnschluss, hartFiltern, bewerteBeruf, scoreProzent, passungsStufe, aktiveBoostDomaenen } from '../public/js/matching.js';
```

Danach vor `console.log(`\n${bestanden} ...`)` einfügen:

```js
// 13) aktiveBoostDomaenen: Trenn-Logik (Indikator + Fallback).
{
  const dom = (tags) => aktiveBoostDomaenen(new Set(tags)).map((d) => d.domaene).sort();
  const sd = (a) => a.slice().sort();
  // kein Trigger angekreuzt → keine Domäne
  ok(dom([]).length === 0, 'Boost-Trennung: ohne Trigger keine Domäne');
  // mehrdeutig (Trigger, aber kein Indikator) → beide (luftfahrt+maritim)
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren'])) === JSON.stringify(sd(['luftfahrt', 'maritim'])), 'Boost-Trennung: mehrdeutig → beide Domänen');
  // klarer Maritim-Indikator → nur maritim
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen'])) === JSON.stringify(['maritim']), 'Boost-Trennung: Wasser-Indikator → nur maritim');
  // klarer Luftfahrt-Indikator → nur luftfahrt
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'elektronik_loeten'])) === JSON.stringify(['luftfahrt']), 'Boost-Trennung: Avionik-Indikator → nur luftfahrt');
  // beidseitiger Indikator → beide (Fallback)
  ok(JSON.stringify(dom(['flugzeug_schiff_fuehren', 'elektronik_loeten', 'boden_wasser_untersuchen'])) === JSON.stringify(sd(['luftfahrt', 'maritim'])), 'Boost-Trennung: beidseitiger Indikator → beide');
  // Journalismus: eigener Trigger, kein Wettbewerb → aktiv
  ok(JSON.stringify(dom(['recherche_journalistisch'])) === JSON.stringify(['journalismus']), 'Boost-Trennung: Journalismus-Trigger aktiv');
}
```

**Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node test/matching.test.mjs`
Expected: FAIL — `aktiveBoostDomaenen is not a function` (bzw. Import-Fehler).

**Step 3: Konfig + Helper implementieren**

In `public/js/matching.js` direkt nach dem `MOBILITAET_NUDGE`-Objekt (nach Zeile 29) einfügen:

```js

// Berufsnamen-/Erwartungs-Boost: hebt etablierte Berufsfamilien, die das 81-Tag-System
// nur GENERISCH abbildet (kein „luftfahrt"-/„maritim"-Tag), anhand eines Schlüsselworts
// im BERUFSNAMEN — ausgelöst durch ein angekreuztes Domänen-Interesse. Additiv und klein
// (Nudge-Größenordnung), nur für Einstiegswege. Deterministisch, kein Re-Tagging.
// sport_it trägt bewusst leere triggerTags → feuert nie (dokumentierter No-Op bis ein
// Daten-Refresh „Sportinformatik" aufnimmt, P4). Siehe docs/plans/2026-06-05-…-design.md.
export const W_NAME_BOOST = 0.06;
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
```

`alsSet` ist bereits in `matching.js` definiert (Zeile ~53) und steht hier zur Verfügung
(Funktions-Hoisting; `aktiveBoostDomaenen` läuft erst zur Aufrufzeit).

**Step 4: Test laufen lassen, grün bestätigen**

Run: `node test/matching.test.mjs`
Expected: PASS — alle bisherigen Tests + die 6 neuen Boost-Trennungs-Assertions grün.

**Step 5: Commit**

```bash
git add public/js/matching.js test/matching.test.mjs
git commit -m "feat: NAME_BOOST-Konfig + aktiveBoostDomaenen (Indikator-Trennung)"
```

---

### Task 2: Boost in `bewerteBeruf` (Abschnitt 4d) + `kontext.nameBoost` verdrahten

**Files:**
- Modify: `public/js/matching.js` — `bewerteBeruf` (nach 4c, ~Zeile 177) und
  `bewerteUndSortiere` (~Zeile 189)
- Test: `test/matching.test.mjs`

**Step 1: Failing-Tests für das Boost-Verhalten schreiben**

Ans Ende von `test/matching.test.mjs` (vor der Schluss-Zusammenfassung) einfügen:

```js
// 14) Berufsnamen-Boost: greift nur mit Trigger, hinter Relevanz-Gate, nur bei nameBoost:true.
{
  // Beruf mit Domänen-Keyword im Namen UND einem Tag, das das Profil teilt.
  const schiffBeruf = { id: 60, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['maschine_warten_reparieren', 'hydraulik_pneumatik'], umgebung: {}, seltenheit: 'regional', ausbildungsart: 'betriebliche_ausbildung' };
  const kontextAn = { gehaltMax: 0, mobilNudge: false, nameBoost: true };
  const kontextAus = { gehaltMax: 0, mobilNudge: false, nameBoost: false };

  // Trigger + Maritim-Indikator + geteilter Tag → Boost aktiv.
  const mitTrigger = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen', 'maschine_warten_reparieren'] });
  const ohneTrigger = profil({ taetigkeiten: ['maschine_warten_reparieren'] }); // kein flugzeug_schiff_fuehren
  const sBoost = bewerteBeruf(schiffBeruf, mitTrigger, fragen, kontextAn).score;
  const sOhneTrigger = bewerteBeruf(schiffBeruf, ohneTrigger, fragen, kontextAn).score;
  const sNudgeAus = bewerteBeruf(schiffBeruf, mitTrigger, fragen, kontextAus).score;
  ok(sBoost > sNudgeAus, 'Name-Boost: mit Trigger+Keyword höher als bei nameBoost:false');
  ok(Math.abs(sOhneTrigger - sNudgeAus) < 1e-9, 'Name-Boost: ohne Trigger kein Boost');

  // Relevanz-Gate: Keyword im Namen, aber 0 gemeinsame Tags → kein Boost.
  const fremd = { id: 61, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['zahn_behandeln'], umgebung: {}, seltenheit: 'regional', ausbildungsart: 'betriebliche_ausbildung' };
  const gateProfil = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen'] }); // teilt KEINEN Tag mit fremd
  const fAn = bewerteBeruf(fremd, gateProfil, fragen, kontextAn).score;
  const fAus = bewerteBeruf(fremd, gateProfil, fragen, kontextAus).score;
  ok(Math.abs(fAn - fAus) < 1e-9, 'Name-Boost: Relevanz-Gate — ohne gemeinsamen Tag kein Boost');
}

// 15) Domänen-Trennung wirkt im Score: klarer Luftfahrt-Lean boostet Flug-, nicht Schiff-Beruf.
{
  const flug = { id: 62, name: 'Fluggerätmechaniker/in', kategorien: ['technik_maschinen'], tags: ['metall_bearbeiten', 'praezisionsarbeit_hand'], umgebung: {}, seltenheit: 'regional' };
  const schiff = { id: 63, name: 'Schiffsmechaniker/in', kategorien: ['technik_maschinen'], tags: ['metall_bearbeiten', 'praezisionsarbeit_hand'], umgebung: {}, seltenheit: 'regional' };
  const kontextAn = { gehaltMax: 0, mobilNudge: false, nameBoost: true };
  // Avionik-Indikator (elektronik_loeten) → nur luftfahrt aktiv. metall_bearbeiten teilt den Gate-Tag.
  const luftLean = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'elektronik_loeten', 'metall_bearbeiten'] });
  const flugScore = bewerteBeruf(flug, luftLean, fragen, kontextAn).score;
  const schiffScore = bewerteBeruf(schiff, luftLean, fragen, kontextAn).score;
  ok(flugScore > schiffScore, 'Name-Boost: Luftfahrt-Lean boostet Flug- über Schiff-Beruf');
}

// 16) Journalismus: Trigger recherche_journalistisch boostet Journalist/in.
{
  const journo = { id: 64, name: 'Journalist/in (Ausbildung)', kategorien: ['sprache_kommunikation'], tags: ['recherche_journalistisch', 'text_schreiben_redigieren'], umgebung: {}, seltenheit: 'regional' };
  const p = profil({ taetigkeiten: ['recherche_journalistisch', 'text_schreiben_redigieren'] });
  const an = bewerteBeruf(journo, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: true }).score;
  const aus = bewerteBeruf(journo, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: false }).score;
  ok(an > aus, 'Name-Boost: Journalismus-Trigger hebt Journalist/in');
}

// 17) matcheAnschluss boostet NICHT (nameBoost bleibt aus).
{
  const anschlussBeruf = { id: 65, name: 'Schiffbau, Meerestechnik (weiterführend)', stufe: 'master', kategorien: ['technik_maschinen'], tags: ['maschine_warten_reparieren', 'schweissen_loeten'], umgebung: {}, seltenheit: 'regional' };
  const p = profil({ taetigkeiten: ['flugzeug_schiff_fuehren', 'boden_wasser_untersuchen', 'maschine_warten_reparieren'] });
  const res = matcheAnschluss([anschlussBeruf], p, fragen);
  const direkt = bewerteBeruf(anschlussBeruf, p, fragen, { gehaltMax: 0, mobilNudge: false, nameBoost: false }).score;
  ok(res.length === 1 && Math.abs(res[0].score - direkt) < 1e-9, 'Name-Boost: Anschluss-Sektion erhält keinen Boost');
}
```

**Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node test/matching.test.mjs`
Expected: FAIL — Tests 14–16 scheitern (kein Boost-Code), 17 ist bereits grün
(noch kein Boost), dient als Schutz gegen versehentliches Anschluss-Boosten.

**Step 3: Boost-Code implementieren**

In `public/js/matching.js`, in `bewerteBeruf` **nach** Abschnitt 4c (dem
Mobilitäts-Nudge, ~Zeile 177, vor `return { beruf, score: gesamt, ... }`) einfügen:

```js

  // 4d) Berufsnamen-/Erwartungs-Boost: angekreuztes Domänen-Interesse + Schlüsselwort im
  // Berufsnamen hebt generisch getaggte Berufsfamilien (Luftfahrt/maritim/Journalismus).
  // Nur Einstieg (kontext.nameBoost). Relevanz-Gate (≥1 Tag-Treffer) verhindert, dass eine
  // zufällige Namens-Kollision einen fachfremden Beruf hochzieht. Siehe NAME_BOOST.
  if (kontext && kontext.nameBoost && matchTags.length >= 1) {
    const aktiv = aktiveBoostDomaenen(userTags);
    const name = (beruf.name || '').toLowerCase();
    if (aktiv.some((d) => d.keywords.some((kw) => name.includes(kw)))) {
      gesamt += W_NAME_BOOST;
    }
  }
```

In `bewerteUndSortiere` (~Zeile 189) das `kontext`-Objekt um `nameBoost` erweitern:

```js
  const kontext = { gehaltMax, mobilNudge: opts.mobilNudge === true, nameBoost: opts.nameBoost === true };
```

In `matche` (~Zeile 230) den Aufruf um `nameBoost: true` ergänzen:

```js
  return diversifiziere(bewerteUndSortiere(kandidaten, antworten, fragenDef, { mobilNudge: true, nameBoost: true }), MAX_ERGEBNISSE);
```

`matcheAnschluss` bleibt unverändert (`{ mobilNudge: false }` → `nameBoost` default `false`).

**Step 4: Test laufen lassen, grün bestätigen**

Run: `node test/matching.test.mjs`
Expected: PASS — alle Tests grün (inkl. 14–17).

**Step 5: Commit**

```bash
git add public/js/matching.js test/matching.test.mjs
git commit -m "feat: Berufsnamen-Boost in bewerteBeruf (4d), nur Einstieg + Relevanz-Gate"
```

---

### Task 3: Integrations-Test über `matche` (Familienberuf landet im Einstiegs-Top-Set)

**Files:**
- Test: `test/matching.test.mjs`

**Step 1: Failing-Test schreiben**

Ans Ende einfügen:

```js
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
```

**Step 2: Test laufen lassen**

Run: `node test/matching.test.mjs`
Expected: PASS (Boost existiert bereits aus Task 2; dieser Test sichert das Zusammenspiel
mit `matche`/Diversifizierung ab). Falls FAIL → Diversifizierung/Gate prüfen, nicht das Gewicht blind erhöhen.

**Step 3: Commit**

```bash
git add test/matching.test.mjs
git commit -m "test: Integrationstest Berufsnamen-Boost über matche()"
```

---

### Task 4: Regression — Sim-Re-Run + Kennzahlen prüfen

**Files:**
- Modify (Daten, generiert): `build/raw/sim/results.json`, `build/raw/sim/aggregat.json`,
  `build/raw/sim/sample_urteil.json`
- Modify: `SIMULATION.md` (Kennzahlen-Abschnitt + die „4 passt_nicht"-Sektion)

**Step 1: Simulation neu fahren**

```bash
node build/raw/sim/match.mjs build/raw/sim/personas.json build/raw/sim/results.json
node build/raw/sim/analyze.mjs
```

Expected (Pflicht — sonst stoppen und Ursache klären):
- `ergebnis_verteilung['0'] === 0` (0 leere Ergebnisse, unverändert).
- `fit.passt_nicht === 0` und `fit_prozent_ok_oder_teil === 100` (Kategorien-Fit bleibt 100 %).
- `distinct_berufe_empfohlen` ≥ vorher (714) — der Boost darf die Vielfalt nicht senken.

**Step 2: Ziel-Personas stichprobenartig prüfen**

```bash
node -e "const r=require('./build/raw/sim/results.json');for(const id of ['A15-10-16','A21-10-14','A22-12-21','A35-10-05','A15-10-02']){const x=r.find(e=>e.id===id);console.log(id, x?.top.map(t=>t.name).join(' | '));}"
```

Expected: Die Luftfahrt-/Maritim-Personas zeigen jetzt den passenden Familienberuf
(z. B. Fluggerätmechaniker, Bootsbauer, Schiffsmechaniker, Binnenschiffer) im Top-6.
Beobachtung notieren (für SIMULATION.md). Falls eine Persona ihn weiterhin verfehlt:
prüfen, ob sie den Trigger-Tag angekreuzt hat — wenn nicht, ist das die dokumentierte
ehrliche Grenze (kein Bug).

**Step 3: SIMULATION.md aktualisieren**

Im Kennzahlen-Block und in der Sektion „Ehrliche Grenzen (die 4 passt_nicht)" ergänzen:
- Luftfahrt + maritim: durch den Berufsnamen-Boost jetzt im Einstiegs-Top-Set (mit den
  beobachteten Persona-Beispielen aus Step 2).
- Klarstellen: Sport-IT bleibt offen (P4-Datenlücke); Profile ohne angekreuztes
  Domänen-Interesse bekommen weiterhin korrekt generische Treffer (ehrliche Grenze).
- Alte Kennzahlen nur ersetzen, wenn sie sich messbar geändert haben (sonst Wortlaut
  belassen — keine erfundenen Zahlen).

**Step 4: Commit**

```bash
git add build/raw/sim/results.json build/raw/sim/aggregat.json build/raw/sim/sample_urteil.json SIMULATION.md
git commit -m "test: Sim-Re-Run nach Berufsnamen-Boost (Regression + Kennzahlen)"
```

---

### Task 5 (optional): `W_NAME_BOOST`-Sweep zur Absicherung

Nur falls Task 4 Regressionen zeigt (ein besserer Treffer aus den Top-6 verdrängt) ODER
der Boost zu schwach wirkt (Familienberuf bleibt außerhalb Top-6).

**Files:** Create (temporär, wird wie die anderen Experimente von git ignoriert):
`build/raw/sim/experiment_name_boost.mjs` (analog `experiment_umzug_boost.mjs`).

**Vorgehen:** `W_NAME_BOOST` über {0.04, 0.06, 0.08, 0.10} variieren, je `match`+`analyze`
fahren, `fit`/`distinct`/Ziel-Personas vergleichen. Kleinsten Wert wählen, der die
Familienberufe sichtbar macht, ohne `distinct_berufe` oder `fit` zu verschlechtern.
Ergebnis als Begründung in `SIMULATION.md` festhalten (wie beim Mobilitäts-Nudge).

**Commit (falls Wert geändert):**

```bash
git add public/js/matching.js SIMULATION.md
git commit -m "tune: W_NAME_BOOST auf <wert> (Sweep-Begründung in SIMULATION.md)"
```

---

## Definition of Done

- [ ] `node test/matching.test.mjs` grün (alle alten + neuen Fälle 13–18).
- [ ] Sim-Re-Run: 0 leer, `fit_prozent_ok_oder_teil === 100`, `distinct ≥ 714`.
- [ ] Luftfahrt-/Maritim-/Journalismus-Ziel-Personas zeigen den Familienberuf im Top-6.
- [ ] `SIMULATION.md` ehrlich aktualisiert (inkl. Sport-IT-Grenze als No-Op).
- [ ] Frontend unberührt prüfen: nur `public/js/matching.js` an Live-Code geändert; bei
      Bedarf `node test/smoke_hinweise.py` / `smoke_browser.py` als Sicht-Check.
- [ ] `/simplify` über die Änderung laufen lassen (CLAUDE.md: nach jeder Datei).
```
