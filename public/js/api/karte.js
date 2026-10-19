/**
 * api/karte.js — Link auf eine Kartensuche nach typischen Betrieben eines Berufs
 * in der Nähe der eingegebenen PLZ (Google Maps, offizielles URL-Format
 * https://developers.google.com/maps/documentation/urls/get-started).
 *
 * KEIN fetch — nutzer-initiierter Link-Out, die App selbst bleibt trackingfrei.
 *
 * Warum nicht mehr OpenStreetMap/overpass-turbo? Am 2026-10-19 gemessen: Der
 * Haupt-Overpass-Server antwortete in 3 von 8 Versuchen (je ~40 s), sonst sofort
 * „502 at capacity"; der Ausweichserver (private.coffee) 0 von 8; Umkreis 200 km
 * lief immer in „Query timed out". Apple Karten deutete dieselbe Suche mal als
 * Branchensuche, mal als Ortsname. Google Maps: 12 von 12 korrekt (Desktop + iPhone).
 * Details: docs/datenquellen.md §4.2.
 *
 * Der Suchbegriff kommt aus den osm_tags des Berufs (vom Tagger vergeben) über die
 * feste Tabelle unten — kein Datenwert landet ungeprüft im Link.
 */

/** OSM-Tag → deutscher Branchen-Suchbegriff (deckt alle Tags in berufe.json ab, siehe test/links.test.mjs). */
const BEGRIFF = {
  // aeroway
  'aeroway=aerodrome': 'Flugplatz', 'aeroway=hangar': 'Flugzeugwartung', 'aeroway=helipad': 'Hubschrauber',
  'aeroway=heliport': 'Hubschrauber', 'aeroway=terminal': 'Flughafen', 'aeroway=tower': 'Flughafen',
  'aeroway=gate': 'Flughafen', 'aeroway=apron': 'Flughafen',
  // amenity
  'amenity=animal_boarding': 'Tierpension', 'amenity=animal_shelter': 'Tierheim', 'amenity=animal_breeding': 'Tierzucht',
  'amenity=arts_centre': 'Kulturzentrum', 'amenity=bank': 'Bank', 'amenity=bar': 'Bar', 'amenity=boat_rental': 'Bootsverleih',
  'amenity=bus_station': 'Busunternehmen', 'amenity=car_wash': 'Autowaschanlage', 'amenity=casino': 'Spielbank',
  'amenity=charging_station': 'Ladestation', 'amenity=cafe': 'Café', 'amenity=childcare': 'Kinderbetreuung',
  'amenity=cinema': 'Kino', 'amenity=clinic': 'Klinik', 'amenity=college': 'Fachschule',
  'amenity=community_centre': 'Gemeindezentrum', 'amenity=concert_hall': 'Konzerthaus',
  'amenity=conference_centre': 'Kongresszentrum', 'amenity=courthouse': 'Gericht', 'amenity=dancing_school': 'Tanzschule',
  'amenity=dentist': 'Zahnarztpraxis', 'amenity=doctors': 'Arztpraxis', 'amenity=dojo': 'Kampfsportschule',
  'amenity=driving_school': 'Fahrschule', 'amenity=events_venue': 'Veranstaltungsort', 'amenity=exhibition_centre': 'Messe',
  'amenity=fast_food': 'Schnellrestaurant', 'amenity=ferry_terminal': 'Fähre', 'amenity=fire_station': 'Feuerwehr',
  'amenity=flight_school': 'Flugschule', 'amenity=food_court': 'Gastronomie', 'amenity=fuel': 'Tankstelle',
  'amenity=funeral_hall': 'Bestattungsunternehmen', 'amenity=hospice': 'Hospiz', 'amenity=hospital': 'Krankenhaus',
  'amenity=hotel': 'Hotel', 'amenity=kindergarten': 'Kindergarten', 'amenity=language_school': 'Sprachschule',
  'amenity=library': 'Bibliothek', 'amenity=music_school': 'Musikschule', 'amenity=music_venue': 'Musikclub',
  'amenity=nightclub': 'Diskothek', 'amenity=nursing_home': 'Pflegeheim', 'amenity=parcel_locker': 'Paketdienst',
  'amenity=pharmacy': 'Apotheke', 'amenity=place_of_worship': 'Kirchengemeinde', 'amenity=planning_authority': 'Bauamt',
  'amenity=police': 'Polizei', 'amenity=post_office': 'Post', 'amenity=pub': 'Kneipe', 'amenity=recycling': 'Recyclinghof',
  'amenity=restaurant': 'Restaurant', 'amenity=riding_hall': 'Reitstall', 'amenity=school': 'Schule',
  'amenity=ski_school': 'Skischule', 'amenity=social_facility': 'soziale Einrichtung', 'amenity=spa': 'Wellness',
  'amenity=studio': 'Tonstudio', 'amenity=theatre': 'Theater', 'amenity=townhall': 'Rathaus',
  'amenity=training': 'Bildungszentrum', 'amenity=university': 'Hochschule', 'amenity=vending_machine': 'Automatenaufsteller',
  'amenity=veterinary': 'Tierarztpraxis', 'amenity=waste_disposal': 'Entsorgungsbetrieb',
  // building
  'building=farm': 'Landwirtschaftlicher Betrieb', 'building=church': 'Kirchengemeinde',
  // craft
  'craft=agricultural_engines': 'Landmaschinen', 'craft=bag_repair': 'Täschnerei', 'craft=bakery': 'Bäckerei',
  'craft=basket_maker': 'Korbflechterei', 'craft=beekeeper': 'Imkerei', 'craft=bicycle': 'Fahrradwerkstatt',
  'craft=blacksmith': 'Schmiede', 'craft=boat_builder': 'Bootsbau', 'craft=boatbuilder': 'Bootsbau',
  'craft=bookbinder': 'Buchbinderei', 'craft=brewery': 'Brauerei', 'craft=bricklayer': 'Maurerbetrieb',
  'craft=brush_maker': 'Bürstenmacher', 'craft=builder': 'Bauunternehmen', 'craft=butcher': 'Metzgerei',
  'craft=cabinet_maker': 'Schreinerei', 'craft=candle_maker': 'Kerzenmanufaktur', 'craft=car_repair': 'Autowerkstatt',
  'craft=carpenter': 'Tischlerei', 'craft=chimney_sweeper': 'Schornsteinfeger', 'craft=cleaning': 'Gebäudereinigung',
  'craft=confectionery': 'Konditorei', 'craft=cooper': 'Böttcherei', 'craft=dairy': 'Molkerei',
  'craft=dental_technician': 'Dentallabor', 'craft=distillery': 'Brennerei', 'craft=dressmaker': 'Maßschneiderei',
  'craft=dyer': 'Färberei', 'craft=electrician': 'Elektroinstallateur', 'craft=engraver': 'Gravur',
  'craft=floorer': 'Bodenleger', 'craft=framer': 'Bilderrahmen', 'craft=gardener': 'Garten- und Landschaftsbau',
  'craft=glassblower': 'Glasbläserei',
  'craft=glaziery': 'Glaserei', 'craft=gunsmith': 'Büchsenmacher', 'craft=hvac': 'Heizung Lüftung Klima',
  'craft=insulation': 'Dämmtechnik', 'craft=jeweller': 'Goldschmied', 'craft=joiner': 'Schreinerei',
  'craft=leather': 'Lederwerkstatt', 'craft=locksmith': 'Schlosserei', 'craft=luthier': 'Geigenbau',
  'craft=metal_construction': 'Metallbau', 'craft=motorcycle_repair': 'Motorradwerkstatt',
  'craft=musical_instrument': 'Musikinstrumentenbau', 'craft=musical_instrument_maker': 'Musikinstrumentenbau',
  'craft=optician': 'Augenoptiker', 'craft=organ_builder': 'Orgelbau', 'craft=orthopaedic_technician': 'Orthopädietechnik',
  'craft=orthopaedic_technology': 'Orthopädietechnik', 'craft=packaging': 'Verpackung', 'craft=painter': 'Malerbetrieb',
  'craft=paper_mill': 'Papierfabrik', 'craft=parquet_layer': 'Parkettleger', 'craft=pest_control': 'Schädlingsbekämpfung',
  'craft=photographer': 'Fotograf', 'craft=piano_tuner': 'Klavierbauer', 'craft=plasterer': 'Stuckateur',
  'craft=plumber': 'Sanitärinstallateur', 'craft=pottery': 'Töpferei', 'craft=printer': 'Druckerei',
  'craft=printing': 'Druckerei', 'craft=printmaker': 'Druckwerkstatt', 'craft=restoration': 'Restaurator',
  'craft=roofer': 'Dachdecker', 'craft=saddler': 'Sattlerei', 'craft=sailmaker': 'Segelmacherei',
  'craft=scaffolder': 'Gerüstbau', 'craft=sculptor': 'Bildhauer', 'craft=shoemaker': 'Schuhmacher',
  'craft=signmaker': 'Werbetechnik', 'craft=stonemason': 'Steinmetz', 'craft=tailor': 'Schneiderei',
  'craft=tiler': 'Fliesenleger', 'craft=toy_maker': 'Spielzeughersteller', 'craft=upholsterer': 'Polsterei',
  'craft=watchmaker': 'Uhrmacher', 'craft=well_sinker': 'Brunnenbau', 'craft=window_construction': 'Fensterbau',
  'craft=winery': 'Weingut',
  // sonstige Einzel-Keys
  'cuisine=burger': 'Burger Restaurant', 'denomination=catholic': 'katholische Kirchengemeinde',
  'emergency=ambulance_station': 'Rettungswache', 'emergency=fire_station': 'Feuerwehr', 'emergency=yes': 'Rettungsdienst',
  'generator:source=wind': 'Windpark', 'harbour=yes': 'Hafen', 'plant=biogas': 'Biogasanlage',
  'social_facility=workshop': 'Werkstatt für Menschen mit Behinderung',
  // healthcare
  'healthcare=*': 'Gesundheitszentrum', 'healthcare=alternative': 'Heilpraktiker', 'healthcare=audiologist': 'Hörakustiker',
  'healthcare=centre': 'Gesundheitszentrum', 'healthcare=clinic': 'Klinik', 'healthcare=counselling': 'Beratungsstelle',
  'healthcare=dentist': 'Zahnarztpraxis', 'healthcare=dialysis': 'Dialysezentrum', 'healthcare=dietitian': 'Ernährungsberatung',
  'healthcare=doctor': 'Arztpraxis', 'healthcare=emergency': 'Notaufnahme', 'healthcare=home_care': 'Pflegedienst',
  'healthcare=hospice': 'Hospiz', 'healthcare=hospital': 'Krankenhaus', 'healthcare=laboratory': 'medizinisches Labor',
  'healthcare=midwife': 'Hebamme', 'healthcare=nurse': 'Pflegedienst', 'healthcare=nursing_home': 'Pflegeheim',
  'healthcare=nutrition_counseling': 'Ernährungsberatung', 'healthcare=optometrist': 'Augenoptiker',
  'healthcare=pharmacy': 'Apotheke', 'healthcare=physiotherapist': 'Physiotherapie', 'healthcare=podiatrist': 'Podologie',
  'healthcare=psychiatry': 'Psychiatrie', 'healthcare=psychotherapist': 'Psychotherapie',
  'healthcare=rehabilitation': 'Reha-Klinik', 'healthcare=social_facility': 'soziale Einrichtung',
  'healthcare=speech_therapist': 'Logopädie', 'healthcare=veterinary': 'Tierarztpraxis',
  // highway / historic
  'highway=construction': 'Straßenbau', 'highway=services': 'Raststätte',
  'historic=archaeological_site': 'Denkmalpflege', 'historic=building': 'Denkmalpflege', 'historic=castle': 'Schloss',
  'historic=monument': 'Denkmalpflege',
  // industrial
  'industrial=asphalt': 'Asphaltmischwerk', 'industrial=brewery': 'Brauerei', 'industrial=ceramic': 'Keramik',
  'industrial=ceramics': 'Keramik', 'industrial=concrete': 'Betonwerk', 'industrial=concrete_plant': 'Betonwerk',
  'industrial=electroplating': 'Galvanik', 'industrial=factory': 'Industriebetrieb', 'industrial=foundry': 'Gießerei',
  'industrial=glass': 'Glashütte', 'industrial=glassworks': 'Glashütte', 'industrial=machine_shop': 'Maschinenbau',
  'industrial=manufacturing': 'Industriebetrieb', 'industrial=mill': 'Mühle', 'industrial=mine': 'Bergwerk',
  'industrial=packaging': 'Verpackung', 'industrial=paper': 'Papierfabrik', 'industrial=port': 'Hafen',
  'industrial=sawmill': 'Sägewerk', 'industrial=steel_works': 'Stahlwerk', 'industrial=textile': 'Textilfabrik',
  'industrial=warehouse': 'Logistikzentrum', 'industrial=winery': 'Weingut',
  // landuse
  'landuse=aquaculture': 'Fischzucht', 'landuse=cemetery': 'Friedhof', 'landuse=construction': 'Bauunternehmen',
  'landuse=farmyard': 'Landwirtschaftlicher Betrieb', 'landuse=fishfarm': 'Fischzucht', 'landuse=forest': 'Forstbetrieb',
  'landuse=greenfield': 'Bauunternehmen', 'landuse=greenhouse_horticulture': 'Gärtnerei', 'landuse=harbour': 'Hafen',
  'landuse=industrial': 'Industriebetrieb', 'landuse=landfill': 'Deponie', 'landuse=orchard': 'Obstbau',
  'landuse=plant_nursery': 'Baumschule', 'landuse=port': 'Hafen', 'landuse=quarry': 'Steinbruch',
  'landuse=vineyard': 'Weingut',
  // leisure
  'leisure=beach_resort': 'Strandbad', 'leisure=circus': 'Zirkus', 'leisure=dance': 'Tanzschule',
  'leisure=fitness_centre': 'Fitnessstudio', 'leisure=golf_course': 'Golfclub', 'leisure=horse_riding': 'Reitstall',
  'leisure=marina': 'Yachthafen', 'leisure=nature_reserve': 'Naturschutz', 'leisure=pitch': 'Sportverein',
  'leisure=pitch,sport=tennis': 'Tennisverein', 'leisure=sports_centre': 'Sportzentrum', 'leisure=stadium': 'Stadion',
  'leisure=swimming_pool': 'Schwimmbad',
  // man_made
  'man_made=breakwater': 'Wasserbau', 'man_made=dyke': 'Wasserbau', 'man_made=pier': 'Hafen',
  'man_made=pipeline': 'Rohrleitungsbau', 'man_made=silo': 'Landhandel', 'man_made=wastewater_plant': 'Kläranlage',
  'man_made=water_tower': 'Wasserversorgung', 'man_made=water_well': 'Brunnenbau', 'man_made=water_works': 'Wasserwerk',
  'man_made=waterworks': 'Wasserwerk', 'man_made=watermill': 'Mühle', 'man_made=works': 'Industriebetrieb',
  // office
  'office=accountant': 'Buchhaltungsbüro', 'office=advertising_agency': 'Werbeagentur',
  'office=agricultural': 'Landwirtschaftskammer', 'office=architect': 'Architekturbüro', 'office=association': 'Verband',
  'office=company': 'Unternehmen', 'office=consulting': 'Unternehmensberatung', 'office=construction': 'Bauunternehmen',
  'office=construction_company': 'Bauunternehmen', 'office=courier': 'Kurierdienst',
  'office=educational_institution': 'Bildungsträger', 'office=electrical_contractor': 'Elektroinstallateur',
  'office=employment_agency': 'Personalvermittlung', 'office=energy_supplier': 'Energieversorger',
  'office=engineer': 'Ingenieurbüro', 'office=engineering': 'Ingenieurbüro', 'office=estate_agent': 'Immobilienmakler',
  'office=film_production': 'Filmproduktion', 'office=financial': 'Finanzdienstleister',
  'office=financial_advisor': 'Finanzberatung', 'office=government': 'Stadtverwaltung', 'office=graphic_design': 'Grafikdesign',
  'office=guide': 'Stadtführung', 'office=healthcare': 'Krankenkasse', 'office=insurance': 'Versicherung',
  'office=it': 'IT-Dienstleister', 'office=lawyer': 'Rechtsanwalt', 'office=marketing': 'Marketingagentur',
  'office=media': 'Medienunternehmen', 'office=moving_company': 'Umzugsunternehmen', 'office=newspaper': 'Zeitungsverlag',
  'office=ngo': 'gemeinnützige Organisation', 'office=notary': 'Notar', 'office=painter': 'Malerbetrieb',
  'office=pest_control': 'Schädlingsbekämpfung', 'office=production': 'Produktionsfirma',
  'office=property_management': 'Hausverwaltung', 'office=psychologist': 'Psychologische Praxis', 'office=publisher': 'Verlag',
  'office=research': 'Forschungsinstitut', 'office=security': 'Sicherheitsdienst', 'office=surveyor': 'Vermessungsbüro',
  'office=tax_advisor': 'Steuerberater', 'office=television': 'Fernsehsender', 'office=therapist': 'Therapiepraxis',
  'office=travel_agent': 'Reisebüro', 'office=cleaning': 'Gebäudereinigung',
  // power / Verkehr / Religion
  'power=generator': 'Energieversorger', 'power=plant': 'Kraftwerk', 'power=substation': 'Netzbetreiber',
  'public_transport=station': 'Verkehrsbetriebe', 'railway=construction': 'Gleisbau', 'railway=signal_box': 'Stellwerk',
  'railway=station': 'Bahnhof', 'religion=christian': 'Kirchengemeinde', 'religion=muslim': 'Moschee',
  // shop
  'shop=agrarian': 'Landhandel', 'shop=art': 'Galerie', 'shop=bakery': 'Bäckerei', 'shop=beauty': 'Kosmetikstudio',
  'shop=bicycle': 'Fahrradladen', 'shop=books': 'Buchhandlung', 'shop=butcher': 'Metzgerei', 'shop=candles': 'Kerzen',
  'shop=car': 'Autohaus', 'shop=car_repair': 'Autowerkstatt', 'shop=caravan': 'Wohnmobilhändler', 'shop=ceramics': 'Keramik',
  'shop=chemist': 'Drogerie', 'shop=cleaning': 'Textilreinigung', 'shop=clothes': 'Bekleidungsgeschäft',
  'shop=computer': 'Computerladen', 'shop=confectionery': 'Konditorei', 'shop=convenience': 'Lebensmittelgeschäft',
  'shop=copyshop': 'Copyshop', 'shop=cosmetics': 'Kosmetik', 'shop=curtain': 'Raumausstatter', 'shop=dairy': 'Molkerei',
  'shop=department_store': 'Kaufhaus', 'shop=doityourself': 'Baumarkt', 'shop=doors': 'Türen',
  'shop=dry_cleaning': 'Textilreinigung', 'shop=electronics': 'Elektronikfachmarkt', 'shop=fabric': 'Stoffladen',
  'shop=florist': 'Blumenladen', 'shop=flooring': 'Bodenbeläge', 'shop=frame': 'Bilderrahmen',
  'shop=funeral_directors': 'Bestattungsunternehmen', 'shop=furniture': 'Möbelhaus', 'shop=garden_centre': 'Gartencenter',
  'shop=glass': 'Glaserei', 'shop=glaziery': 'Glaserei', 'shop=hairdresser': 'Friseur', 'shop=hearing_aids': 'Hörakustiker',
  'shop=honey': 'Imkerei', 'shop=houseware': 'Haushaltswaren', 'shop=interior_decoration': 'Raumausstatter',
  'shop=jewelry': 'Juwelier', 'shop=kitchen': 'Küchenstudio', 'shop=laundry': 'Wäscherei', 'shop=leather': 'Lederwaren',
  'shop=massage': 'Massage', 'shop=medical_supply': 'Sanitätshaus', 'shop=motorcycle': 'Motorradhändler',
  'shop=music': 'Musikgeschäft', 'shop=musical_instrument': 'Musikinstrumente', 'shop=optician': 'Optiker',
  'shop=paint': 'Farbenfachhandel', 'shop=pastry': 'Konditorei', 'shop=perfumery': 'Parfümerie', 'shop=photo': 'Fotostudio',
  'shop=pottery': 'Töpferei', 'shop=printing': 'Druckerei', 'shop=seafood': 'Fischhandel', 'shop=shoes': 'Schuhgeschäft',
  'shop=sign': 'Werbetechnik', 'shop=sports': 'Sportgeschäft', 'shop=supermarket': 'Supermarkt', 'shop=tailor': 'Schneiderei',
  'shop=tiles': 'Fliesenhandel', 'shop=toys': 'Spielwarengeschäft', 'shop=trade': 'Großhandel',
  'shop=travel_agency': 'Reisebüro', 'shop=tyres': 'Reifenhandel', 'shop=watches': 'Uhrmacher',
  'shop=weapons': 'Waffengeschäft', 'shop=wholesale': 'Großhandel', 'shop=windows': 'Fensterbau', 'shop=wine': 'Weinhandlung',
  // sport
  'sport=diving': 'Tauchschule', 'sport=equestrian': 'Reitstall', 'sport=fencing': 'Fechtverein', 'sport=fitness': 'Fitnessstudio',
  'sport=golf': 'Golfclub', 'sport=judo': 'Judoverein', 'sport=sailing': 'Segelschule', 'sport=skiing': 'Skischule',
  'sport=soccer': 'Fußballverein', 'sport=surfing': 'Surfschule', 'sport=swimming': 'Schwimmbad', 'sport=tai_chi': 'Tai-Chi',
  'sport=tennis': 'Tennisverein', 'sport=yoga': 'Yogastudio',
  // tourism / waterway / zoo
  'tourism=camp_site': 'Campingplatz', 'tourism=circus': 'Zirkus', 'tourism=gallery': 'Galerie',
  'tourism=guest_house': 'Pension', 'tourism=hotel': 'Hotel', 'tourism=information': 'Tourist-Information',
  'tourism=museum': 'Museum', 'tourism=zoo': 'Zoo',
  'waterway=boatyard': 'Bootswerft', 'waterway=lock_gate': 'Wasserstraßen- und Schifffahrtsamt', 'waterway=weir': 'Wasserbau',
  'zoo=wildlife_park': 'Wildpark', 'zoo=yes': 'Zoo',
};

/** Sehr allgemeine Tags („Unternehmen", „Industriebetrieb") nur nehmen, wenn nichts Spezifischeres da ist. */
const ALLGEMEIN = new Set([
  'office=company', 'industrial=factory', 'industrial=manufacturing', 'landuse=industrial', 'man_made=works',
  'landuse=construction', 'landuse=greenfield',
]);

/** Deutscher Suchbegriff für die Kartensuche — oder null, wenn kein Tag des Berufs bekannt ist. */
export function kartenBegriff(beruf) {
  const tags = (beruf.osm_tags || []).filter((t) => Object.hasOwn(BEGRIFF, t));
  const tag = tags.find((t) => !ALLGEMEIN.has(t)) || tags[0];
  return tag ? BEGRIFF[tag] : null;
}

/**
 * Link auf eine Kartensuche nach Betrieben in der Nähe — oder null, wenn der Beruf
 * keine typischen Betriebe hat (osm_tags leer) oder keine gültige PLZ vorliegt.
 * @param {object} beruf
 * @param {string} plz  vom Aufrufer gegen die PLZ-Tabelle geprüft (sonst '')
 * @returns {{url:string, label:string}|null}
 */
export function betriebeLink(beruf, plz) {
  const begriff = kartenBegriff(beruf);
  if (!begriff || !plz) return null;
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${begriff} ${plz}`)}`,
    label: 'Betriebe in deiner Nähe (Karte)',
  };
}
