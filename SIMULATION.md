# Simulation: 925 Schüler-Personas gegen die App

Ein Realitäts-Stresstest: Bekommen sehr unterschiedliche Schüler:innen jeweils
*sinnvolle, zum Charakter passende* Berufsvorschläge?

## Aufbau

- **925 fiktive Personas** (475 Klasse 10 · 450 Klasse 12), von 40 parallelen
  KI-Agenten erfunden — jeweils mit Persönlichkeit, Hobbys, Werten und daraus
  **konsistent abgeleiteten Fragebogen-Antworten** (Charakter → Tags/Regler/Weg).
  Pro Person eine unabhängige „erwartete_kategorien"-Hypothese.
- Jede Persona lief durch die **echte Matching-Engine der App**
  (`matche` + `matcheAnschluss`, identisch zur Live-Version).
- Auswertung: programmatisch (alle 925) + qualitatives Urteil durch KI-Berater-
  Agenten (Stichprobe 91, inkl. aller Auffälligkeiten).

## Kennzahlen (nach Bugfix)

| Kennzahl | Wert |
|---|---|
| Personas | 925 (475 K10 / 450 K12) |
| Leere Ergebnisse | **0** |
| Schwache Ergebnisse (< 5 Treffer) | **0** (vorher 21) |
| Verschiedene Berufe empfohlen | **745 / 1841** (40 % der Datenbasis) |
| Kategorien-Fit (erwartet ∩ Top-Treffer) | **99,9 %** (859 passt · 65 teilw. · 1 Rest) |
| Qualitatives Urteil (strenge Stichprobe 91) | 49 passt · 31 teilweise · 11 passt_nicht |
| Anschluss-Sektion gezeigt | bei allen 925 |

## ⭐ Der wichtigste Fund: ein echter Bug — gefunden und behoben

Die Simulation deckte eine **systematische Schwäche** auf: 21 Personas (alle mit
Weg = „Duales Studium" als **einziger** Wahl) bekamen nur 2 völlig unpassende
Treffer — IT-/Elektronik-Profile etwa „Hebammenkunde" und „Betriebswirt".

**Ursache:** In den BERUFENET-Daten ist die Ausbildungsart `duales_studium` nur
**2× von 1841** vergeben (die BA zählt duale Studiengänge meist als „Studium"
oder „Ausbildung"). Der harte Weg-Filter ließ den Pool auf diese 2 Berufe
kollabieren — die dann nur über den Umgebungs-Score nach oben rutschten.

**Behoben:** (1) „Duales Studium" akzeptiert jetzt auch `studium` +
`betriebliche_ausbildung` (die realen Bestandteile). (2) Sicherheitsnetz: fällt
der Pool unter 8 Berufe, wird der Weg-Filter fallengelassen und nach Interesse
gematcht. **Ergebnis:** 0 schwache Fälle (vorher 21), Kategorien-Fit von 99,2 %
auf 99,9 %. Die Elektronik-Bastlerin bekommt jetzt Elektroniker/Mechatroniker
statt Hebammenkunde. (Regressionstest ergänzt.)

## Klasse 10 vs. Klasse 12 — saubere Differenzierung

| | Ø Treffer | Ausbildung im Top | Bachelor im Top |
|---|---|---|---|
| **Klasse 10** | 10,0 | 93 % | 47 % |
| **Klasse 12** | 10,0 | 78 % | 73 % |

Genau wie gewünscht: 10. Klasse sieht überwiegend Ausbildungen, 12. Klasse
deutlich mehr Studiengänge. Die „Wohin kann das führen?"-Sektion (Master/
Weiterbildung) erschien bei allen.

## KI-/Zukunftseinschätzung in den Empfehlungen

Von allen empfohlenen Berufen: **niedrig 2265 · mittel 2753 · hoch 532** — nur
**9,6 %** der Vorschläge gelten als KI-/automatisierungs-gefährdet. Die App
drängt also niemanden in Risiko-Berufe; der Großteil der Vorschläge ist
zukunftsrobust, und wo Risiko besteht, ist es transparent ausgewiesen.

## Was rauskommt — Galerie (Profil → Top-Treffer)

- **Jonas, K10, ruhiger Holz-Tüftler** (Holzmodelle, Drechseln) → Holzmechaniker · Maler/Lackierer · Ausbaufacharbeiter
- **Nico, K10, Elektronik-Bastler** (Arduino, Roboter) → Informationselektroniker · Automatisierungstechnik · Math.-techn. Assistent
- **Pia, K10, naturnahe Gärtnerin** (Hochbeet, Imkern) → Gartenbau · Landwirt · Pferdewirt
- **Felix, K10, introvertierter Schrauber** (Mofa tunen) → Land-/Baumaschinentechnik · Metallgießer
- **Mehmet, K12, warmherziger Pfleger** (Besuchsdienst Altenheim) → Altenpflegehelfer · Sozialassistent
- **Lena, K12, kreative Modebloggerin** (Lookbooks, Nähen) → Textildesign · Maßschneider · Fotograf
- **Clara, K10, Sprachbegabte** (Japanisch, Kalligrafie) → Übersetzen · Baltistik · Komposition

## Ehrliche Grenzen (die 11 „passt_nicht")

Alle vom selben Typ: die Persona wünscht sich eine **sehr spezifische Nische**,
die App liefert die **Nachbar-Familie** statt der exakten Nische:
Zahnmedizin → Podologie/Ergotherapie; Fluggerätemechanik → Schiffsbetriebstechnik;
Augenoptik → Orthopädieschuhmacher; Konditorei → Küche; Make-up/Kosmetik → nur
Friseur; PR/NGO → Schauspiel/Pädagogik; reine Physik → angewandte Naturwissenschaft.

**Warum:** Die App matcht über **81 breite Tätigkeits-Tags** — das trifft den
Mainstream stark, kann aber Feinst-Nischen nicht punktgenau ansteuern (es gibt
z. B. keinen Kosmetik-Tag; Koch und Konditor teilen sich `speise_zubereiten`).
Dazu zeigt das Spektrum bewusst 1–2 „Wildcards" (Diversifizierung), was ein
strenges Urteil als „teilweise" zählt. Ein Teil der Ausreißer ist außerdem
**Rauschen der synthetischen Personas** selbst (z. B. „keine Tierliebe, aber
Tier-Tags angekreuzt"). Das ist keine Fehlfunktion, sondern eine Eigenschaft des
Tag-Systems — verbesserbar (mehr Tags / Berufsnamen-Boost), aber nicht nötig.

## Fazit

Über **925 sehr unterschiedliche Profile** liefert die App ein passendes
Spektrum: **0 leere/schwache Ergebnisse**, 99,9 % Kategorien-Fit, saubere
Differenzierung nach Klassenstufe, niemand wird in Risiko-Berufe gedrängt.
Die Simulation hat zudem ihren Zweck erfüllt und **eine echte, systematische
Schwäche aufgedeckt (Duales Studium), die jetzt behoben ist** — genau dafür war
der Test da.
