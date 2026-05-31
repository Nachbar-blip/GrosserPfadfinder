/**
 * api/overpass.js — Link auf eine vorbefüllte OpenStreetMap-Karte (overpass-turbo),
 * die typische Betriebe des Berufs in der Nähe zeigt.
 *
 * KEIN fetch! overpass-api.de blockt Browser-fetch (mod_security verwirft jeden
 * User-Agent mit "Mozilla/5.0" → 406; fetch kann den UA nicht ändern —
 * verifiziert). overpass-turbo führt die Query serverseitig aus, deshalb öffnen
 * wir sie als Link in einem neuen Tab. Siehe docs/datenquellen.md.
 */

/** Baut die Overpass-QL-Query aus den osm_tags eines Berufs. */
function baueQuery(osmTags, lat, lon, radiusM) {
  const teile = osmTags
    .map((tag) => {
      const idx = tag.indexOf('=');
      if (idx < 0) return null;
      const key = tag.slice(0, idx);
      const val = tag.slice(idx + 1);
      return `  nwr["${key}"="${val}"](around:${radiusM},${lat},${lon});`;
    })
    .filter(Boolean)
    .join('\n');
  return `[out:json][timeout:25];\n(\n${teile}\n);\nout center 60;`;
}

/**
 * Link auf eine Karte mit Betrieben in der Nähe — oder null, wenn der Beruf
 * keine sinnvoll auffindbaren Betriebe hat (osm_tags leer).
 * @returns {{url:string, label:string}|null}
 */
export function betriebeLink(beruf, koordinaten, umkreisKm) {
  const osmTags = beruf.osm_tags || [];
  if (!osmTags.length || !koordinaten) return null;
  const radiusM = Math.min(200, umkreisKm || 50) * 1000;
  const query = baueQuery(osmTags, koordinaten.lat, koordinaten.lon, radiusM);
  const url =
    `https://overpass-turbo.eu/?Q=${encodeURIComponent(query)}` +
    `&C=${koordinaten.lat};${koordinaten.lon};10&R`;
  return { url, label: 'Betriebe in deiner Nähe (Karte)' };
}
