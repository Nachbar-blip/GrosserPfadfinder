# Didaktik

Warum der Fragebogen so aufgebaut ist — und was er bewusst _nicht_ tut.

## Zielgruppe

Schüler:innen der Klassen 9–12 (Sek I und Sek II), die vor der Frage „Was nach
der Schule?" stehen. Anders als der **kleine Pfadfinder** (nur Ausbildung, für
Realschulabschluss) deckt der große auch **Studiengänge** ab und filtert nach
angestrebtem Abschluss und gewünschtem Weg.

## Kernprinzipien

### 1. Spektrum statt „Top-Treffer"
Bis zu **10 gleichwertige Vorschläge**, nach Score sortiert, aber visuell
gleichrangig — kein Podium. 15-Jährige sollen nicht das Gefühl bekommen, ein
Algorithmus habe ihre Zukunft entschieden.

### 2. Konkrete Tätigkeiten statt abstrakter Interessen
Statt „Magst du Technik?" fragen wir „Würdest du gerne _Kabel verlegen und einen
Stromkreis zum Laufen bringen_?". Tätigkeitsbilder zwingen zur inneren
Vorstellung statt zur Selbstetikettierung. Keine Persönlichkeitstests
(RIASEC, Big Five) — die sind beim Matching wertlos.

### 3. Nischen sichtbar machen
Das Tool soll Wege zeigen, die Schüler:innen _nicht_ kennen. Seltene Berufe
(Orgelbauer, Geigenbauer …) erscheinen normal im Spektrum, mit Badge `selten`.

### 4. Geschlechtsneutral, kein Tracking
Keine Geschlechts-Variable im Matching. Keine Cookies, kein Analytics; Antworten
bleiben per `localStorage` auf dem Gerät.

## Aufbau des Fragebogens (16 Schritte, ~5 Min)

- **Block A — harte/weiche Filter (4):** angestrebter Schulabschluss, möglicher
  Weg (Ausbildung/duales Studium/Studium), Mobilität (Umkreis), Gehalts-Wichtigkeit.
- **Block B — Umgebungsregler (4):** drinnen/draußen, allein/Team,
  Routine/Wechsel, anpackend/konzentriert.
- **Block C — Tätigkeiten (6):** je Frage 11–19 Mikro-Tätigkeiten zum Ankreuzen.
  Die sechs Fragen decken zusammen **alle 81 Tags** ab; die Reihenfolge der
  Items wird pro Sitzung gemischt.
- **Block D — Werte (2):** bis zu drei Motivationen + ein Regler
  „gesellschaftlich sinnvoll".

> **Abweichung von der Spec (§6):** Dort sind „6–8 Tätigkeiten pro Frage"
> genannt, zugleich aber „jeder Tag mindestens einmal". Bei 81 Tags und 6 Fragen
> ist beides nicht gleichzeitig erfüllbar. Wir folgen dem im kleinen Pfadfinder
> bewährten Weg: thematisch gruppierte Fragen mit mehr Items, sodass jeder Tag
> garantiert genau einmal vorkommt. Block B nutzt 4 statt 3 Regler (der vierte,
> anpackend/konzentriert, ist ein starkes, in `berufe.umgebung` gepflegtes Signal).

## Matching-Logik (siehe `public/js/matching.js`)

1. **Harte Filter:** Schulabschluss (Beruf-Mindestabschluss ≤ angestrebt) und
   Weg (Ausbildungsart in gewählter Menge). „Unsicher"/„weiß nicht" filtern nicht.
   Reha-/Fachpraktiker-Ausbildungen (§66 BBiG/§42r HwO) bleiben aus dem offenen
   Ranking (Vermittlung läuft nur über die Reha-Beratung, nicht den Stellenmarkt).
2. **Score** = `0.6 × Tag-Score + 0.25 × Umgebungs-Score + 0.15 × Motivations-Score`,
   plus kleine Nudges für Gehalt (nur wenn wichtig), gesellschaftlichen Sinn und
   Mobilität (die Umkreis-Wahl koppelt an `beruf.seltenheit` — kein km-Filter, da
   die Berufe nicht geokodiert sind).
   - Tag-Score = Anteil der Beruf-Tags, die angekreuzt wurden (normalisiert,
     damit Berufe mit vielen Tags nicht bevorzugt werden).
3. **Schwelle:** < 2 passende Tags _und_ Score < 0,25 → raus. Lieber 5 ehrliche
   Vorschläge als 10 hingebogene.
4. **Diversifizierung:** max. 2 pro Hauptkategorie; > 60 % Tag-Überlapp mit einem
   schon gewählten Beruf → raus (verhindert „4× Tiefbau").
5. **Begründung:** rein regelbasiert aus den Match-Daten (kein LLM im Frontend).

## „Wohin kann das führen?" (Anschlüsse)

Das Haupt-Spektrum zeigt **Einstiegswege** (Ausbildung + Bachelor). Darunter
erscheint — wenn passend — eine zweite Sektion mit **Master-Studiengängen und
Aufstiegsfortbildungen** (Meister/Techniker/Fachwirt) aus den gleichen
Interessensfeldern. So bedient das Tool beide Gruppen an der Schule: die
15-Jährige vor der Erstentscheidung sieht oben ihre Einstiegswege, die
18-Jährige mit Abitur sieht zusätzlich, welche weiterführenden Felder in ihrem
Interessensbereich liegen. Diese Anschlüsse durchlaufen bewusst **keinen**
Schulabschluss-Filter — sie sind Perspektiven, keine sofort verfügbaren Wege.

## KI- und Zukunftseinschätzung

Jeder Beruf trägt eine **Ampel** (KI-/Automatisierungs-Risiko niedrig/mittel/hoch)
mit aufklappbarem, ehrlichem Erklärtext. Das ist eine **modellbasierte
Orientierung, keine Prognose** und kein amtlicher Wert — so ist es im Tool auch
ausgewiesen. Es gibt dafür keine abrufbare amtliche Quelle (die
Automatisierungs-Daten der BA sind über deren API nicht erreichbar). Die
Einschätzung soll zum Nachdenken anregen („was bleibt menschlich, was
automatisiert sich?"), nicht abschrecken — körpernahe, pflegerische, kreative und
zwischenmenschliche Tätigkeiten werden tendenziell als sicherer eingeschätzt,
stark standardisierte Routine-/Datentätigkeiten als stärker betroffen.

## Was das Tool _nicht_ tut
- Keine Notenabfrage, kein Eignungstest — wir messen Interesse, nicht Fähigkeit.
- Keine Empfehlung „du _musst_ X werden" — immer ein Spektrum.
- Keine selbstgepflegte Betriebsdatenbank, kein KI-Chatbot, kein Login.
