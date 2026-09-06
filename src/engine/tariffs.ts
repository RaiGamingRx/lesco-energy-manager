import { BillCharges, TariffCategory, Provider } from '../types';

export interface TariffRule {
  provider: Provider;
  category: TariffCategory;
  effectiveFrom: string;
  currency: string;
  slabs: {
    min: number;
    max: number;
    baseRatePerUnit: number;
  }[];
  electricityDutyRate: number; // e.g. 0.015 (1.5%)
  tvFee: number; // Rs 35 flat
  gstRate: number; // e.g. 0.18 (18%) for unprotected or general
  fixedCharges: number;
  description: string;
}

// LESCO Domestic Electricity Tariff Schedule (Configurable)
export const LESCO_PROTECTED_TARIFF: TariffRule = {
  provider: 'LESCO',
  category: 'domestic_protected',
  effectiveFrom: '2024-07-01',
  currency: 'PKR',
  slabs: [
    { min: 1, max: 100, baseRatePerUnit: 7.74 },
    { min: 101, max: 200, baseRatePerUnit: 14.15 },
  ],
  electricityDutyRate: 0.015,
  tvFee: 35.0,
  gstRate: 0.0, // Protected consumers exempt from standard 18% GST under 200 units
  fixedCharges: 0,
  description: 'Domestic Protected (Consumption <= 200 units for last 6 months)',
};

export const LESCO_UNPROTECTED_TARIFF: TariffRule = {
  provider: 'LESCO',
  category: 'domestic_unprotected',
  effectiveFrom: '2024-07-01',
  currency: 'PKR',
  slabs: [
    { min: 1, max: 100, baseRatePerUnit: 23.59 },
    { min: 101, max: 200, baseRatePerUnit: 30.07 },
    { min: 201, max: 300, baseRatePerUnit: 34.26 },
    { min: 301, max: 400, baseRatePerUnit: 39.15 },
    { min: 401, max: 700, baseRatePerUnit: 42.80 },
    { min: 701, max: 99999, baseRatePerUnit: 48.84 },
  ],
  electricityDutyRate: 0.015,
  tvFee: 35.0,
  gstRate: 0.18, // 18% GST applies once threshold is lost
  fixedCharges: 200,
  description: 'Domestic Unprotected (Crossing 200 units triggers severe rate jumps)',
};

/**
 * Calculates estimated official bill amount based on units and tariff rules.
 * Clearly separated as a projection/estimate rather than official bill.
 */
export function estimateBillAmount(units: number, isProtected = true): {
  baseCost: number;
  electricityDuty: number;
  tvFee: number;
  gst: number;
  totalEstimated: number;
  isPenaltyZone: boolean;
} {
  const rule = (isProtected && units <= 200) ? LESCO_PROTECTED_TARIFF : LESCO_UNPROTECTED_TARIFF;
  const isPenaltyZone = units > 200;

  let baseCost = 0;
  let remainingUnits = Math.max(0, units);

  for (const slab of rule.slabs) {
    if (remainingUnits <= 0) break;
    const slabSpan = slab.max - slab.min + 1;
    const unitsInThisSlab = Math.min(remainingUnits, slabSpan);
    baseCost += unitsInThisSlab * slab.baseRatePerUnit;
    remainingUnits -= unitsInThisSlab;
  }

  const electricityDuty = Math.round(baseCost * rule.electricityDutyRate);
  const tvFee = rule.tvFee;
  const gst = isPenaltyZone ? Math.round((baseCost + electricityDuty) * rule.gstRate) : 0;
  const totalEstimated = Math.round(baseCost + electricityDuty + tvFee + gst + rule.fixedCharges);

  return {
    baseCost: Math.round(baseCost),
    electricityDuty,
    tvFee,
    gst,
    totalEstimated,
    isPenaltyZone,
  };
}

export function getDefaultBillCharges(): BillCharges {
  return {
    tariffRatePerUnit: 7.74,
    electricityDuty: 35,
    tvFee: 35,
    fca: 120,
    gst: 0,
    fpa: 0,
    otherCharges: 0,
  };
}
