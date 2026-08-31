// Valid `country` values for pintostudio/economic-calendar-data-investing-com.
// Keep these actor enums explicit: omitting country is not a reliable all-market query.
export const APIFY_MACRO_COUNTRIES = [
  'spain',
  'united states',
  'united kingdom',
  'germany',
  'france',
  'italy',
  'netherlands',
  'belgium',
  'portugal',
  'austria',
  'switzerland',
  'norway',
  'sweden',
  'denmark',
  'finland',
  'poland',
  'czech republic',
  'hungary',
  'greece',
  'turkey',
  'russia',
  'china',
  'japan',
  'south korea',
  'india',
  'australia',
  'canada',
  'brazil',
  'mexico',
  'argentina',
  'chile',
  'colombia',
  'peru',
  'south africa',
  'israel',
  'saudi arabia',
  'united arab emirates',
  'malaysia',
  'singapore',
  'thailand',
  'indonesia',
  'philippines',
  'vietnam',
  'taiwan',
  'hong kong',
  'new zealand',
];

const COUNTRY_BY_NORMALIZED_NAME = new Map(
  APIFY_MACRO_COUNTRIES.map((country) => [country.toLowerCase(), country]),
);

export function parseApifyMacroCountries(value) {
  const countries = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((country) => country.trim())
      .filter(Boolean);

  const invalid = [];
  const valid = [];
  for (const country of countries) {
    const normalized = String(country).trim().toLowerCase();
    const actorCountry = COUNTRY_BY_NORMALIZED_NAME.get(normalized);
    if (actorCountry) valid.push(actorCountry);
    else invalid.push(String(country).trim());
  }

  if (invalid.length) {
    throw new Error(`Unsupported APIFY_MACRO_COUNTRIES value(s): ${invalid.join(', ')}`);
  }

  return [...new Set(valid)];
}
