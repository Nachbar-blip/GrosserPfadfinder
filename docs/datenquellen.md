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

Die Spec sah ursprünglich vor, BA-Jobsuche und Overpass **per `fetch` direkt im
Browser** abzufragen. Das ist empirisch **nicht möglich**, ohne ein Backend zu
bauen — und „Zero Backend" ist ein nicht verhandelbares Leitprinzip (§1.2).
Deshalb lösen wir beide Live-Features als **nutzer-initiierte Links auf
offizielle, vorbefüllte Seiten** (`window`-Navigation, kein `fetch`).
Konsequenz: CSP `connect-src` bleibt `'self'`, kein fremder Dritter, kein
Datenschutzproblem.

### 4.1 BA-Jobsuche → CORS-blockiert
- Der Header `X-API-Key` ist ein nicht-simpler Header und erzwingt einen
  CORS-Preflight (OPTIONS). Der Preflight liefert von fremdem Origin **kein**
  `Access-Control-Allow-Origin`/`-Headers` → der Browser bricht ab.
  (Bekanntes offenes Issue `bundesAPI/jobsuche-api#3` seit 2021.)
- **Lösung (`public/js/api/ba.js`):** vorbefüllte offizielle Suchseite öffnen:
  - Ausbildung: `https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was={Beruf}&wo={PLZ}&umkreis={km}`
  - Studium: `https://web.arbeitsagentur.de/studiensuche/suche?suchbegriff={Beruf}`
  - BERUFENET-Steckbrief: `https://web.arbeitsagentur.de/berufenet/beruf/{id}`
  (alle als HTTP 200 verifiziert.)

### 4.2 Overpass / OpenStreetMap → User-Agent-blockiert
- `overpass-api.de` verwirft per mod_security **jeden User-Agent, der
  „Mozilla/5.0" enthält** (also jeden Browser) → HTTP 406. `fetch` kann den
  User-Agent nicht überschreiben. CORS-Header wären zwar da (`ACAO: *`), greifen
  aber nie. Die Schweizer Spiegelinstanz hat nur CH-Daten.
- **Lösung (`public/js/api/overpass.js`):** Link auf **overpass-turbo**, das die
  Query serverseitig ausführt:
  `https://overpass-turbo.eu/?Q={Overpass-QL}&C={lat};{lon};10&R` (`R` = Auto-Run).
  Die Query wird aus den `osm_tags` des Berufs gebaut (kombinierte `nwr`-Union
  mit `around:radius,lat,lon`, `out center`).

> **Wenn echte Inline-Ergebnisse gewünscht sind:** Das ginge nur über einen
> eigenen Mini-Proxy (Cloudflare Worker / Netlify Function), der den `X-API-Key`
> bzw. den Overpass-User-Agent setzt und CORS-Header ergänzt. Das ist dann aber
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
- Overpass (overpass-turbo): max. 2 req/s — durch den Link-Out-Ansatz pro
  Nutzeraktion ohnehin entzerrt.
