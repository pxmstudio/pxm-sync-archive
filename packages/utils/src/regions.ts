export const regions = [
  { code: "AF", name: "Africa" },
  { code: "AN", name: "Antarctica" },
  { code: "AS", name: "Asia" },
  { code: "EU", name: "Europe" },
  { code: "NA", name: "North America" },
  { code: "OC", name: "Oceania" },
  { code: "SA", name: "South America" },
] as const;

export type Region = (typeof regions)[number];
export type RegionCode = Region["code"];
export type RegionName = Region["name"];

export const regionCodes = regions.map((r) => r.code);
export const regionNames = regions.map((r) => r.name);

export function getRegionByCode(code: string): Region | undefined {
  return regions.find((r) => r.code === code);
}

export function getRegionByName(name: string): Region | undefined {
  return regions.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

// Country to region mapping (ISO 3166-1 alpha-2 to region)
export const countryToRegion: Record<string, RegionCode> = {
  // Africa
  DZ: "AF", AO: "AF", BJ: "AF", BW: "AF", BF: "AF", BI: "AF", CV: "AF", CM: "AF",
  CF: "AF", TD: "AF", KM: "AF", CG: "AF", CD: "AF", CI: "AF", DJ: "AF", EG: "AF",
  GQ: "AF", ER: "AF", SZ: "AF", ET: "AF", GA: "AF", GM: "AF", GH: "AF", GN: "AF",
  GW: "AF", KE: "AF", LS: "AF", LR: "AF", LY: "AF", MG: "AF", MW: "AF", ML: "AF",
  MR: "AF", MU: "AF", MA: "AF", MZ: "AF", NA: "AF", NE: "AF", NG: "AF", RW: "AF",
  ST: "AF", SN: "AF", SC: "AF", SL: "AF", SO: "AF", ZA: "AF", SS: "AF", SD: "AF",
  TZ: "AF", TG: "AF", TN: "AF", UG: "AF", ZM: "AF", ZW: "AF",
  // Asia
  AF: "AS", AM: "AS", AZ: "AS", BH: "AS", BD: "AS", BT: "AS", BN: "AS", KH: "AS",
  CN: "AS", CY: "AS", GE: "AS", IN: "AS", ID: "AS", IR: "AS", IQ: "AS", IL: "AS",
  JP: "AS", JO: "AS", KZ: "AS", KW: "AS", KG: "AS", LA: "AS", LB: "AS", MY: "AS",
  MV: "AS", MN: "AS", MM: "AS", NP: "AS", KP: "AS", KR: "AS", OM: "AS", PK: "AS",
  PS: "AS", PH: "AS", QA: "AS", SA: "AS", SG: "AS", LK: "AS", SY: "AS", TW: "AS",
  TJ: "AS", TH: "AS", TL: "AS", TR: "AS", TM: "AS", AE: "AS", UZ: "AS", VN: "AS",
  YE: "AS",
  // Europe
  AL: "EU", AD: "EU", AT: "EU", BY: "EU", BE: "EU", BA: "EU", BG: "EU", HR: "EU",
  CZ: "EU", DK: "EU", EE: "EU", FI: "EU", FR: "EU", DE: "EU", GR: "EU", HU: "EU",
  IS: "EU", IE: "EU", IT: "EU", LV: "EU", LI: "EU", LT: "EU", LU: "EU", MT: "EU",
  MD: "EU", MC: "EU", ME: "EU", NL: "EU", MK: "EU", NO: "EU", PL: "EU", PT: "EU",
  RO: "EU", RU: "EU", SM: "EU", RS: "EU", SK: "EU", SI: "EU", ES: "EU", SE: "EU",
  CH: "EU", UA: "EU", GB: "EU", VA: "EU",
  // North America
  AG: "NA", BS: "NA", BB: "NA", BZ: "NA", CA: "NA", CR: "NA", CU: "NA", DM: "NA",
  DO: "NA", SV: "NA", GD: "NA", GT: "NA", HT: "NA", HN: "NA", JM: "NA", MX: "NA",
  NI: "NA", PA: "NA", KN: "NA", LC: "NA", VC: "NA", TT: "NA", US: "NA",
  // Oceania
  AU: "OC", FJ: "OC", KI: "OC", MH: "OC", FM: "OC", NR: "OC", NZ: "OC", PW: "OC",
  PG: "OC", WS: "OC", SB: "OC", TO: "OC", TV: "OC", VU: "OC",
  // South America
  AR: "SA", BO: "SA", BR: "SA", CL: "SA", CO: "SA", EC: "SA", GY: "SA", PY: "SA",
  PE: "SA", SR: "SA", UY: "SA", VE: "SA",
};

export function getRegionForCountry(countryCode: string): RegionCode | undefined {
  return countryToRegion[countryCode];
}
