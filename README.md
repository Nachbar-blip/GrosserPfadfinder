# Pfadfinder (groß)

**▶ Live: https://nachbar-blip.github.io/GrosserPfadfinder/** — QR-Code & Aushang zum Verteilen in `share/`.

Ein Berufsorientierungs-Tool für Schüler:innen der Klassen 9–12. Es fragt nach
**konkreten Tätigkeiten** (nicht nach Persönlichkeit) und schlägt am Ende ein
**Spektrum von bis zu 10 Ausbildungsberufen und Studiengängen** mit Begründung
vor — inklusive Nischen, die in der üblichen Beratung untergehen.

Schwesterprojekt des **kleinen Pfadfinders** (offline-HTML, nur Ausbildung).
Der große ergänzt Studiengänge, harte Filter (Abschluss/Weg/Umkreis/Gehalt),
~1.100 Berufe aus BERUFENET und nutzer-initiierte Live-Links auf BA & OSM.

## Aufbau

```
public/                  Frontend (genau das wird per GitHub Pages deployt)
  index.html             Entry Point
  config.json            Schul-Config — DIE einzige Datei für einen Fork
  css/pfadfinder.css
  js/                    app, fragebogen, matching, ergebnis, state, daten, util
  js/api/                ba.js, overpass.js  (Link-Builder, kein fetch)
  data/                  tags.json, fragen.json, berufe.json (generiert)
build/                   Daten-Pipeline (nur lokal/CI, Node ≥18)
  01_fetch_berufenet.js  02_fetch_kompetenzen.js  03_tag_berufe.js  04_validate.js
  lib/                   ba_client.js (BERUFENET), claude_client.js (Tagging)
docs/                    architektur.md, datenquellen.md, didaktik.md
test/                    matching.test.mjs (Unit-Tests), smoke_browser.py
```

## Lokal ansehen

Das Frontend braucht einen Webserver (wegen `fetch` der JSON-Dateien — Öffnen
per Doppelklick `file://` reicht nicht):

```bash
cd public
python -m http.server 8099
# → http://127.0.0.1:8099/
```

## Schul-agnostisch / ortsunabhängig

Die App ist an **keine** Schule und keinen Ort gebunden: Im Header steht nur
„PFADFINDER", und die Nutzer:in gibt ihre **PLZ** selbst ein (für „Stellen &
Betriebe in deiner Nähe"). So lässt sich derselbe Link bundesweit teilen.
`public/config.json` enthält nur noch optionale Defaults (`schulname` leer =
generisch; `default_umkreis_km`). Eine Schule, die die App branden möchte, kann
`schulname` setzen.

## Daten neu bauen (Betreiber, ~1×/Jahr)

Voraussetzungen einmalig:
```bash
cp .env.example .env        # ANTHROPIC_API_KEY eintragen (nur für Schritt 03)
npm install                 # @anthropic-ai/sdk
```

Pipeline:
```bash
node build/01_fetch_berufenet.js     # Berufe enumerieren: Ausbildung + Bachelor +
                                     #   Master + Aufstiegsfortbildungen (~1841)
node build/02_fetch_kompetenzen.js   # Steckbriefe je Beruf
node build/05_fetch_plz.js           # PLZ→Koordinaten-Tabelle (public/data/plz.json)
node build/03_tag_berufe.js --sample=50   # PFLICHT: erst Stichprobe prüfen!
#   → build/raw/berufe_sample.json sichten, dann erst:
node build/03_tag_berufe.js          # voller, inkrementeller Lauf (~20 €)
#   (bei geändertem tags.json/Prompt/neuem Feld: --full-retag)
node build/04_validate.js            # Konsistenz prüfen
git diff public/data/berufe.json && git commit -am "data refresh" && git push
```

Jeder Beruf trägt eine **Stufe** (ausbildung / bachelor / master / weiterbildung).
Einstieg (Ausbildung + Bachelor) bildet das Haupt-Spektrum; Master + Weiterbildung
erscheinen separat unter „Wohin kann das führen?". Der Tagger schätzt zusätzlich
ein **KI-/Automatisierungs-Risiko** (niedrig/mittel/hoch) plus eine kurze
ehrliche Einschätzung (klar als Schätzung markiert, kein amtlicher Wert).

`03_tag_berufe.js` taggt **inkrementell**: unveränderte Berufe kommen aus dem
Cache (`public/data/berufe.json`), nur neue/geänderte kosten API. `--full-retag`
erzwingt komplettes Neutaggen (nötig, wenn sich `tags.json` oder der
Tagging-Prompt ändert). Ein jährlicher Refresh kostet typischerweise < 1 €.

> ⛔ **Pflicht-Stopp:** Vor jedem vollen Tagging-Lauf erst `--sample=50` prüfen.
> Begründung: das Tagging ist die teuerste und am schwersten rückgängig zu
> machende Phase.

## Tests

```bash
node test/matching.test.mjs          # Unit-Tests Matching-Logik
python test/smoke_browser.py         # Browser-Smoketest (Server auf :8099 nötig)
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deployt bei Push auf `main` den
Ordner `public/` als GitHub Pages. Die Build-Pipeline läuft dort **nicht**
automatisch (kostet Credits) — sie wird manuell lokal ausgeführt.

## Prinzipien (nicht verhandelbar)

- **Zero Backend** — kein Server, kein Login, keine DB. Live-Daten nur als
  Link-Out auf offizielle Seiten (siehe `docs/datenquellen.md`).
- **Vanilla** — kein React/Vue, kein Build-Step im Frontend.
- **Kein Tracking** — keine Cookies (außer `localStorage`-Fortschritt), keine
  externen Fonts/CDNs/Analytics.
- **Spektrum, nicht „Top-Empfehlung".** Alles auf Deutsch.
