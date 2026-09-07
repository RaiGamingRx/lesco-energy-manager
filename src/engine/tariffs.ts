import { BillCharges, TariffCategory, Provider } from '../types';

export interface TariffRule {
  id: string;
  version: string;
  provider: Provider;
  category: TariffCategory;
  effectiveFrom: string;
  effectiveTo?: string;
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
  sourceReference: string;
}

// Prototype/configuration data. It is not verified regulatory advice.
export const LESCO_PROTECTED_TARIFF: TariffRule = {
  id: 'lesco-domestic-protected-prototype',
  version: 'prototype-2024-07',
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
  sourceReference: 'Unverified prototype configuration; replace with an authoritative schedule.',
};

export const LESCO_UNPROTECTED_TARIFF: TariffRule = {
  id: 'lesco-domestic-unprotected-prototype',
  version: 'prototype-2024-07',
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
  sourceReference: 'Unverified prototype configuration; replace with an authoritative schedule.',
};

export interface TariffSelection {
  rule: TariffRule;
  regulatoryStatus: 'protected' | 'unprotected' | 'unknown';
}

export interface TariffEstimate {
  baseCost: number;
  electricityDuty: number;
  tvFee: number;
  gst: number;
  totalEstimated: number;
  isPenaltyZone: boolean;
  authority: 'prototype_estimate';
  regulatoryStatus: 'unverified';
  tariffVersion: string;
}

export function selectTariff(rule: TariffRule, regulatoryStatus: TariffSelection['regulatoryStatus']): TariffSelection {
  return { rule, regulatoryStatus };
}

/**
 * Calculates estimated official bill amount based on units and tariff rules.
 * Clearly separated as a projection/estimate rather than official bill.
 */
export function estimateBillAmount(units: number, isProtected = true): TariffEstimate {
  const rule = isProtected ? LESCO_PROTECTED_TARIFF : LESCO_UNPROTECTED_TARIFF;
  const isPenaltyZone = !isProtected;

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
    authority: 'prototype_estimate',
    regulatoryStatus: 'unverified',
    tariffVersion: rule.version,
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
