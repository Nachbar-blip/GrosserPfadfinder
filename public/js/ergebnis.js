/**
 * ergebnis.js — rendert das Spektrum der Vorschläge (bis zu 10 gleichwertige
 * Karten), eine regelbasierte Begründung pro Beruf und die Live-Buttons
 * (Link-Outs auf BA-Seite / OSM-Karte). Kein LLM, kein fetch.
 */

import { matche, matcheAnschluss, passungsStufe, scoreProzent } from './matching.js';
import { stellenLink, berufenetLink } from './api/ba.js';
import { betriebeLink } from './api/overpass.js';
import { escapeHtml, setzeBalkenBreiten } from './util.js';

const WEG_LABEL = {
  betriebliche_ausbildung: 'Ausbildung',
  schulische_ausbildung: 'Schulische Ausbildung',
  duales_studium: 'Duales Studium',
  studium: 'Studium',
  weiterbildung: 'Weiterbildung',
};

/** Badge-Text nach Stufe (Fallback: Ausbildungsart bei alten Daten ohne Stufe). */
function wegBadge(beruf) {
  switch (beruf.stufe) {
    case 'bachelor': return 'Studium (Bachelor)';
    case 'master': return 'Master';
    case 'weiterbildung': return 'Weiterbildung';
    default: return WEG_LABEL[beruf.ausbildungsart] || 'Ausbildung';
  }
}

function anzeigeName(beruf) {
  return (beruf.name || '').replace(/\s*\((grundständig|grundst\.|weiterführend)\)\s*/i, '').trim();
}

/** KI-/Automatisierungs-Risiko als Ampel mit aufklappbarem Erklärtext. */
function kiAmpel(beruf) {
  if (!beruf.ki_risiko) return '';
  const farbe = { niedrig: 'gruen', mittel: 'gelb', hoch: 'rot' }[beruf.ki_risiko] || 'gelb';
  const label = { niedrig: 'gering', mittel: 'mittel', hoch: 'hoch' }[beruf.ki_risiko] || beruf.ki_risiko;
  return `<details class="ki-block">
    <summary><span class="ki-ampel ki-${farbe}" aria-hidden="true"></span>KI-/Automatisierungs-Risiko: <strong>${label}</strong></summary>
    <p class="ki-text">${escapeHtml(beruf.zukunft_text || '')}<span class="ki-hinweis"> (KI-gestützte Schätzung, kein amtlicher Wert.)</span></p>
  </details>`;
}

/** Regelbasierte Begründung aus den Match-Daten (deterministisch, kein LLM). */
export function begruendung(match, app) {
  const { beruf, matchTags } = match;
  const tagText = app.daten.fragen.tag_text;
  const regler = app.state.antworten.regler;
  const teile = [];

  if (matchTags.length > 0) {
    const texte = matchTags.slice(0, 3).map((t) => `„${tagText[t] || t}“`);
    teile.push(`Passt, weil du ${texte.join(', ')} angekreuzt hast.`);
  } else {
    teile.push('Passt zu deinem Profil bei den Umgebungs- und Motivationsfragen.');
  }

  const u = beruf.umgebung || {};
  const umg = [];
  if (Math.abs((regler.drinnen_draussen ?? 50) - (u.drinnen_draussen ?? 50)) < 25) {
    if (regler.drinnen_draussen < 45) umg.push('drinnen');
    else if (regler.drinnen_draussen > 55) umg.push('draußen');
  }
  if (Math.abs((regler.allein_team ?? 50) - (u.allein_team ?? 50)) < 25) {
    if (regler.allein_team < 45) umg.push('eher allein');
    else if (regler.allein_team > 55) umg.push('im Team');
  }
  if (Math.abs((regler.routine_wechsel ?? 50) - (u.routine_wechsel ?? 50)) < 25) {
    if (regler.routine_wechsel < 45) umg.push('mit ruhiger Routine');
    else if (regler.routine_wechsel > 55) umg.push('mit viel Abwechslung');
  }
  if (Math.abs((regler.anpacken_konzentriert ?? 50) - (u.anpacken_konzentriert ?? 50)) < 25) {
    if (regler.anpacken_konzentriert < 45) umg.push('körperlich anpackend');
    else if (regler.anpacken_konzentriert > 55) umg.push('still konzentriert');
  }
  if (umg.length) teile.push(`Typische Umgebung: ${umg.slice(0, 3).join(', ')}.`);
  teile.push(`Weg: ${WEG_LABEL[beruf.ausbildungsart] || 'Ausbildung'}.`);
  return teile.join(' ');
}

function liveAktionen(beruf, app) {
  const a = app.state.antworten.blockA || {};
  const umkreis = parseInt(a.umkreis, 10) || app.daten.config.default_umkreis_km || 50;
  const plz = (a.plz || '').trim();
  const koordArr = plz && app.daten.plz ? app.daten.plz[plz] : null;
  const koord = koordArr ? { lat: koordArr[0], lon: koordArr[1] } : null;

  const stellen = stellenLink(beruf, plz, umkreis);
  const betriebe = betriebeLink(beruf, koord, umkreis);
  const knoepfe = [`<a class="btn btn-sekundaer" href="${stellen.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(stellen.label)} →</a>`];
  if (betriebe) knoepfe.push(`<a class="btn btn-sekundaer" href="${betriebe.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(betriebe.label)} →</a>`);
  return `<div class="live-aktionen">${knoepfe.join('')}</div>`;
}

function karte(match, i, app) {
  const b = match.beruf;
  const prozent = scoreProzent(match.score);
  const stufe = passungsStufe(match.score);
  const topKlasse = i < 3 ? 'top' : '';
  const seltenBadge =
    b.seltenheit === 'selten'
      ? `<span class="badge-selten" title="Bundesweit nur an wenigen Standorten ausbildbar">selten</span>`
      : '';
  const badge = `<span class="badge-weg">${escapeHtml(wegBadge(b))}</span>`;
  const istStudium = b.stufe === 'bachelor' || b.stufe === 'master' || b.ausbildungsart === 'studium' || b.ausbildungsart === 'duales_studium';
  const dauerLabel = istStudium ? 'Regelstudienzeit' : 'Dauer';
  const dauer = b.dauer_jahre ? `<div class="meta">${dauerLabel}: <strong>${b.dauer_jahre} Jahre</strong></div>` : '';
  const gehalt = b.mediangehalt
    ? `<div class="meta">Einstiegsgehalt: <strong>ca. ${b.mediangehalt.toLocaleString('de-DE')} €</strong>/Monat <span title="grobe Schätzung, kein amtlicher Wert">(geschätzt)</span></div>`
    : '';

  return `<article class="ergebnis-karte ${topKlasse}">
    <div class="rang">Vorschlag ${i + 1}</div>
    <h2>${escapeHtml(anzeigeName(b))} ${badge}${seltenBadge}</h2>
    <div class="match-zeile" title="${escapeHtml(stufe.text)}">
      <div class="match-balken"><div class="match-fuellung ${stufe.klasse}" data-width="${prozent}"></div></div>
      <div class="match-prozent">${prozent}%</div>
    </div>
    <div class="begruendung">${escapeHtml(begruendung(match, app))}</div>
    ${gehalt}${dauer}
    ${kiAmpel(b)}
    ${liveAktionen(b, app)}
    <a class="link-mehr" href="${berufenetLink(b)}" target="_blank" rel="noopener noreferrer">Vollständiger BERUFENET-Eintrag →</a>
  </article>`;
}

/** Kompakte Karte für die "Wohin kann das führen?"-Sektion (Master/Weiterbildung). */
function anschlussKarte(match, app) {
  const b = match.beruf;
  return `<article class="ergebnis-karte anschluss-karte">
    <h3>${escapeHtml(anzeigeName(b))} <span class="badge-weg">${escapeHtml(wegBadge(b))}</span></h3>
    <div class="begruendung">${escapeHtml(begruendung(match, app))}</div>
    ${kiAmpel(b)}
    <a class="link-mehr" href="${berufenetLink(b)}" target="_blank" rel="noopener noreferrer">Auf BERUFENET ansehen →</a>
  </article>`;
}

export function rendereErgebnis(app) {
  app.el.className = 'container-breit';

  if (!app.daten.berufeVorhanden) {
    app.el.innerHTML = `<section class="karte fehler">
      <h2>Noch keine Berufsdaten</h2>
      <p>Die Datei <code>public/data/berufe.json</code> wurde noch nicht erzeugt. Bitte die Build-Pipeline laufen lassen (siehe README).</p>
      <button class="btn btn-sekundaer" id="btn-neu">Neu starten</button></section>`;
    document.getElementById('btn-neu').addEventListener('click', () => app.neuStarten());
    return;
  }

  const a = app.state.antworten;
  const nichts = a.taetigkeiten.size === 0 && a.motivation.size === 0;
  if (nichts) {
    app.el.innerHTML = `<section class="karte">
      <h2>Wir brauchen noch ein paar Antworten</h2>
      <p>Du hast keine Tätigkeiten und keine Motivationen angekreuzt — dann können wir nichts vorschlagen, ohne zu raten.</p>
      <p>Geh zurück und kreuze an, was dich anspricht. Es gibt keine falschen Antworten.</p>
      <div class="ergebnis-aktionen">
        <button class="btn btn-primary" id="btn-zurueck-fragen">Zurück zu den Fragen</button>
        <button class="btn btn-sekundaer" id="btn-neu">Neu starten</button></div></section>`;
    document.getElementById('btn-zurueck-fragen').addEventListener('click', () => {
      app.state.screen = 'frage';
      app.state.schritt = Math.max(0, app.schritte.findIndex((s) => s.typ === 'taetigkeit'));
      app.rendere();
    });
    document.getElementById('btn-neu').addEventListener('click', () => app.neuStarten());
    return;
  }

  const top = matche(app.daten.berufe, a, app.daten.fragen);
  const anschluss = matcheAnschluss(app.daten.berufe, a, app.daten.fragen, 5);
  const anzahl = top.length;
  const hatSelten = top.some((m) => m.beruf.seltenheit === 'selten');

  app.el.innerHTML = `
    <section class="ergebnis-kopf">
      <h1>Deine ${anzahl} Vorschl${anzahl === 1 ? 'ag' : 'äge'}</h1>
      <p>${
        anzahl >= 5
          ? 'Das ist ein Spektrum — nicht DIE eine richtige Wahl. Schau, was dich anspricht, und recherchiere weiter.'
          : 'Zu deinem Profil haben wir nur wenige klar passende Vorschläge gefunden. Schau sie dir genau an — oder geh zurück und kreuze mehr an.'
      }</p>
    </section>
    <section class="ergebnis-gitter">${top.map((m, i) => karte(m, i, app)).join('')}</section>
    ${
      hatSelten
        ? `<div class="grosser-hinweis"><strong>Hinweis zu seltenen Berufen:</strong> Mit „selten" markierte Berufe werden nur an wenigen Orten in Deutschland ausgebildet. Ob es in deiner Nähe einen Platz gibt, klärst du am besten über die Buttons oder direkt bei der Arbeitsagentur.</div>`
        : ''
    }
    ${
      anschluss.length
        ? `<section class="anschluss">
            <h2>Wohin kann das führen?</h2>
            <p>Aufbauend auf einem ersten Abschluss — Studiengänge und Weiterbildungen, die zu deinen Interessen passen:</p>
            <div class="ergebnis-gitter">${anschluss.map((m) => anschlussKarte(m, app)).join('')}</div>
          </section>`
        : ''
    }
    <div class="ergebnis-aktionen">
      <button class="btn btn-primary" id="btn-drucken">Ergebnis drucken / als PDF speichern</button>
      <button class="btn btn-sekundaer" id="btn-neu">Fragebogen neu starten</button>
    </div>`;

  setzeBalkenBreiten(app.el);
  document.getElementById('btn-drucken').addEventListener('click', () => window.print());
  document.getElementById('btn-neu').addEventListener('click', () => app.neuStarten());
}
