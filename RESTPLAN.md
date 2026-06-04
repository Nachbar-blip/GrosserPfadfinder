# Restplan — Großer Pfadfinder

Stand: 2026-06-04 (nach Commit `2f399d0`). Die 6-Punkte-TODO nach dem
Tester-Feedback ist abgearbeitet (siehe `SIMULATION.md`). Hier nur, was *noch*
offen ist — priorisiert, mit ehrlicher Aufwand-/Nutzen-Einschätzung.

## Kontext: der einzige inhaltliche Restbefund

Der allgemeine Qualitäts-Re-Run (Querschnitt 90, streng + adversarial) ergab
**13 passt · 73 teilweise · 4 passt_nicht**. Die 4 harten Fehltreffer sind *kein*
Nudge-Problem (das ist abgeschlossen, siehe unten), sondern **ganze
Berufsfamilien, die das Matching nicht findet**. Daten-Check dazu:

| Familie | Existiert als Einstieg? | Diagnose |
|---|---|---|
| Luftfahrt (Fluggerätmechaniker × 3, Leichtflugzeugbauer) | **Ja** (`ausbildung`) | nur über generische Tags (`metall_bearbeiten`, `schweissen_loeten`) kodiert, keine Domäne |
| Maritim (Schiffsmechaniker, Bootsbauer, Binnenschiffer) | **Ja** (`ausbildung`) | dito (`maschine_warten_reparieren`, `fahrzeug_fuehren`) |
| Lokaljournalismus (Journalist/in, Video-Journalist/in) | **Ja** (`ausbildung`) | existiert, wird aber im Top-6 ausgespielt |
| Sport-IT (Sportinformatik) | **Nein** | echte Datenlücke — nur „Sportwissenschaft" (als Lehre/Therapie getaggt) |

Kernursache: Es gibt **keine Domänen-Interessen-Tags** (kein „luftfahrt",
„maritim"). Wer eine Branche *benennt*, aber die zugrundeliegenden
Tätigkeits-Tags nicht ankreuzt, verfehlt den Beruf. Bekannte, dokumentierte
Eigenschaft des 81-Tag-Systems.

## Offene Punkte

### P1 · Push (optional, niedrig)
Der Commit `2f399d0` ist **nur lokal**. Push synchronisiert das Repo —
**ändert die Live-App aber nicht**, weil nichts unter `public/` geändert wurde
(nur Doku + Tests). GitHub Pages bleibt also unberührt.
- **Aufwand:** 1 Befehl (`git push`). **Wann:** wenn Repo-Sync gewünscht.

### P2 · Berufsfamilien findbar machen — billiger Frontend-Hebel (mittel)
Ein **Berufsnamen-/Erwartungs-Boost** in `matching.js`: kleiner additiver Bonus,
wenn ein angekreuztes Interesse / ein Schlüsselwort im **Berufsnamen** vorkommt
(z. B. „Schiff", „Flug", „Boot"). Kein Re-Tagging, keine API-Kosten, rein
deterministisch.
- Holt die existierenden Einstieg-Berufe (Luftfahrt/maritim/Journalismus) nach
  oben, ohne neue Daten.
- **Risiko:** muss klein bleiben (Nudge-Größenordnung), sonst kippt es das
  Tag-Matching. Mit Unit-Test absichern + Sim-Re-Run als Regressionsschutz.
- **Aufwand:** ~½ Tag inkl. Test. **Nutzen:** adressiert 3 der 4 passt_nicht.
- **Einstieg:** `/brainstorm` (laut CLAUDE.md Pflicht-Einstieg für Features).

### P3 · Diversifizierungs-Check (klein)
Prüfen, ob die Regel „max. 2 pro Hauptkategorie" einen *besser* passenden
Einstieg-Beruf aus den Top-6 drängt (z. B. Journalist/in). Ggf. die Grenze
kontextabhängig lockern.
- **Aufwand:** ~1–2 h Analyse (Skript in `build/raw/sim/`).

### P4 · Echte Datenlücken (groß, niedrig)
Fehlende Berufe wie **Sportinformatik** existieren nicht im Datensatz. Schließen
nur über die Build-Pipeline (`build/01…03`) = API-Kosten + Pflicht-Stichprobe.
- **Aufwand:** Teil eines jährlichen Daten-Refresh. **Nicht** für einen Einzelfall.

### P5 · Regressionsschutz nach jeder Änderung (Querschnitt)
Nach P2/P3: `node build/raw/sim/match.mjs … && node …/analyze.mjs` + bei Bedarf
der Agenten-Re-Run. Hält die Kennzahlen in `SIMULATION.md` aktuell.

## Bewusst NICHT auf dem Plan

- **Mobilitäts-Nudge weiter tunen** — abgeschlossen. 7 Varianten getestet, keine
  heilt die Nebenwirkung ohne Kosten; bei `W=0.08`/Boost `0.4` belassen. Nicht
  erneut anfassen (Begründung im Memory + `SIMULATION.md`).
- **Reha-Wege-UI** — Entscheidung: als reiner Datensatz lassen.
