/** util.js — kleine geteilte Helfer. */

/** HTML-escapen für alle dynamisch eingesetzten Texte (Beruf-Namen, Tag-Texte). */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Setzt Balken-Breiten per CSSOM (el.style) statt per Inline-style-Attribut im
 * HTML. So braucht die CSP kein style-src 'unsafe-inline' — el.style.width wird
 * von style-src nicht blockiert, ein style="" im geparsten HTML aber schon.
 */
export function setzeBalkenBreiten(root) {
  root.querySelectorAll('[data-width]').forEach((el) => {
    el.style.width = `${el.dataset.width}%`;
  });
}

/** Fisher-Yates-Shuffle einer Kopie (für Item-Reihenfolge pro Sitzung). */
export function gemischt(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
