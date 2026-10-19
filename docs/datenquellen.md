# Datenquellen

Stand: 2026-05-31. Alle Endpunkte und CORS-/Auth-Aussagen wurden an diesem
Tag empirisch (per `curl` und Browser) verifiziert. Wo etwas „tot" ist, steht
das ausdrücklich dabei — die Bundesagentur ändert ihre inoffiziellen APIs
gelegentlich, deshalb ist dieser Stand die wichtigste Bruchstellen-Doku.

## Überblick: zwei Welten

| | Build (lokal, Node) | Frontend (Browser) |
|---|---|---|
| Zweck | Berufe ziehen + taggen → `berufe.json` | Fragebogen + Matching + Live-Links |
| Netz | direkte API-Calls erlaubt | **kein** `fetch` an externe APIs (CORS, s.u.) |
| Auth | `X-API-Key`-Header je API | keiner |

## 1. BERUFENET — Berufeliste + Steckbriefe (Build, Schicht 1)

**Auth:** roher Header `X-API-Key: infosysbub-berufenet`. **Wichtig:** KEIN
`Accept: application/json`-Header senden — die WAF der BA antwortet darauf mit
**HTTP 406**. Nur Key + ein deskriptiver `User-Agent`.

- **Basis-URL:** `https://rest.arbeitsagentur.de/infosysbub/bnet/pc/v1`
- **Alle Berufe (paginiert, 20/Seite, `totalPages` dynamisch lesen):**
  `GET /berufe?suchwoerter=%2A&page={0..N}` → 3561 Berufe gesamt.
- **Teilmengen über Berufsgruppe `bg`:**
  - Ausbildung: `bg=100,101,102,105` → 727
  - Studium (grundständig + weiterführend): `bg=300,301,302` → 743
- **Detail/Steckbrief:** `GET /berufe/{id}` → JSON-Array mit einem Element;
  enthält `id`, `kldb2010`, `steckbrief.kurz/.lang` (HTML), `taetigkeitsfelder`.

`build/01_fetch_berufenet.js` zieht Ausbildung + Studium und **schließt
weiterführende (Master-)Studiengänge aus** (`/weiterführend/i` im Namen): nicht
zielgruppenrelevant (Klasse 9–12 wählt einen Erstweg) und in BERUFENET ohne
Steckbrief-Text. Übrig bleiben **1097 Berufe** (727 Ausbildung + 370
grundständige Studiengänge).

`build/02_fetch_kompetenzen.js` holt je Beruf das Detail und extrahiert aus dem
HTML-Steckbrief sauberen Text (SVG-Charts werden entfernt): Beschreibung
(„Was macht man …?"), Anforderungen/Schulfächer, Ausbildungsvergütung,
Tätigkeitsfelder. Mojibake (doppelt-UTF8) wird repariert.

## 2. Studiensuche (optional, ergänzend)

- **Auth:** `X-API-Key: infosysbub-studisu`
- **Studienfelder + dkzIds:** `GET /infosysbub/studisu/pc/v1/studienfelder`

Aktuell nicht zwingend genutzt — die grundständigen Studiengänge kommen schon
vollständig aus BERUFENET. Endpunkt dokumentiert für spätere Erweiterung.

## 3. Tote Endpunkte — NICHT darauf bauen

Folgende, in älteren `bundesAPI`-READMEs dokumentierte Endpunkte liefern heute
**HTTP 403** (Edge/WAF-Block, leerer Body) — unabhängig von Key, User-Agent und
trotz deutscher IP. Sie sind von außen praktisch nicht erreichbar:

- `dkz-rest` (`/infosysbub/dkz-rest/...`) — früher dkzId↔BerufenetId-Mapping
- `entgeltatlas` (`/infosysbub/entgeltatlas/...`) — **deshalb gibt es kein
  Mediangehalt per API**; der Tagging-Schritt schätzt es stattdessen (siehe §5).
- `sete/suggest` — NewPlan-Verwandtschaftsgraph
- `oauth/gettoken_cc` — der OAuth2-client_credentials-Flow gibt kein Token mehr.

Fallback, falls auch `infosysbub-berufenet/-studisu` mal gesperrt würde:
statische Berufeliste aus `github.com/AndreasFischer1985/berufenet-api` bzw. die
KldB-2010-Systematik der BA (`statistik.arbeitsagentur.de`).

## 4. Live-Features im Browser — Link-Out statt fetch (Schicht 3)

Die Spec sah ursprünglich vor, BA-Jobsuche und Overpass (OSM-Betriebe) **per `fetch` direkt im
Browser** abzufragen. Das ist empirisch **nicht möglich**, ohne ein Backend zu
bauen — und „Zero Backend" ist ein nicht verhandelbares Leitprinzip (§1.2).
Deshalb lösen wir beide Live-Features als **nutzer-initiierte Links auf
offizielle, vorbefüllte Seiten** (`window`-Navigation, kein `fetch`).
Konsequenz: CSP `connect-src` bleibt `'self'`; die App selbst spricht mit
keinem fremden Server — erst der Klick der Nutzer:in öffnet die Zielseite.

### 4.1 BA-Jobsuche → CORS-blockiert
- Der Header `X-API-Key` ist ein nicht-simpler Header und erzwingt einen
  CORS-Preflight (OPTIONS). Der Preflight liefert von fremdem Origin **kein**
  `Access-Control-Allow-Origin`/`-Headers` → der Browser bricht ab.
  (Bekanntes offenes Issue `bundesAPI/jobsuche-api#3` seit 2021.)
- **Lösung (`public/js/api/ba.js`):** vorbefüllte offizielle Suchseite öffnen.
  Stand **2026-10-19, im echten Browser geprüft** (Headless-Chromium, Seiteninhalt
  gelesen — nicht nur HTTP-Status, denn die BA-Seiten sind Single-Page-Apps und
  liefern auch für kaputte Links HTTP 200):
  - Ausbildung: `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was={offizieller Name}&wo={PLZ}&umkreis={km}`
    — **den BERUFENET-Namen 1:1 übergeben** („Medizinische/r Fachangestellte/r").
    Die Jobbörse erkennt ihn als Beruf. Bis 2026-10 wurde ab dem ersten „/"
    abgeschnitten → Suche nach „Medizinische" (5.722 statt 2.240 Treffer),
    „Kaufmann" (43.455 statt 4.831 für Büromanagement), „Fachpraktiker" (53 Berufe!).
    „Gesäuberte" Formen ohne „/in" liefern teils 0 Treffer.
  - Studium: `https://web.arbeitsagentur.de/studiensuche/suche?sty=0&ssw={Studienfach ohne Klammerzusatz}&st=0`
    (`ssw` = Suchbegriff, `sty=0` = Suchtyp Suchbegriffe, `st=0` = nur grundständig).
    Der früher genutzte Parameter `suchbegriff` wird **ignoriert** → man landete
    auf der leeren Startseite der Studiensuche.
  - BERUFENET-Steckbrief: `https://web.arbeitsagentur.de/berufenet/beruf/{id}` —
    alle 1.841 IDs aus `berufe.json` per REST-API (`/berufe/{id}`) als gültig
    geprüft; Stichproben (Ausbildung, Studium, Weiterbildung, schulisch) zeigen
    im Browser den richtigen Steckbrief. Unbekannte IDs zeigen „Die angeforderte
    Webseite ist leider nicht vorhanden".

### 4.2 Betriebe in der Nähe → Google-Maps-Suche (vorher OpenStreetMap/Overpass)
- **Früher:** Link auf overpass-turbo mit einer `around`-Query aus den
  `osm_tags`. Am 2026-10-19 gemessen ist das **nicht zuverlässig betreibbar**:
  - `overpass-api.de` (Standardserver von overpass-turbo): 3 von 8 Anfragen
    erfolgreich (je ~40 s), sonst sofort `502 … at capacity, request queue is
    full`. Das OSM-Wiki rät selbst: „this server is overloaded … use alternatives".
  - `overpass.private.coffee` (Ausweichserver): 0 von 8 (HTTP 500, auch die
    Statusseite); Datenstand Juni 2026.
  - Umkreis 200 km lief **immer** in `runtime error: Query timed out`.
  - overpass-turbo ist zudem ein Entwickler-Werkzeug (Code-Editor) — für
    Schüler:innen unhandlich.
- **Geprüfte Alternativen:** OSM-Namenssuche (Nominatim) ist keine Branchensuche
  („Tischlerei" in Berlin → 3 Treffer, darunter ein Theater). Apple Karten deutet
  dieselbe URL mal als Branchensuche, mal als Ortsname („Tischlereigasse",
  Österreich). DuckDuckGo blockt automatisierte Prüfung. **Google Maps: 12 von 12
  Suchen korrekt** (Desktop + iPhone-Profil), Cookie-Dialog mit „Alle ablehnen".
- **Lösung (`public/js/api/karte.js`):** offizielles Maps-URL-Format
  `https://www.google.com/maps/search/?api=1&query={Branchenbegriff} {PLZ}`.
  Der Branchenbegriff kommt aus einer festen Tabelle `osm_tag → deutscher Begriff`
  (z. B. `craft=carpenter` → „Tischlerei"); sehr allgemeine Tags („Unternehmen")
  nur, wenn nichts Spezifischeres da ist. `test/links.test.mjs` prüft, dass jeder
  Tag in `berufe.json` ein Label hat — nach einem Daten-Refresh mit neuen Tags
  schlägt der Test an. Die PLZ geht nur in den Link, wenn sie in `plz.json` steht.
  Datenschutz: nutzer-initiierter Link; übergeben werden nur Suchbegriff + PLZ
  (Hinweistext im Fragebogen-Start angepasst).

> **Wenn echte Inline-Ergebnisse gewünscht sind:** Das ginge nur über einen
> eigenen Mini-Proxy (Cloudflare Worker / Netlify Function), der den `X-API-Key`
> setzt und CORS-Header ergänzt. Das ist dann aber
> ein Backend und bricht §1.2 — daher bewusst nicht umgesetzt.

## 5. OSM-Tags & Mediangehalt im Tagging

- **`osm_tags`** pro Beruf vergibt der Tagging-Schritt (`build/03_tag_berufe.js`)
  aus einer taginfo-verifizierten Referenzliste je Oberkategorie (in
  `build/lib/claude_client.js`). Reine Industrie-/Büroberufe ohne auffindbaren
  Einzelbetrieb bekommen `[]` (dann kein „Betriebe"-Button).
- **`mediangehalt`** ist eine **Schätzung** des Modells (Entgeltatlas-API tot),
  monatliches Brutto-Einstiegsgehalt, im Frontend mit „(geschätzt)" markiert.

## 5a. Postleitzahlen (ortsunabhängige App)

`build/05_fetch_plz.js` baut `public/data/plz.json` (≈8.300 deutsche PLZ →
[lat, lon], ~200 KB) aus dem offenen Datensatz
`github.com/WZBSocialScienceCenter/plz_geocoord`. Damit tippt die Nutzer:in ihre
PLZ ein; die BA-Suche nutzt die PLZ direkt (`wo=…`), die OSM-Karte die
zugehörigen Koordinaten. Kein Geocoding-API-Call zur Laufzeit (offline/Zero-Backend).

## 6. Rate-Limits / Etikette

- BERUFENET: 20 Einträge/Seite, ~179 Seiten für die Vollliste → throtteln
  (Build nutzt 120 ms Pause + Retry mit Backoff).
- Overpass wird seit 2026-10 nicht mehr verwendet (siehe §4.2).
