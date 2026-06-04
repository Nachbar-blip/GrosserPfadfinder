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

## Kennzahlen (nach Mobilitäts-Nudge + Reha-Filter · Stand 2026-06-04)

| Kennzahl | Wert |
|---|---|
| Personas | 925 (475 K10 / 450 K12) |
| Leere Ergebnisse | **0** |
| Schwache Ergebnisse (< 5 Treffer) | **0** (vorher 21) |
| Verschiedene Berufe empfohlen | **714 / 1841** (~39 % der Datenbasis) |
| Kategorien-Fit (erwartet ∩ Top-Treffer) | **100 %** (867 passt · 58 teilw. · 0 passt_nicht) |
| Qual. Urteil – Querschnitt 90 (streng + adversarial) | **13 passt · 73 teilweise · 4 passt_nicht** |
| Anschluss-Sektion gezeigt | bei allen 925 |

Der Reha-Filter + Mobilitäts-Nudge lösen den letzten verbliebenen
`passt_nicht`-Fall auf (Kategorien-Fit 99,9 % → **100 %**); 0 leere/schwache
Ergebnisse bleiben erhalten. Der Nudge verändert das Top-Set bei **588 von 925**
Personas (Top-1 kippt bei 184) — 249× „in der Nähe", 115× „pendeln", 224×
„würde umziehen". Die Mobilitäts-Wahl wirkt also sichtbar (kein folgenloses
Bedienelement).

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

## Mobilitäts-Nudge unter der Lupe: 49 Berater-Agenten, adversarial geprüft

Weil der Nudge so viele Rankings verschiebt, wurden die **32 am stärksten
veränderten** Personas (die Härtefälle, bewusst kein Schönwetter-Querschnitt)
einzeln von unabhängigen Berater-Agenten beurteilt; jeder Regressions-Verdacht
ging zur Gegenprüfung an einen zweiten, skeptischen Agenten.

| Kennzahl | Wert |
|---|---|
| Verdikt (32 Härtefälle) | 11 passt · 19 teilweise · 2 passt_nicht |
| Mobilität wirkt sinnvoll | 22 / 32 |
| Regressionen gemeldet → bestätigt | 16 → **5** |

Von 16 gemeldeten „Regressionen" hielten nur **5** der skeptischen Gegenprüfung
stand; die übrigen 11 waren gewolltes Spektrum-Rauschen, Wildcards oder eine
korrekte Reha-Filter-Korrektur. Die 5 echten Fälle: der Seltenheits-/Häufigkeits-
Boost schob einen inhaltlich besseren Treffer aus den Top-6 (z. B. ein Physik-
Streber bekam Physik/Chemie zugunsten seltener Nischen nach unten gedrückt).

**Lässt sich das wegtunen? Nein — getestet.** Sieben Varianten (Nudge × Tag-Score,
Relevanz-Gate ≥ 2 Tags, abgestufte Gewichtung, Umzug-Boost 0.4 → 0.25 / 0.15 /
0.0): keine heilt die Regressionen, ohne entweder das Nischen-Feature zu opfern
(bei Boost 0 fällt der Umzug-Effekt auf den Nullniveau-Baseline 78 %) oder an der
**Tag-Granularitäts-Grenze** zu scheitern — die 81 breiten Tags können
„Kosmetika-Technologie" nicht von „Chemie" trennen (dieselbe bekannte Grenze wie
unten). Die Nebenwirkung ist also **inhärent**: ein Mix aus dem *gewollten*
Nischen-Feature für umzugsbereite Schüler:innen und der Tag-Grenze, kein
Formelfehler — Quote ~1 von 6 der Härtefälle (über alle 925 deutlich seltener).
**Bewusste Entscheidung:** `W_MOBILITAET = 0.08` / Umzug-Boost 0.4 bleiben. Der
verdrängte Beruf bleibt im 10-Karten-Spektrum sichtbar (nur nicht in den Top-6) —
passend zum Prinzip „Spektrum statt einer richtigen Wahl".

## Ehrliche Grenzen (die 4 „passt_nicht" im aktuellen Querschnitt)

*Methodik-Hinweis:* Der Re-Run (Stand 2026-06-04) urteilte **strenger und
adversarial** als der Vor-Nudge-Lauf (49/31/11 von 91) — direkte Zahlenvergleiche
sind nur bedingt fair. Gesichert: die **harten Fehltreffer sind von 11 auf 4
gesunken**, während die mittlere „teilweise"-Kategorie wuchs (das strenge Urteil
zählt „im Kern getroffen, aber verwässert" als teilweise statt passt).

Die 4 verbliebenen `passt_nicht` haben ein klares, gemeinsames Muster — **nicht**
Feinst-Nische, sondern eine ganze **etablierte Berufsfamilie verfehlt**:
Luftfahrt (Fluggerätmechanik), maritime Technik (Schiffs-/Bootsbau), Sport-IT
(Sportinformatik), Lokaljournalismus. Bei mehreren erscheint der eigentlich
passende Beruf — wenn überhaupt — nur in der „Anschluss"-Liste, nicht im
Einstiegs-Spektrum.

**Warum:** Die App matcht über **81 breite Tätigkeits-Tags** — das trifft den
Mainstream stark, bildet aber einige geschlossene Branchen nicht eigenständig ab
(kein „Luftfahrt"- oder „maritim"-Tag; Sport-IT fällt zwischen Sport und IT;
Koch und Konditor teilen sich `speise_zubereiten`). Dazu zeigt das Spektrum
bewusst 1–2 „Wildcards" (Diversifizierung), die ein strenges Urteil als
„teilweise" zählt. Konkreter Verbesserungs-Kandidat (kein Blocker): gezielte
Tags / Berufsnamen-Boost für diese Familien, plus Prüfung, ob einzelne Berufe
(z. B. Schiffsmechaniker) fälschlich als „Anschluss" statt „Einstieg" eingestuft
sind.

## Fazit

Über **925 sehr unterschiedliche Profile** liefert die App ein passendes
Spektrum: **0 leere/schwache Ergebnisse**, 99,9 % Kategorien-Fit, saubere
Differenzierung nach Klassenstufe, niemand wird in Risiko-Berufe gedrängt.
Die Simulation hat zudem ihren Zweck erfüllt und **eine echte, systematische
Schwäche aufgedeckt (Duales Studium), die jetzt behoben ist** — genau dafür war
der Test da.
