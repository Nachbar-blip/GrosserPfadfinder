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

## Offen (nur mit ausdrücklicher Freigabe)

1. GitHub-Remote anlegen + pushen.
2. GitHub Pages aktivieren (Workflow `deploy.yml` liegt bereit), v1 taggen.
3. Optionaler tieferer Simplify-Pass §13 — durch die Reviews bereits weitgehend abgedeckt.
