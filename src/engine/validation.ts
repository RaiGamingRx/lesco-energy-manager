import { validateBillingCycleMutation, validateReadingMutation } from '../domain/validation';
import { BillingCycle, Household, Meter, MeterReading, ReadingSource, ValidationStatus } from '../types';

export interface ValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  message?: string;
  isFatal: boolean;
}

export interface ReadingPreviewContext {
  household: Household;
  meter: Meter;
  cycle: BillingCycle;
  now?: string;
}

function toResult(result: { isValid: boolean; status: ValidationStatus; message?: string; isFatal: boolean }): ValidationResult {
  return { isValid: result.isValid, status: result.status, message: result.message, isFatal: result.isFatal };
}

/** Compatibility preview adapter. Repository mutations remain authoritative. */
export function validateMeterReading(
  newReading: { cumulativeKWh: number; reading_timestamp: string; entry_timestamp?: string; source: string },
  existingReadings: MeterReading[],
  currentReadingId?: string,
  context?: ReadingPreviewContext,
): ValidationResult {
  const household = context?.household || {
    id: existingReadings[0]?.householdId || 'preview-household', name: 'Preview', provider: 'LESCO' as const,
    referenceNumber: 'preview', trackingMode: 'indoor_cumulative' as const, createdAt: new Date(0).toISOString(),
  };
  const meter = context?.meter || {
    id: existingReadings[0]?.meterId || 'preview-meter', householdId: household.id, connectionId: 'preview-connection', name: 'Preview meter',
    type: 'manual_counter' as const, unit: 'kWh' as const, isIndoorResetSupported: false,
  };
  const cycle = context?.cycle || {
    id: existingReadings[0]?.cycleId || 'preview-cycle', householdId: household.id, provider: 'LESCO' as const,
    connectionId: meter.connectionId, meterId: meter.id,
    tariffCategory: 'domestic_protected' as const, billingPeriodStart: '1970-01-01', billingPeriodEnd: '2999-12-31',
    officialReadingDate: '1970-01-01', previousOfficialReading: 0, currentOfficialReading: 0, billedUnits: 0, billAmount: 0,
    status: 'active' as const, applicableCharges: { tariffRatePerUnit: 0, electricityDuty: 0, tvFee: 0, fca: 0, gst: 0, fpa: 0, otherCharges: 0 },
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  };
  const source: ReadingSource = newReading.source === 'outdoor_meter' || newReading.source === 'manual' ? newReading.source : 'indoor_meter';
  const result = validateReadingMutation({
    id: '__preview__', cycleId: cycle.id, meterId: meter.id, householdId: household.id, connectionId: meter.connectionId,
    cumulativeKWh: newReading.cumulativeKWh, reading_timestamp: newReading.reading_timestamp,
    entry_timestamp: newReading.entry_timestamp || new Date().toISOString(), source, validationStatus: 'valid',
  }, { household, meter, cycle, existingReadings, currentReadingId, now: context?.now });
  return toResult(result);
}

export function validateOutdoorSync(outdoorReading: number, billCurrentReading: number): ValidationResult {
  if (!Number.isFinite(outdoorReading) || outdoorReading < 0 || outdoorReading < billCurrentReading) {
    return { isValid: false, status: 'error', message: 'Outdoor meter reading must be valid and cannot be below the official bill reading.', isFatal: true };
  }
  if (outdoorReading - billCurrentReading > 80) {
    return { isValid: true, status: 'warning', message: `Unusually large gap detected (${(outdoorReading - billCurrentReading).toFixed(1)} kWh).`, isFatal: false };
  }
  return { isValid: true, status: 'valid', isFatal: false };
}

export function validateBillingCycle(newCycle: Partial<BillingCycle>, existingCycles: BillingCycle[], household?: Household, currentCycleId?: string): ValidationResult {
  const candidate: BillingCycle = {
    id: newCycle.id || '__preview-cycle__', householdId: newCycle.householdId || household?.id || 'preview-household',
    connectionId: newCycle.connectionId || household?.connectionIds?.[0] || 'preview-connection', meterId: newCycle.meterId || 'preview-meter',
    provider: newCycle.provider || household?.provider || 'LESCO', tariffCategory: newCycle.tariffCategory || 'domestic_protected',
    billingPeriodStart: newCycle.billingPeriodStart || '', billingPeriodEnd: newCycle.billingPeriodEnd || '',
    officialReadingDate: newCycle.officialReadingDate || '', previousOfficialReading: newCycle.previousOfficialReading ?? -1,
    currentOfficialReading: newCycle.currentOfficialReading ?? -1, billedUnits: newCycle.billedUnits ?? -1, billAmount: newCycle.billAmount ?? -1,
    status: newCycle.status || 'draft', applicableCharges: newCycle.applicableCharges || { tariffRatePerUnit: 0, electricityDuty: 0, tvFee: 0, fca: 0, gst: 0, fpa: 0, otherCharges: 0 },
    createdAt: newCycle.createdAt || new Date(0).toISOString(), updatedAt: newCycle.updatedAt || new Date(0).toISOString(),
  };
  const owner = household || { id: candidate.householdId, name: 'Preview', provider: candidate.provider, referenceNumber: 'preview', trackingMode: 'indoor_cumulative', createdAt: new Date(0).toISOString() };
  const result = validateBillingCycleMutation(candidate, existingCycles.filter((cycle) => cycle.id !== currentCycleId), owner);
  return toResult(result);
}
