# Design: Berufsnamen-/Erwartungs-Boost (P2)

Stand: 2026-06-05 · Status: freigegeben (Brainstorming abgeschlossen)
Kontext: `RESTPLAN.md` §P2, `SIMULATION.md` (die 4 verbliebenen `passt_nicht`).

## Ziel

Etablierte Berufsfamilien, die das 81-Tag-System nur **generisch** abbildet,
über ein Schlüsselwort im **Berufsnamen** nach oben holen — ausgelöst durch ein
angekreuztes Domänen-Interesse. Adressiert die `passt_nicht`-Fälle Luftfahrt und
maritime Technik (Journalismus zusätzlich; Sport-IT als dokumentierter No-Op).
Kein Re-Tagging, keine API, rein deterministisch.

## Befund aus den Daten (warum genau so)

Aus den 925 Personas + dem Berufsdatensatz (`build/raw/sim/personas.json`,
`public/data/berufe.json`):

| Familie | Berufe da? | Tag-Lage | Boost sinnvoll? |
|---|---|---|---|
| Luftfahrt (Fluggerätmechaniker ×3, Leichtflugzeugbauer) | ✅ | nur generisch (`metall_bearbeiten`, `schweissen_loeten`) | **Ja** |
| Maritim (Schiffsmechaniker, Bootsbauer, Binnenschiffer) | ✅ | nur generisch (`maschine_warten_reparieren`) | **Ja** |
| Journalismus (Journalist/in, Redakteur/in, Video-Journalist/in) | ✅ | **bereits korrekt getaggt** (`recherche_journalistisch`) | Boost großteils redundant — eigentlicher Fehler ist Diversifizierung (P3); Boost hilft über die Diversifizierungs-Grenze |
| Sport-IT (Sportinformatik) | ❌ existiert nicht | — | Name-Boost kann keinen fehlenden Beruf erzeugen → P4 (Datenlücke) |

Es existiert bereits ein Domänen-Interessen-Tag `flugzeug_schiff_fuehren`
("Ein Flugzeug oder Schiff steuern"). Fast alle Luftfahrt-/Maritim-Personas
haben ihn angekreuzt — er ist der natürliche Auslöser.

## Ehrliche Grenze (bewusst nicht "gefixt")

`flugzeug_schiff_fuehren` koppelt Luft **und** Wasser; eine Trennung ist nur
heuristisch möglich. Zwei reine "Schrauber"-Personas sind tag-identisch
(A22-12-15 Luftfahrt-Träumer vs. A22-12-21 schiffsverliebter Schrauber: beide
`metall_bearbeiten, motor_diagnostizieren, hydraulik_pneumatik, schweissen_loeten`).
Außerdem hat **A22-12-15 `flugzeug_schiff_fuehren` gar nicht angekreuzt** — im
Fragebogen liegt dann *kein* Luftfahrt-Signal vor (das steckt nur in
Hobbys/Erwartung, die die App nicht erhebt). Solche Profile bekommen korrekt
generische Mechanik-Berufe; ein Frontend-Boost soll das **nicht vortäuschen**
(Prinzip "ehrliche UX statt Schein"). Der Boost hilft genau den Personas, die
das Domäneninteresse tatsächlich angekreuzt haben.

## Entscheidungen (Brainstorming 2026-06-05)

1. **Scope:** generischer Mechanismus für alle 4 Familien; Sport-IT als
   dokumentierter No-Op bis P4-Daten existieren.
2. **Flug vs. Schiff:** Trennung über **Indikator-Tags mit Fallback** — klarer
   Indikator → nur diese Domäne; mehrdeutig → beide boosten (sichere Degradation).

## Architektur (eine Stelle, deklarativ)

Neuer additiver Nudge in `public/js/matching.js`, parallel zu Gehalt/Sinn/
Mobilität. Konfig-Tabelle + Gewicht als "einzige Quelle" (verhindert Drift):

```js
export const W_NAME_BOOST = 0.06;   // ~halbe Tag-Stärke; Tags dominieren weiter
export const NAME_BOOST = [
  { domaene:'luftfahrt',    triggerTags:['flugzeug_schiff_fuehren'],
    indikatorTags:['elektronik_loeten','code_schreiben'],            // Avionik/Drohnen → Luft
    keywords:['flug','luftfahrt','fluggerät'] },
  { domaene:'maritim',      triggerTags:['flugzeug_schiff_fuehren'],
    indikatorTags:['boden_wasser_untersuchen','waren_verladen_lagern','holz_bearbeiten'],
    keywords:['schiff','boot','maritim','nautik'] },
  { domaene:'journalismus', triggerTags:['recherche_journalistisch'],
    indikatorTags:[], keywords:['journalist','redakteur'] },
  { domaene:'sport_it',     triggerTags:[],                          // No-Op bis P4-Daten existieren
    indikatorTags:[], keywords:['sportinformatik'] },
];
```

`W_NAME_BOOST = 0.06` und die Indikator-/Keyword-Listen sind Startwerte,
beim Review/Sweep justierbar.

## Wirk-Logik (Trigger → Indikator-Trennung → Gate → Boost)

Pro Beruf, nur für **Einstiegswege** (neuer `kontext.nameBoost`, analog
`mobilNudge`):

1. **Trigger:** angekreuzter `triggerTags`-Eintrag vorhanden? Sonst kein Boost.
2. **Domänen-Trennung (Indikator + Fallback):** bei geteiltem Trigger
   (Luft/Schiff) → enthalten die angekreuzten Tags einen `indikatorTags`-Eintrag
   genau **einer** Domäne, nur diese aktivieren; sonst **beide**.
3. **Relevanz-Gate:** Boost nur bei `matchTags.length ≥ 1` (Beruf teilt schon
   ≥1 Tag mit den Antworten) — verhindert, dass eine zufällige Namens-Kollision
   einen fachfremden Beruf hochzieht.
4. **Name-Match:** Beruf-Name (lowercased) enthält ein `keyword` der aktiven
   Domäne → `gesamt += W_NAME_BOOST`. Konservative Keywords: **kein** "see"/
   "hafen" (Seelsorger/erschaffen-Kollisionen).

## Datenfluss

`matche()` → `bewerteUndSortiere(..., { mobilNudge:true, nameBoost:true })` →
`bewerteBeruf` Abschnitt **4d**. `matcheAnschluss` bleibt unberührt
(`nameBoost:false`) — Anschlüsse sind kein Einstiegs-`passt_nicht`-Fall.
Keine Signatur-Brüche; alle Gewichte/Schwellen bleiben exportierte "einzige
Quelle".

## Fehler-/Randfälle

- Kein Trigger gekreuzt → 0 Effekt (deckt A22-12-15 ehrlich ab).
- `sport_it`: leere `triggerTags` → feuert nie; dokumentierter No-Op bis P4.
- Negativer Gesamt-Score bleibt durch den `passungsStufe`-Fallback abgesichert
  (unverändert).

## Tests

- **Unit** (`build/test/`):
  - Trigger + Indikator → richtige Domäne geboostet.
  - mehrdeutig (kein/beidseitiger Indikator) → beide Domänen geboostet.
  - kein Trigger angekreuzt → keine Änderung.
  - Keyword im Namen ohne Trigger → keine Änderung.
  - `matchTags = 0` → Relevanz-Gate greift, kein Boost.
  - Journalismus-Trigger hebt Journalist/in.
- **Regression:** Sim-Re-Run (`node build/raw/sim/match.mjs` +
  `analyze.mjs`) — **0 leer/schwach** und **Kategorien-Fit 100 %** müssen
  erhalten bleiben; zusätzlich prüfen, dass Luftfahrt-/Maritim-/Journalismus-
  Personas den Familienberuf jetzt im Einstiegs-Top-Set sehen. Optional
  Agenten-Re-Judge der betroffenen Personas.
- **Tuning:** `W_NAME_BOOST` per kurzem Sweep gegen Regressionen absichern
  (0.06 als Startwert).

## Nicht im Scope

- Sport-IT inhaltlich schließen (P4-Datenlücke, jährlicher Daten-Refresh).
- Diversifizierungs-Regel (P3) — separat; der Journalismus-Boost wirkt hier nur
  als zusätzlicher Hebel über die Grenze, ersetzt P3 nicht.
- Mobilitäts-Nudge antasten (abgeschlossen, siehe `SIMULATION.md`).
