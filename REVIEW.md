# Review

## Stand

**Voller Tagging-Lauf erledigt** (nach Freigabe der 50er-Stichprobe). Alle 1097
Berufe getaggt (~7,2 €), Validierung grün. Gerüst, Pipeline und Frontend stehen
und sind verifiziert. Offen sind nur noch optionale Schritte (Deploy / GitHub),
die ausdrückliche Freigabe brauchen.

## Adversariale Code-Review (24 Agenten, 4 Dimensionen, Funde gegengeprüft)

| # | Fund | Schwere | Status |
|---|------|---------|--------|
| 1 | XSS: `e.message` ungeescaped in `app.js` innerHTML | schwer | ✅ behoben — `escapeHtml(e.message)` |
| 2 | CSP `style-src 'unsafe-inline'` unnötig permissiv | mittel | ✅ behoben — Balkenbreiten per CSSOM (`util.setzeBalkenBreiten`), CSP jetzt `style-src 'self'` |
| 3 | Begründung nutzte nur 2 von 4 Umgebungs-Dimensionen | mittel | ✅ erweitert um routine_wechsel + anpacken_konzentriert |
| 4 | Toter Code `toggleImSet()` in `state.js` | leicht | ✅ entfernt |
| 5 | §7-Matching-Regeln vollständig korrekt | — | ✅ bestätigt (kein Handlungsbedarf) |

## §12-Checkliste (soweit am Stopp prüfbar)

- [x] **Kein Node im Frontend** — `public/js/` ist Vanilla ES-Module, kein `require`.
- [x] **Build vom Frontend entkoppelt** — Löschen von `build/` lässt das Tool laufen.
- [x] **API-Calls gekapselt** — `api/ba.js`, `api/overpass.js` als einzige
      Link-Builder; sonst kein externer Zugriff. Kein externes `fetch` (Link-Out).
- [x] **Frontend offline lauffähig** — Fragebogen + Ergebnis brauchen kein Netz
      (nur die Live-Buttons öffnen externe Seiten).
- [x] **Begründung deterministisch, nicht-LLM** (`ergebnis.begruendung`).
- [x] **Kein Tracking/Cookies** außer `localStorage`-Fortschritt; Datenschutzhinweis vorhanden.
- [x] **CSP/escapeHtml** durchgängig; `script-src 'self'`, `connect-src 'self'`.
- [x] **Unit-Tests Matching** (7, grün) + **Browser-Smoketest** (0 Konsolenfehler).
- [x] **Datenqualität §12.2** (`build/04_validate.js`, exit 0): **1097 Berufe**
      (≥500 ✓); größte Oberkategorie handwerk_material 15,9 % (≤35 % ✓);
      **alle 81 Tags benutzt**; `needs_review`-Fälle (4) separat in
      `build/raw/review.json`. Warnungen (kein Blocker): 4 Nischen-Tags in < 5
      Berufen, recht_sicherheit bei 1,4 % (echte Datenlage, wenige Rechtsberufe).

## Datenstand

- 1097 Berufe (724 Ausbildung + 370 grundständiges Studium), 4 `needs_review`.
- Tagging-Kosten gesamt ~7,2 € (dank Prompt-Caching deutlich unter Schätzung).
- 3 transiente JSON-Parse-Fehler beim ersten Lauf → JSON-Extraktion robust
  gemacht (erstes balanciertes `{…}`-Objekt); 5 unter-getaggte Berufe (u. a.
  Zahntechniker) per Prompt-Nudge auf ≥ 3 gültige Tags nachgebessert.

## v2-Erweiterung (Branch `feature/v2-erweiterung`)

Auf Wunsch ergänzt und **im Code fertig + verifiziert**:
- **Mehr Berufe:** Master-Studiengänge + Aufstiegsfortbildungen (Meister/Techniker/
  Fachwirt). Enumeration liefert **1841** Berufe (727 Ausbildung + 370 Bachelor +
  373 Master + 371 Weiterbildung). Neues Feld `stufe`.
- **„Wohin kann das führen?":** eigene Ergebnis-Sektion für Master/Weiterbildung
  (Einstieg = Ausbildung+Bachelor im Haupt-Spektrum). `matcheAnschluss()` + 2 Unit-Tests.
- **KI-/Zukunfts-Ampel** je Beruf (niedrig/mittel/hoch) mit aufklappbarem,
  ehrlichem Text — modellbasierte Schätzung, klar markiert.
- **Schul-agnostisch + PLZ-Eingabe:** Schulname raus, Nutzer:in tippt PLZ ein;
  `build/05_fetch_plz.js` → `plz.json` (8298 PLZ). BA-Suche per PLZ, OSM-Karte per
  Koordinaten. Header nur noch „PFADFINDER".
- Verifiziert: 9 Unit-Tests grün; Browser-Smoketest mit synthetischen Volldaten
  (PLZ ✓, 11 KI-Ampeln, Anschluss-Sektion, 0 Konsolenfehler); graceful degradation
  mit Altdaten (Features blenden sich aus, keine Fehler).

> **⚠ Daten-Retag ausstehend:** Der volle Lauf (1841 Berufe inkl. KI-Feld) brach
> nach 125 Berufen ab — die **Anthropic-API-Monatsgrenze** war erreicht
> („regain access 2026-06-01 00:00 UTC"). `berufe.json` ist auf den geprüften
> 1097-Stand zurückgesetzt; `build/raw/berufe_voll.json` (1841) liegt bereit.
> Sobald die Grenze zurückgesetzt ist (oder im Anthropic-Console-Cap angehoben):
> `node build/03_tag_berufe.js --full-retag` → die KI-/Master-/Weiterbildungs-
> Features füllen sich automatisch. Bis dahin läuft die App mit 1097 (ohne KI/Anschluss).

## Offen (nur mit ausdrücklicher Freigabe)

1. GitHub-Remote anlegen + pushen.
2. GitHub Pages aktivieren (Workflow `deploy.yml` liegt bereit), v1 taggen.
3. Optionaler tieferer Simplify-Pass §13 — durch die Reviews bereits weitgehend abgedeckt.
