/**
 * state.js — App-Zustand + Persistenz (localStorage).
 *
 * Hält den Fragebogen-Fortschritt und die Antworten. Sets (Tätigkeiten,
 * Motivation) werden beim Speichern zu Arrays serialisiert und beim Laden
 * wieder zu Sets. Keine sensiblen Daten, kein Tracking — nur Fortschritt.
 */

export const SPEICHER_KEY = 'grosserpfadfinder_state_v1';

export function leererState() {
  return {
    screen: 'start', // 'start' | 'frage' | 'ergebnis'
    schritt: 0,
    antworten: {
      blockA: {
        schulabschluss: null,
        weg: new Set(),
        plz: '',
        umkreis: null,
        gehalt_wichtig: null,
      },
      regler: {
        drinnen_draussen: 50,
        allein_team: 50,
        routine_wechsel: 50,
        anpacken_konzentriert: 50,
        gesellschaftlich_sinnvoll: 50,
      },
      taetigkeiten: new Set(),
      motivation: new Set(),
    },
  };
}

export function speichereState(state) {
  try {
    const a = state.antworten;
    const ser = {
      screen: state.screen,
      schritt: state.schritt,
      antworten: {
        blockA: { ...a.blockA, weg: Array.from(a.blockA.weg || []) },
        regler: { ...a.regler },
        taetigkeiten: Array.from(a.taetigkeiten || []),
        motivation: Array.from(a.motivation || []),
      },
    };
    localStorage.setItem(SPEICHER_KEY, JSON.stringify(ser));
  } catch (e) {
    /* localStorage kann gesperrt sein (Privatmodus) — dann eben kein Speichern. */
  }
}

export function ladeState() {
  try {
    const raw = localStorage.getItem(SPEICHER_KEY);
    if (!raw) return leererState();
    const p = JSON.parse(raw);
    const leer = leererState();
    return {
      screen: p.screen || 'start',
      schritt: typeof p.schritt === 'number' ? p.schritt : 0,
      antworten: {
        blockA: {
          ...leer.antworten.blockA,
          ...(p.antworten?.blockA || {}),
          weg: new Set(p.antworten?.blockA?.weg || []),
        },
        regler: { ...leer.antworten.regler, ...(p.antworten?.regler || {}) },
        taetigkeiten: new Set(p.antworten?.taetigkeiten || []),
        motivation: new Set(p.antworten?.motivation || []),
      },
    };
  } catch (e) {
    return leererState();
  }
}

export function loescheState() {
  try {
    localStorage.removeItem(SPEICHER_KEY);
  } catch (e) {
    /* egal */
  }
}
