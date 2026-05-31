/**
 * fragebogen.js — rendert Start + die Fragen (Block A harte Filter,
 * Block B Umgebungsregler, Block C Tätigkeiten, Block D Motivation + Sinn)
 * und verdrahtet die Eingaben mit dem App-State.
 *
 * Datengetrieben aus fragen.json. Keine Logik zum Matching hier.
 */

import { escapeHtml, gemischt, setzeBalkenBreiten } from './util.js';

/** Baut die geordnete Schrittliste aus der Fragebogen-Definition. */
export function baueSchritte(fragen) {
  const schritte = [];
  for (const f of fragen.block_a) schritte.push({ typ: 'blockA', def: f });
  for (const r of fragen.regler) schritte.push({ typ: 'regler', def: r });
  fragen.fragen_c.forEach((tags, idx) =>
    schritte.push({ typ: 'taetigkeit', idx, titel: fragen.fragen_c_titel, tags: gemischt(tags) }),
  );
  schritte.push({ typ: 'motivation' });
  schritte.push({ typ: 'sinnvoll', def: fragen.sinnvoll_frage });
  return schritte;
}

/** Darf der/die Nutzer:in vom aktuellen Schritt weiter? */
export function schrittFertig(schritt, state) {
  const a = state.antworten;
  if (schritt.typ === 'blockA') {
    if (schritt.def.typ === 'mehrfach') return a.blockA[schritt.def.id]?.size >= 1;
    return a.blockA[schritt.def.id] != null;
  }
  return true; // Regler haben Default, Tätigkeiten/Motivation sind optional
}

export function rendereStart(app) {
  app.el.className = 'container';
  const schule = app.daten.config.schulname || '';
  app.el.innerHTML = `
    <section class="startseite">
      <h1>Pfadfinder</h1>
      <p class="untertitel">Finde Ausbildungsberufe und Studiengänge, die zu dem passen, was du wirklich gerne tust — auch die, die kaum jemand kennt.</p>
      <ul class="leitplanken">
        <li>Du bekommst am Ende ein <strong>Spektrum von bis zu 10 Vorschlägen</strong> mit Begründung — keine einzelne „richtige" Wahl.</li>
        <li>Wir fragen nach <strong>konkreten Tätigkeiten</strong>, nicht nach Schulnoten oder Persönlichkeit.</li>
        <li>Dauert etwa <strong>5 Minuten</strong>. Deine Antworten bleiben auf diesem Gerät.</li>
      </ul>
      <button class="btn btn-primary" id="btn-start">Los geht's</button>
      ${app.zwischenstand ? `<div><button class="btn btn-leise" id="btn-weiter-alt">Dort weitermachen, wo ich aufgehört habe</button></div>` : ''}
      <details class="hinweis-block">
        <summary>Datenschutz &amp; Hinweise</summary>
        <p>Dieses Tool speichert deine Antworten ausschließlich lokal in deinem Browser (localStorage), damit du den Fragebogen fortsetzen kannst. Es gibt <strong>kein Tracking, keine Cookies, keine Konten</strong> und deine Antworten werden nirgendwo hochgeladen.</p>
        <p>Erst wenn du auf der Ergebnisseite selbst auf „Stellen in deiner Nähe" oder „Betriebe in deiner Nähe" tippst, öffnet sich eine offizielle Seite der Bundesagentur für Arbeit bzw. eine OpenStreetMap-Karte in einem neuen Tab.</p>
        <p>Die Berufsvorschläge sind eine Orientierungshilfe, keine verbindliche Empfehlung.${schule ? ` Bereitgestellt für: ${escapeHtml(schule)}.` : ''}</p>
      </details>
    </section>`;

  document.getElementById('btn-start').addEventListener('click', () => {
    app.state.screen = 'frage';
    app.state.schritt = 0;
    app.speichere();
    app.rendere();
  });
  const weiterAlt = document.getElementById('btn-weiter-alt');
  if (weiterAlt) weiterAlt.addEventListener('click', () => { app.state.screen = 'frage'; app.rendere(); });
}

export function rendereFrage(app) {
  app.el.className = 'container';
  const schritt = app.schritte[app.state.schritt];
  const nr = app.state.schritt + 1;
  const gesamt = app.schritte.length;
  const prozent = Math.round((nr / gesamt) * 100);
  const istLetzte = app.state.schritt === gesamt - 1;

  let body = '';
  if (schritt.typ === 'blockA') body = renderBlockA(schritt, app);
  else if (schritt.typ === 'regler') body = renderRegler(schritt.def, app);
  else if (schritt.typ === 'taetigkeit') body = renderTaetigkeit(schritt, app);
  else if (schritt.typ === 'motivation') body = renderMotivation(app);
  else if (schritt.typ === 'sinnvoll') body = renderRegler(schritt.def, app, true);

  const fertig = schrittFertig(schritt, app.state);
  app.el.innerHTML = `
    <div class="fortschritt">
      <span>Frage ${nr} von ${gesamt}</span>
      <div class="fortschritt-balken"><div class="fortschritt-balken-fuell" data-width="${prozent}"></div></div>
    </div>
    ${body}
    <div class="frage-navigation">
      ${app.state.schritt > 0 ? `<button class="btn btn-leise" id="btn-zurueck">← Zurück</button>` : '<span></span>'}
      <button class="btn btn-primary" id="btn-weiter" ${fertig ? '' : 'disabled'}>${istLetzte ? 'Ergebnis ansehen' : 'Weiter'}</button>
    </div>`;

  setzeBalkenBreiten(app.el);
  bindeNavigation(schritt, app, istLetzte);
}

// ---- Block A: harte/weiche Filter ----
function renderBlockA(schritt, app) {
  const def = schritt.def;
  const a = app.state.antworten.blockA;
  const mehrfach = def.typ === 'mehrfach';
  const optionen = def.optionen
    .map((opt) => {
      const gewaehlt = mehrfach ? a[def.id]?.has(opt.wert) : a[def.id] === opt.wert;
      return `<label class="option ${gewaehlt ? 'gewaehlt' : ''}">
        <input type="${mehrfach ? 'checkbox' : 'radio'}" name="${def.id}" value="${escapeHtml(opt.wert)}" ${gewaehlt ? 'checked' : ''}>
        <span class="option-text">${escapeHtml(opt.label)}</span></label>`;
    })
    .join('');
  return `<h2 class="frage-titel">${escapeHtml(def.frage)}</h2>
    ${def.hinweis ? `<p class="frage-hinweis">${escapeHtml(def.hinweis)}</p>` : ''}
    <div class="optionen">${optionen}</div>`;
}

// ---- Block B/D: Schieberegler ----
function renderRegler(def, app, istSinn) {
  const wert = app.state.antworten.regler[def.id] ?? 50;
  return `<h2 class="frage-titel">${escapeHtml(def.frage)}</h2>
    <div class="regler-block">
      <div class="regler-label"><span data-pol="links">${escapeHtml(def.linksPol)}</span><span data-pol="rechts">${escapeHtml(def.rechtsPol)}</span></div>
      <input type="range" min="0" max="100" value="${wert}" id="regler-input" data-id="${def.id}" aria-label="${escapeHtml(def.frage)}">
      <div class="regler-ausgabe" id="regler-ausgabe">${reglerText(def, wert)}</div>
    </div>`;
}

function reglerText(def, wert) {
  if (wert <= 20) return `eher ${escapeHtml(def.linksPol)}`;
  if (wert >= 80) return `eher ${escapeHtml(def.rechtsPol)}`;
  if (wert > 20 && wert < 45) return `etwas mehr ${escapeHtml(def.linksPol)}`;
  if (wert > 55 && wert < 80) return `etwas mehr ${escapeHtml(def.rechtsPol)}`;
  return 'geht beides';
}

// ---- Block C: Tätigkeiten ----
function renderTaetigkeit(schritt, app) {
  const tagText = app.daten.fragen.tag_text;
  const gewaehlt = app.state.antworten.taetigkeiten;
  const items = schritt.tags
    .map((tag) => {
      const ist = gewaehlt.has(tag);
      return `<label class="option ${ist ? 'gewaehlt' : ''}">
        <input type="checkbox" data-tag="${escapeHtml(tag)}" ${ist ? 'checked' : ''}>
        <span class="option-text">${escapeHtml(tagText[tag] || tag)}</span></label>`;
    })
    .join('');
  return `<h2 class="frage-titel">${escapeHtml(schritt.titel)}</h2>
    <p class="frage-hinweis">Kreuze alles an, was dich anspricht — oder nichts, wenn nichts dabei ist.</p>
    <div class="optionen">${items}</div>`;
}

// ---- Block D: Motivation ----
function renderMotivation(app) {
  const fragen = app.daten.fragen;
  const gewaehlt = app.state.antworten.motivation;
  const max = fragen.motivation_max || 3;
  const items = fragen.motivationen
    .map((m) => {
      const ist = gewaehlt.has(m.id);
      return `<label class="option ${ist ? 'gewaehlt' : ''}">
        <input type="checkbox" data-motivation="${escapeHtml(m.id)}" ${ist ? 'checked' : ''}>
        <span class="option-text">${escapeHtml(m.label)}</span></label>`;
    })
    .join('');
  return `<h2 class="frage-titel">Was wäre dir in deinem späteren Beruf am wichtigsten?</h2>
    <p class="frage-hinweis">Wähle bis zu ${max} aus.</p>
    <div class="optionen">${items}</div>`;
}

// ---- Eventbindung ----
function bindeNavigation(schritt, app, istLetzte) {
  const zurueck = document.getElementById('btn-zurueck');
  if (zurueck) zurueck.addEventListener('click', () => { app.state.schritt--; app.speichere(); app.rendere(); });
  document.getElementById('btn-weiter').addEventListener('click', () => {
    if (!schrittFertig(schritt, app.state)) return;
    if (istLetzte) { app.zumErgebnis(); return; }
    app.state.schritt++;
    app.speichere();
    app.rendere();
  });

  if (schritt.typ === 'blockA') bindeBlockA(schritt, app);
  else if (schritt.typ === 'regler' || schritt.typ === 'sinnvoll') bindeRegler(app);
  else if (schritt.typ === 'taetigkeit') bindeCheckboxen(app, 'tag', app.state.antworten.taetigkeiten);
  else if (schritt.typ === 'motivation') bindeMotivation(app);
}

function bindeBlockA(schritt, app) {
  const def = schritt.def;
  const a = app.state.antworten.blockA;
  app.el.querySelectorAll(`input[name="${def.id}"]`).forEach((inp) => {
    inp.addEventListener('change', (e) => {
      if (def.typ === 'mehrfach') {
        const set = a[def.id];
        e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
      } else {
        a[def.id] = e.target.value;
      }
      app.speichere();
      app.rendere();
    });
  });
}

function bindeRegler(app) {
  const input = document.getElementById('regler-input');
  const ausgabe = document.getElementById('regler-ausgabe');
  const id = input.dataset.id;
  const def = [...app.daten.fragen.regler, app.daten.fragen.sinnvoll_frage].find((r) => r.id === id);
  input.addEventListener('input', (e) => {
    const wert = parseInt(e.target.value, 10);
    app.state.antworten.regler[id] = wert;
    ausgabe.textContent = reglerText(def, wert);
  });
  input.addEventListener('change', () => app.speichere());
}

function bindeCheckboxen(app, datasetKey, set) {
  app.el.querySelectorAll(`input[data-${datasetKey}]`).forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const wert = e.target.dataset[datasetKey];
      e.target.checked ? set.add(wert) : set.delete(wert);
      e.target.closest('.option').classList.toggle('gewaehlt', e.target.checked);
      app.speichere();
    });
  });
}

function bindeMotivation(app) {
  const set = app.state.antworten.motivation;
  const max = app.daten.fragen.motivation_max || 3;
  app.el.querySelectorAll('input[data-motivation]').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const id = e.target.dataset.motivation;
      if (e.target.checked) {
        if (set.size >= max) { e.target.checked = false; return; }
        set.add(id);
      } else {
        set.delete(id);
      }
      e.target.closest('.option').classList.toggle('gewaehlt', e.target.checked);
      app.speichere();
    });
  });
}
