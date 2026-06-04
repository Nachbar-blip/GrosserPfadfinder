"""Gezielter Smoketest für die ehrlichen Hinweise (Mobilitäts-Nudge & Co.).

Ergänzt smoke_browser.py: wählt im Fragebogen bewusst „würde umziehen" (umkreis=200)
und Glas-/Keramik-Tätigkeiten, sodass ein SELTENER Beruf oben landet — und prüft,
dass die neuen erklärenden Hinweise im Browser tatsächlich gerendert werden:
  - Mobilitäts-Hinweis (selten + umziehen)
  - „Keine Treffer? Kein Fehler."-Quellenhinweis (immer)
  - Betriebs-Karten-Hinweis (Studium/Büro ohne OSM-Karte)
Speichert einen Screenshot als Beleg.
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/"
GLASS_TAGS = ["glas_bearbeiten", "praezisionsarbeit_hand", "produkt_entwerfen",
              "zeichnen_illustrieren", "stein_keramik_formen", "metall_bearbeiten"]
fehler = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 900, "height": 1400})
    page.on("console", lambda m: fehler.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))

    page.goto(URL, wait_until="networkidle")
    page.click("#btn-start")

    for _ in range(30):
        # umkreis: bewusst „würde umziehen" (200) wählen → hebt seltene Berufe an
        if page.locator('input[name="umkreis"][value="200"]').count():
            page.check('input[name="umkreis"][value="200"]')
        # Schulabschluss: Abitur (lässt alle Wege/Stufen zu)
        if page.locator('input[name="schulabschluss"]').count():
            opt = page.locator('input[name="schulabschluss"][value="abitur"]')
            (opt if opt.count() else page.locator('input[name="schulabschluss"]').first).check()
        # Weg (mehrfach): alle ankreuzen, damit die selten-Ausbildung nicht wegfällt
        if page.locator('input[name="weg"]').count():
            wege = page.locator('input[name="weg"]')
            for i in range(wege.count()):
                wege.nth(i).check()
        # Gehalt o.ä. einfache Block-A-Fragen: erste Option
        for name in ("gehalt_wichtig",):
            loc = page.locator(f'input[name="{name}"]')
            if loc.count():
                loc.first.check()
        # Tätigkeiten: gezielt Glas/Keramik/Metall ankreuzen
        for tag in GLASS_TAGS:
            t = page.locator(f'input[data-tag="{tag}"]')
            if t.count():
                t.check()

        weiter = page.locator("#btn-weiter")
        if weiter.count() == 0:
            break
        if weiter.is_disabled():
            # noch eine Pflicht-Block-A-Option offen → erste Radio wählen
            r = page.locator('input[type=radio]')
            if r.count():
                r.first.check()
        label = (weiter.inner_text() or "").strip()
        weiter.click()
        page.wait_for_timeout(120)
        if "Ergebnis" in label:
            break

    page.wait_for_timeout(500)
    karten = page.locator(".ergebnis-karte").count()
    selten_badges = page.locator(".badge-selten").count()
    live_hinweise = page.locator(".live-hinweis").count()
    body = page.inner_text("body")

    hat_quelle = "Keine Treffer? Kein Fehler." in body
    hat_mobil = ("Weil du umziehen würdest" in body) or ("nur an wenigen Orten" in body)
    hat_karte = "keine Betriebs-Karte" in body

    print(f"Ergebnis-Karten:        {karten}")
    print(f"selten-Badges:          {selten_badges}")
    print(f".live-hinweis-Elemente: {live_hinweise}")
    print(f"Quellen-Hinweis da:     {hat_quelle}")
    print(f"Mobilitäts-Hinweis da:  {hat_mobil}")
    print(f"Karten-Hinweis da:      {hat_karte}")

    page.screenshot(path="test/screens/v3_hinweise.png", full_page=True)
    print("Screenshot: test/screens/v3_hinweise.png")

    browser.close()

echte_fehler = [f for f in fehler if "favicon" not in f.lower()]
print(f"\nKonsolen-Probleme: {len(echte_fehler)}")
for f in echte_fehler:
    print("  -", f)

probleme = []
if karten == 0:
    probleme.append("keine Ergebnis-Karten")
if not hat_quelle:
    probleme.append("Quellen-Hinweis 'Keine Treffer? Kein Fehler.' fehlt")
if not hat_mobil:
    probleme.append("Mobilitäts-Hinweis fehlt (kein selten-Beruf im Top trotz umziehen+Glas-Tags?)")
if echte_fehler:
    probleme.append("Konsolenfehler")

if probleme:
    print("\nFAIL:", "; ".join(probleme))
    sys.exit(1)
print("\nOK: Ergebnis rendert, Mobilitäts- und Quellen-Hinweis sichtbar, keine Konsolenfehler.")
