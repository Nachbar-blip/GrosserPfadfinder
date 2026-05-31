# Architektur

Drei Schichten, klar getrennt. Das Frontend läuft komplett im Browser; der
Build läuft nur lokal/CI. Löscht man `build/`, läuft das ausgelieferte Tool
unverändert weiter.

```
Schicht 1 — STATISCH (Build, ~1×/Jahr)
  build/01_fetch_berufenet.js   Berufe-IDs + Namen (BERUFENET)
  build/02_fetch_kompetenzen.js Steckbrief/Tätigkeitsfelder je Beruf
  build/03_tag_berufe.js        Claude-Tagging → public/data/berufe.json
  build/04_validate.js          Konsistenzprüfung
        │
        ▼
Schicht 2 — FRONTEND (public/, vanilla, offline-fähig nach Auslieferung)
  Fragebogen → Matching gegen berufe.json → Ergebnis-Spektrum
        │
        ▼
Schicht 3 — LIVE (optional, nutzer-initiiert)
  Link-Outs auf BA-Jobsuche / BERUFENET / OSM-Karte (kein fetch, s. datenquellen.md)
```

## Frontend-Module (`public/js/`, ES-Module)

| Datei | Zweck | Exporte (Auszug) |
|---|---|---|
| `app.js` | Controller: lädt Daten, hält State, schaltet Screens | — (Entry) |
| `daten.js` | lädt `config/tags/fragen/berufe.json` per `fetch` | `ladeDaten()` |
| `state.js` | App-State + `localStorage` (Sets↔Arrays) | `leererState`, `ladeState`, … |
| `fragebogen.js` | rendert Start + Fragen (Block A–D), Navigation | `baueSchritte`, `rendereFrage`, … |
| `matching.js` | harte Filter + Scoring + Diversifizierung | `matche`, `hartFiltern`, `bewerteBeruf` |
| `ergebnis.js` | Ergebnis-Karten, Begründung, Live-Buttons | `rendereErgebnis`, `begruendung` |
| `api/ba.js` | Link-Builder BA-Suche + BERUFENET | `stellenLink`, `berufenetLink` |
| `api/overpass.js` | Link-Builder OSM-Karte (overpass-turbo) | `betriebeLink` |
| `util.js` | `escapeHtml`, `gemischt` | — |

Das `app`-Objekt wird an die Render-Module durchgereicht (`app.state`,
`app.daten`, `app.schritte`, `app.rendere()`, `app.speichere()`,
`app.zumErgebnis()`, `app.neuStarten()`). Kein Pub/Sub, kein Framework.

## Daten-Schema (`public/data/`)

- `config.json` — schul-spezifisch (Name, PLZ, Koordinaten, Umkreis). **Die
  einzige Datei, die eine andere Schule ändern muss.** Liegt in `public/`, damit
  sie von GitHub Pages ausgeliefert wird (nur `public/` wird deployt).
- `tags.json` — verbindliches Vokabular (15 Kategorien, 81 Mikro-Tags).
- `fragen.json` — Fragebogen-Definition (tag_text, Block A–D, Mappings).
- `berufe.json` — generiert; pro Beruf u. a. `id` (=BerufenetID), `name`,
  `kategorien`, `tags`, `umgebung{4}`, `osm_tags`, `schulabschluss_min`,
  `ausbildungsart`, `mediangehalt`, `dauer_jahre`, `seltenheit`.

## Warum ES-Module ohne Build-Step

Der Browser lädt `<script type="module">` nativ samt `import`. Kein Webpack,
kein Transpiler. `public/package.json` (`"type":"module"`) markiert den Ordner
nur für Node (Tests) als ESM; der Browser ignoriert sie.
