import { describe, expect, it } from 'vitest';
import { calculateConsumption } from '../engine/calculations';
import { BillingCycle, Household, Meter, MeterLifecycleEvent, MeterReading } from '../types';
import { validateBillingCycleMutation, validateReadingMutation } from './validation';

const household: Household = {
  id: 'household-1',
  name: 'Test household',
  provider: 'LESCO',
  referenceNumber: 'reference',
  trackingMode: 'indoor_cumulative',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const meter: Meter = {
  id: 'meter-1',
  householdId: household.id,
  name: 'Test meter',
  type: 'indoor_cumulative_protector',
  unit: 'kWh',
  isIndoorResetSupported: true,
  isActive: true,
};

const cycle: BillingCycle = {
  id: 'cycle-1',
  householdId: household.id,
  provider: 'LESCO',
  tariffCategory: 'domestic_protected',
  billingPeriodStart: '2026-01-01',
  billingPeriodEnd: '2026-01-31',
  officialReadingDate: '2026-01-01',
  previousOfficialReading: 100,
  currentOfficialReading: 120,
  billedUnits: 20,
  billAmount: 1000,
  status: 'active',
  applicableCharges: { tariffRatePerUnit: 1, electricityDuty: 0, tvFee: 0, fca: 0, gst: 0, fpa: 0, otherCharges: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const reading = (id: string, value: number, timestamp: string, overrides: Partial<MeterReading> = {}): MeterReading => ({
  id,
  cycleId: cycle.id,
  meterId: meter.id,
  householdId: household.id,
  cumulativeKWh: value,
  reading_timestamp: timestamp,
  entry_timestamp: timestamp,
  source: 'indoor_meter',
  validationStatus: 'valid',
  ...overrides,
});

const context = (existingReadings: MeterReading[], lifecycleEvents: MeterLifecycleEvent[] = []) => ({
  household,
  meter,
  cycle,
  existingReadings,
  lifecycleEvents,
  now: '2026-01-10T00:00:00.000Z',
});

describe('domain validation', () => {
  it('accepts valid increasing readings', () => {
    const result = validateReadingMutation(reading('r2', 110, '2026-01-02T00:00:00.000Z'), context([reading('r1', 100, '2026-01-01T00:00:00.000Z')]));
    expect(result.isValid).toBe(true);
  });

  it('blocks decreasing readings instead of converting them to zero usage', () => {
    const result = validateReadingMutation(reading('r2', 140, '2026-01-02T00:00:00.000Z'), context([reading('r1', 150, '2026-01-01T00:00:00.000Z')]));
    expect(result.issues[0]?.code).toBe('decreasing_reading');
  });

  it('allows a reset baseline with a reset event', () => {
    const result = validateReadingMutation(reading('r2', 0, '2026-01-02T00:00:00.000Z', { isBaseline: true }), context(
      [reading('r1', 150, '2026-01-01T00:00:00.000Z')],
      [{ id: 'event-1', meterId: meter.id, householdId: household.id, type: 'reset', occurredAt: '2026-01-02T00:00:00.000Z', baselineReading: 0, createdAt: '2026-01-02T00:00:00.000Z' }],
    ));
    expect(result.isValid).toBe(true);
  });

  it('allows the first baseline of a replacement meter', () => {
    const replacement: Meter = { ...meter, id: 'meter-2', serialNumber: 'replacement' };
    const result = validateReadingMutation({ ...reading('r2', 0, '2026-01-02T00:00:00.000Z'), meterId: replacement.id, isBaseline: true }, { ...context([]), meter: replacement });
    expect(result.isValid).toBe(true);
  });

  it('blocks duplicate readings', () => {
    const existing = reading('r1', 100, '2026-01-01T00:00:00.000Z');
    const result = validateReadingMutation(reading('r2', 100, '2026-01-01T00:00:00.000Z'), context([existing]));
    expect(result.issues[0]?.code).toBe('duplicate_reading');
  });

  it('blocks cross-household and cross-cycle relationships', () => {
    const result = validateReadingMutation(reading('r2', 110, '2026-01-02T00:00:00.000Z', { householdId: 'other-household', cycleId: 'other-cycle' }), context([]));
    expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining(['wrong_household_relationship', 'invalid_cycle_relationship']));
  });

  it('blocks overlapping cycles and invalid billing readings', () => {
    const overlapping = { ...cycle, id: 'cycle-2', billingPeriodStart: '2026-01-15', billingPeriodEnd: '2026-02-15', officialReadingDate: '2026-01-15', currentOfficialReading: 90 };
    const result = validateBillingCycleMutation(overlapping, [cycle], household);
    expect(result.issues[0]?.code).toBe('invalid_billing_reading');
    expect(result.issues.map((item) => item.code)).toContain('overlapping_cycle');
  });
});

describe('deterministic consumption', () => {
  it('calculates increasing usage', () => {
    const result = calculateConsumption([reading('r1', 100, '2026-01-01T00:00:00.000Z'), reading('r2', 110, '2026-01-02T00:00:00.000Z')]);
    expect(result.isValid).toBe(true);
    expect(result.totalTrackedUnits).toBe(10);
  });

  it('does not silently turn invalid usage into zero', () => {
    const result = calculateConsumption([reading('r1', 150, '2026-01-01T00:00:00.000Z'), reading('r2', 140, '2026-01-02T00:00:00.000Z')]);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('keeps meters and cycles isolated', () => {
    const otherMeter = reading('r3', 500, '2026-01-01T12:00:00.000Z', { meterId: 'meter-2' });
    const result = calculateConsumption([reading('r1', 150, '2026-01-01T00:00:00.000Z'), otherMeter, reading('r2', 160, '2026-01-02T00:00:00.000Z')]);
    expect(result.isValid).toBe(true);
    expect(result.totalTrackedUnits).toBe(10);
  });
});
