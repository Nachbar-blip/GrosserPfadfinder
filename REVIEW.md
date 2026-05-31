# Review

## Stand

Phase 2 (Build) am **Pflicht-Stopp** (Spec §8.3): Gerüst, Daten-Pipeline und
Frontend stehen und sind verifiziert; eine **50er-Stichprobe** wurde getaggt
und wartet auf Freigabe für den vollen Tagging-Lauf. Der vollständige §12/§13
(Review + Simplify auf der finalen `berufe.json`) folgt nach dem vollen Lauf.

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
- [ ] **Datenqualität §12.2** (≥500 Berufe, Kategorienverteilung, jeder Tag ≥5×,
      needs_review-Datei) — `build/04_validate.js` steht bereit, läuft nach dem
      vollen Tagging-Lauf.

## Offene Punkte für nach der Freigabe

1. Vollen Tagging-Lauf fahren (`node build/03_tag_berufe.js`, ~9 €, 1097 Berufe).
2. `build/04_validate.js` ausführen, Datenqualität §12.2 prüfen, `review.json` sichten.
3. `public/data/berufe.json` (dann ~1097) committen; provisorische 50er-Version ersetzen.
4. Simplify-Pass §13 auf der finalen Codebasis (ist durch die Reviews schon weitgehend abgedeckt).
