"""Headless-Smoketest: lädt den Pfadfinder, klickt den Fragebogen durch,
prüft auf Konsolenfehler und gerenderte Ergebnis-Karten."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8099/"
fehler = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.on("console", lambda m: fehler.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))

    page.goto(URL, wait_until="networkidle")

    # Startseite
    assert page.locator("h1", has_text="Pfadfinder").count() > 0, "Startseite-H1 fehlt"
    assert page.locator("#btn-start").count() > 0, "Start-Button fehlt"
    page.click("#btn-start")

    # Durch alle Schritte klicken
    schritte = 0
    while schritte < 30:
        schritte += 1
        # Block-A-Single (radio): erste Option wählen, falls vorhanden und nötig
        radios = page.locator("input[type=radio]")
        checks = page.locator("input[type=checkbox]")
        if radios.count() > 0:
            radios.first.check()
        if checks.count() > 0:
            # ein paar Tätigkeiten/Wege ankreuzen
            n = min(3, checks.count())
            for i in range(n):
                checks.nth(i).check()
        weiter = page.locator("#btn-weiter")
        if weiter.count() == 0:
            break
        # Falls noch disabled (Block A Pflicht), Option schon gewählt -> sollte aktiv sein
        if weiter.is_disabled():
            # versuche radio/checkbox erneut
            if radios.count() > 0:
                radios.first.check()
            if checks.count() > 0:
                checks.first.check()
        label = (weiter.inner_text() or "").strip()
        weiter.click()
        page.wait_for_timeout(120)
        if "Ergebnis" in label:
            break

    page.wait_for_timeout(400)
    karten = page.locator(".ergebnis-karte").count()
    kopf = page.locator(".ergebnis-kopf h1").count()
    print(f"Schritte durchlaufen: {schritte}")
    print(f"Ergebnis-Kopf: {kopf} | Ergebnis-Karten: {karten}")

    # Live-Links prüfen (Stichprobe)
    links = page.locator(".ergebnis-karte a.btn").count()
    print(f"Live-Link-Buttons: {links}")
    berufenet = page.locator("a.link-mehr").count()
    print(f"BERUFENET-Links: {berufenet}")

    browser.close()

echte_fehler = [f for f in fehler if "favicon" not in f.lower()]
print(f"\nKonsolen-Probleme: {len(echte_fehler)}")
for f in echte_fehler:
    print("  -", f)

if karten == 0:
    print("FAIL: keine Ergebnis-Karten gerendert")
    sys.exit(1)
if echte_fehler:
    print("FAIL: Konsolenfehler vorhanden")
    sys.exit(1)
print("\nOK: Frontend lädt, Fragebogen durchlaufbar, Ergebnisse gerendert, keine Konsolenfehler.")
