/**
 * app.js — Hauptcontroller. Lädt die Daten, baut die Schrittliste, hält den
 * State und schaltet zwischen den Screens (Start / Frage / Ergebnis) um.
 * Die Render-Module bekommen dieses `app`-Objekt und rufen seine Helfer auf.
 */

import { ladeDaten } from './daten.js';
import { leererState, ladeState, speichereState, loescheState } from './state.js';
import { baueSchritte, rendereStart, rendereFrage } from './fragebogen.js';
import { rendereErgebnis } from './ergebnis.js';
import { escapeHtml } from './util.js';

function hatFortschritt(state) {
  const a = state.antworten;
  return a.taetigkeiten.size > 0 || a.motivation.size > 0 || state.schritt > 0 || a.blockA.schulabschluss != null;
}

async function start() {
  const el = document.getElementById('app');
  let daten;
  try {
    daten = await ladeDaten();
  } catch (e) {
    el.className = 'container';
    el.innerHTML = `<section class="karte fehler"><h2>Fehler beim Laden</h2><p>${escapeHtml(e.message)}</p>
      <p>Bitte die Seite über einen Webserver öffnen (nicht per Doppelklick als Datei), z. B. GitHub Pages oder <code>python -m http.server</code> im Ordner <code>public/</code>.</p></section>`;
    return;
  }

  const schulnameEl = document.getElementById('schulname');
  if (schulnameEl) schulnameEl.textContent = daten.config.schulname || '';

  const app = {
    daten,
    el,
    state: ladeState(),
    schritte: baueSchritte(daten.fragen),
    zwischenstand: false,
    rendere() {
      window.scrollTo({ top: 0 });
      if (this.state.screen === 'frage') rendereFrage(this);
      else if (this.state.screen === 'ergebnis') rendereErgebnis(this);
      else rendereStart(this);
    },
    speichere() {
      speichereState(this.state);
    },
    zumErgebnis() {
      this.state.screen = 'ergebnis';
      this.speichere();
      this.rendere();
    },
    neuStarten() {
      loescheState();
      this.state = leererState();
      this.schritte = baueSchritte(this.daten.fragen);
      this.rendere();
    },
  };

  app.zwischenstand = hatFortschritt(app.state);
  app.rendere();
}

start();
