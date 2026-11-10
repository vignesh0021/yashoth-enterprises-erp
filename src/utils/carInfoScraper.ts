/**
 * YASHOTH ENTERPRISES ERP — CARINFO AUTO-SCRAPER & PARSER UTILITY
 *
 * Enables 1-tap live CarInfo / Parivahan lookup and automated extraction of
 * vehicle specs, owner, insurance, fitness (FC), and pollution (PUCC) compliance dates.
 */

export interface ScrapedVehicleDetails {
  registrationNo: string;
  regNo?: string;
  vehicleModel?: string;
  makerModel?: string;
  vehicleCategory?: 'TWO_WHEELER' | 'COMMERCIAL_TRUCK' | 'LIGHT_VEHICLE' | 'CAR';
  vehicleClass?: 'TWO_WHEELER' | 'COMMERCIAL_TRUCK' | 'LIGHT_VEHICLE' | 'CAR';
  fuelType?: string;
  ownerName?: string;
  unladenWeightKg?: number;
  registrationDate?: string;
  regDate?: string;
  fitnessValidUpto?: string; // YYYY-MM-DD
  fitnessUpto?: string;
  insuranceCompany?: string;
  insurancePolicyNo?: string;
  insuranceValidUpto?: string; // YYYY-MM-DD
  insuranceUpto?: string;
  puccNumber?: string;
  puccValidUpto?: string; // YYYY-MM-DD
  puccUpto?: string;
  permitValidUpto?: string;
  rcStatus?: string;
  rtoCode?: string;
  rtoOffice?: string;
  emissionNorms?: string;
  rawText?: string;
}

/**
 * Normalizes Indian date strings like "12-Apr-2026", "25/11/2026", "2026-11-25" into YYYY-MM-DD.
 */
export function normalizeDateToISO(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const clean = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // DD-Mon-YYYY (e.g. 15-Nov-2026 or 15 Nov 2026)
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const monMatch = clean.match(/^(\d{1,2})[\s/-]([A-Za-z]{3})[\s/-](\d{4})$/);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const month = months[monMatch[2].toLowerCase()] || '01';
    const year = monMatch[3];
    return `${year}-${month}-${day}`;
  }

  const timestamp = Date.parse(clean);
  if (!isNaN(timestamp)) {
    return new Date(timestamp).toISOString().split('T')[0];
  }

  return undefined;
}

/**
 * Returns the direct official URL for CarInfo vehicle lookup.
 */
export function getCarInfoUrl(regNo: string): string {
  const clean = (regNo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `https://www.carinfo.app/rc-details/${clean}`;
}

/**
 * Returns the official mParivahan portal URL.
 */
export function getParivahanUrl(regNo?: string): string {
  return 'https://parivahan.gov.in/rcdlstatus/';
}

/**
 * Parses copied or scraped text from CarInfo, mParivahan, or vehicle inspection sheets.
 * Accurately extracts Model, Owner, Insurance, Fitness, and PUCC dates.
 */
export function parseCarInfoText(raw: string): ScrapedVehicleDetails {
  const result: ScrapedVehicleDetails = {
    registrationNo: '',
    rawText: raw,
  };

  // 1. Registration Number
  const regMatch = raw.match(/\b([A-Z]{2}\s*[-]?\s*\d{1,2}\s*[-]?\s*[A-Z]{0,3}\s*[-]?\s*\d{1,4})\b/i);
  if (regMatch) {
    const formatted = regMatch[1].toUpperCase().replace(/\s+/g, ' ');
    result.registrationNo = formatted;
    result.regNo = formatted;
  }

  // 2. Model / Maker
  const modelRegexes = [
    /(?:model|maker|vehicle description|make|variant)\s*[:=-]\s*([^\n\r,;]+)/i,
    /(?:hero|honda|bajaj|royal enfield|tvs|yamaha|suzuki|ashok leyland|tata|eicher|bharatbenz|mahindra|maruti)\s+[^\n\r]+/i
  ];
  for (const rx of modelRegexes) {
    const match = raw.match(rx);
    if (match) {
      const m = (match[1] || match[0]).trim();
      result.vehicleModel = m;
      result.makerModel = m;
      break;
    }
  }

  // 3. Vehicle Class & Category
  if (/two[-\s]?wheeler|motorcycle|scooter|mcycle|2[-\s]?wn|splendor|activa|pulsar|jupiter/i.test(raw)) {
    result.vehicleClass = 'TWO_WHEELER';
    result.vehicleCategory = 'TWO_WHEELER';
  } else if (/goods carrier|hgv|mgv|lorry|tipper|truck|commercial/i.test(raw)) {
    result.vehicleClass = 'COMMERCIAL_TRUCK';
    result.vehicleCategory = 'COMMERCIAL_TRUCK';
  } else if (/motor car|lmv|car|sedan|suv|hatchback/i.test(raw)) {
    result.vehicleClass = 'CAR';
    result.vehicleCategory = 'CAR';
  } else if (/light goods|lcv|pickup|ace|bolero|dost/i.test(raw)) {
    result.vehicleClass = 'LIGHT_VEHICLE';
    result.vehicleCategory = 'LIGHT_VEHICLE';
  } else {
    result.vehicleClass = 'COMMERCIAL_TRUCK';
    result.vehicleCategory = 'COMMERCIAL_TRUCK';
  }

  // Unladen / Tare Weight
  const wtMatch = raw.match(/(?:unladen|tare|kerb)\s*(?:weight)?\s*[:=-]\s*(\d{2,6})\s*(?:kg)?/i);
  if (wtMatch) {
    result.unladenWeightKg = parseInt(wtMatch[1], 10);
  } else if (result.vehicleCategory === 'TWO_WHEELER') {
    result.unladenWeightKg = 120;
  } else if (result.vehicleCategory === 'LIGHT_VEHICLE') {
    result.unladenWeightKg = 1450;
  } else if (result.vehicleCategory === 'CAR') {
    result.unladenWeightKg = 1100;
  } else {
    result.unladenWeightKg = 4100;
  }

  // 4. Fuel Type
  const fuelMatch = raw.match(/(?:fuel(?:\s*type)?)\s*[:=-]\s*(petrol|diesel|cng|electric|lpg)/i);
  if (fuelMatch) {
    result.fuelType = fuelMatch[1].toUpperCase();
  }

  // 5. Owner Name
  const ownerMatch = raw.match(/(?:owner(?:\s*name)?|registered owner)\s*[:=-]\s*([^\n\r,;]+)/i);
  if (ownerMatch) {
    result.ownerName = ownerMatch[1].trim();
  }

  // 6. Insurance Dates & Policy
  const insExpiryMatch = raw.match(/(?:insurance(?:\s*valid(?:ity)?)?(?:\s*upto)?)\s*[:=-]\s*([0-9A-Za-z\s/.-]{8,15})/i);
  if (insExpiryMatch) {
    const d = normalizeDateToISO(insExpiryMatch[1]);
    result.insuranceValidUpto = d;
    result.insuranceUpto = d;
  }

  const insCoMatch = raw.match(/(?:insurer|insurance company)\s*[:=-]\s*([^\n\r,;]+)/i);
  if (insCoMatch) {
    result.insuranceCompany = insCoMatch[1].trim();
  }

  const insPolMatch = raw.match(/(?:policy(?:\s*no)?)\s*[:=-]\s*([A-Za-z0-9/_-]+)/i);
  if (insPolMatch) {
    result.insurancePolicyNo = insPolMatch[1].trim();
  }

  // 7. Fitness / RC Validity Upto
  const fitnessMatch = raw.match(/(?:fitness|fc|rc valid(?:ity)?)\s*(?:valid(?:ity)?)?(?:\s*upto)?\s*[:=-]\s*([0-9A-Za-z\s/.-]{8,15})/i);
  if (fitnessMatch) {
    const d = normalizeDateToISO(fitnessMatch[1]);
    result.fitnessValidUpto = d;
    result.fitnessUpto = d;
  }

  // 8. PUCC (Pollution) Expiry
  const puccMatch = raw.match(/(?:pucc?|pollution(?:\s*certificate)?)\s*(?:valid(?:ity)?)?(?:\s*upto)?\s*[:=-]\s*([0-9A-Za-z\s/.-]{8,15})/i);
  if (puccMatch) {
    const d = normalizeDateToISO(puccMatch[1]);
    result.puccValidUpto = d;
    result.puccUpto = d;
  }

  // 9. RC Status
  if (/rc\s*status\s*[:=-]\s*(active|suspended|cancelled)/i.test(raw)) {
    const statusMatch = raw.match(/rc\s*status\s*[:=-]\s*(active|suspended|cancelled)/i);
    result.rcStatus = statusMatch ? statusMatch[1].toUpperCase() : 'ACTIVE';
  } else if (/active/i.test(raw)) {
    result.rcStatus = 'ACTIVE';
  }

  // Emission Norms
  const emMatch = raw.match(/(?:emission(?:\s*norms)?|norms?)\s*[:=-]\s*(BS-?[IVX]+|Bharat Stage [IVX]+)/i);
  if (emMatch) {
    result.emissionNorms = emMatch[1].toUpperCase();
  } else {
    result.emissionNorms = 'BS-VI';
  }

  return result;
}
