import { describe, expect, it } from 'vitest';
import { calculateConsumption } from '../engine/calculations';
import { BillingCycle, Household, Meter, MeterLifecycleEvent, MeterReading } from '../types';
import { validateBillingCycleMutation, validateReadingMutation, validateStateIntegrity } from './validation';
import { estimateBillAmount } from '../engine/tariffs';

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
  connectionId: 'connection-1',
  name: 'Test meter',
  type: 'indoor_cumulative_protector',
  unit: 'kWh',
  isIndoorResetSupported: true,
  isActive: true,
};

const cycle: BillingCycle = {
  id: 'cycle-1',
  householdId: household.id,
  connectionId: 'connection-1',
  meterId: meter.id,
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
  connectionId: meter.connectionId,
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
    const result = validateReadingMutation(reading('r2', 0, '2026-01-02T00:00:00.000Z', { isBaseline: true, lifecycleEventId: 'event-1' }), context(
      [reading('r1', 150, '2026-01-01T00:00:00.000Z')],
      [{ id: 'event-1', meterId: meter.id, connectionId: meter.connectionId, householdId: household.id, type: 'reset', occurredAt: '2026-01-02T00:00:00.000Z', baselineReading: 0, createdAt: '2026-01-02T00:00:00.000Z' }],
    ));
    expect(result.isValid).toBe(true);
  });

  it('allows the first baseline of a replacement meter', () => {
    const replacement: Meter = { ...meter, id: 'meter-2', serialNumber: 'replacement' };
    const result = validateReadingMutation({ ...reading('r2', 0, '2026-01-02T00:00:00.000Z'), meterId: replacement.id, isBaseline: true }, { ...context([]), meter: replacement });
    expect(result.issues.map((item) => item.code)).toContain('baseline_without_lifecycle');
  });

  it('blocks duplicate readings', () => {
    const existing = reading('r1', 100, '2026-01-01T00:00:00.000Z');
    const result = validateReadingMutation(reading('r2', 100, '2026-01-01T00:00:00.000Z'), context([existing]));
    expect(result.issues[0]?.code).toBe('duplicate_reading');
  });

  it('blocks same-time conflicting readings', () => {
    const existing = reading('r1', 100, '2026-01-01T00:00:00.000Z');
    const result = validateReadingMutation(reading('r2', 101, existing.reading_timestamp), context([existing]));
    expect(result.issues[0]?.code).toBe('same_timestamp_conflict');
  });

  it('checks both chronological neighbors for out-of-order insertion', () => {
    const result = validateReadingMutation(reading('middle', 105, '2026-01-03T00:00:00.000Z'), context([
      reading('first', 100, '2026-01-01T00:00:00.000Z'), reading('last', 110, '2026-01-05T00:00:00.000Z'),
    ]));
    expect(result.isValid).toBe(true);
    const decrease = validateReadingMutation(reading('middle', 115, '2026-01-03T00:00:00.000Z'), context([
      reading('first', 100, '2026-01-01T00:00:00.000Z'), reading('last', 110, '2026-01-05T00:00:00.000Z'),
    ]));
    expect(decrease.issues.map((item) => item.code)).toContain('decreasing_reading');
  });

  it('does not accept a baseline boolean without an authorized event', () => {
    const result = validateReadingMutation(reading('r2', 0, '2026-01-02T00:00:00.000Z', { isBaseline: true }), context([reading('r1', 150, '2026-01-01T00:00:00.000Z')]));
    expect(result.issues[0]?.code).toBe('baseline_without_lifecycle');
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

  it('requires replacement events to identify a distinct previous meter', () => {
    const replacement = { ...meter, id: 'meter-2', serialNumber: 'replacement' };
    const state = {
      accounts: [], memberships: [], settings: { householdName: household.name, provider: household.provider, tariffCategory: 'domestic_protected' as const, trackingMode: household.trackingMode, referenceNumber: household.referenceNumber, officialThreshold: 200, personalTarget: 190, cautionThreshold: 180, criticalThreshold: 190, preferredReadingTime: '18:00', readingFrequency: 'daily' as const, notificationsEnabled: false, theme: 'light' as const },
      household, connections: [{ id: 'connection-1', householdId: household.id, provider: 'LESCO' as const, referenceNumber: 'reference', createdAt: household.createdAt, isActive: true }], meters: [meter, replacement], cycles: [cycle], bills: [], readings: [], lifecycleEvents: [{ id: 'replacement-1', meterId: replacement.id, connectionId: replacement.connectionId, householdId: household.id, type: 'replaced' as const, previousMeterId: meter.id, occurredAt: '2026-01-02T00:00:00.000Z', baselineReading: 0, createdAt: '2026-01-02T00:00:00.000Z' }], auditLogs: [],
    };
    expect(validateStateIntegrity(state).isValid).toBe(true);
    expect(validateStateIntegrity({ ...state, lifecycleEvents: [{ ...state.lifecycleEvents[0], previousMeterId: replacement.id }] }).issues.map((item) => item.code)).toContain('invalid_lifecycle_relationship');
  });

  it('marks tariff output as an estimate and never as regulatory truth', () => {
    const estimate = estimateBillAmount(200, true);
    expect(estimate.authority).toBe('prototype_estimate');
    expect(estimate.regulatoryStatus).toBe('unverified');
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

  it('does not let a baseline flag contaminate totals with a negative interval', () => {
    const result = calculateConsumption([
      reading('r1', 150, '2026-01-01T00:00:00.000Z'),
      reading('r2', 20, '2026-01-02T00:00:00.000Z', { isBaseline: true }),
    ]);
    expect(result.isValid).toBe(false);
    expect(result.totalTrackedUnits).toBe(0);
  });

  it('rejects state readings outside their cycle', () => {
    const state = {
      accounts: [], memberships: [], settings: { householdName: household.name, provider: household.provider, tariffCategory: 'domestic_protected' as const, trackingMode: household.trackingMode, referenceNumber: household.referenceNumber, officialThreshold: 200, personalTarget: 190, cautionThreshold: 180, criticalThreshold: 190, preferredReadingTime: '18:00', readingFrequency: 'daily' as const, notificationsEnabled: false, theme: 'light' as const },
      household,
      connections: [], meters: [meter], cycles: [cycle], bills: [], readings: [reading('outside', 101, '2025-12-31T23:00:00.000Z')], lifecycleEvents: [], auditLogs: [],
    };
    expect(validateStateIntegrity(state).issues.map((item) => item.code)).toContain('reading_outside_cycle');
  });
});
