import { describe, expect, it } from 'vitest';
import { BillingCycle, MeterLifecycleEvent, MeterReading } from '../types';
import { calculateCycleResult, calculateMeterConsumption } from './calculations';

const scope = { householdId: 'household-1', meterId: 'meter-1', cycleId: 'cycle-1' };
const reading = (id: string, value: number, timestamp: string, overrides: Partial<MeterReading> = {}): MeterReading => ({
  id,
  ...scope,
  connectionId: 'connection-1',
  cumulativeKWh: value,
  reading_timestamp: timestamp,
  entry_timestamp: timestamp,
  source: 'indoor_meter',
  validationStatus: 'valid',
  ...overrides,
});
const cycle: BillingCycle = {
  id: 'cycle-1', householdId: 'household-1', provider: 'LESCO', tariffCategory: 'domestic_protected',
  connectionId: 'connection-1', meterId: 'meter-1',
  billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31', officialReadingDate: '2026-01-01',
  previousOfficialReading: 10000, currentOfficialReading: 10000, billedUnits: 0, billAmount: 0, status: 'active',
  applicableCharges: { tariffRatePerUnit: 0, electricityDuty: 0, tvFee: 0, fca: 0, gst: 0, fpa: 0, otherCharges: 0 },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2099-01-01T00:00:00.000Z',
};
const options = { asOf: '2026-01-31T00:00:00.000Z', scope };

describe('authoritative calculation engine', () => {
  it('calculates cumulative consumption and explains every interval', () => {
    const result = calculateMeterConsumption([
      reading('r1', 10204, '2026-01-01T00:00:00.000Z'), reading('r2', 10220, '2026-01-02T00:00:00.000Z'),
      reading('r3', 10250, '2026-01-03T00:00:00.000Z'), reading('r4', 10280, '2026-01-04T00:00:00.000Z'),
    ], options);
    expect(result.actualConsumptionKwh).toBe(76);
    expect(result.intervals.map((item) => item.consumptionKwh)).toEqual([16, 30, 30]);
    expect(result.dataQuality).toBe('VALID');
  });

  it('uses physical chronology and does not mutate input order', () => {
    const readings = [reading('r3', 10250, '2026-01-03T00:00:00.000Z'), reading('r1', 10204, '2026-01-01T00:00:00.000Z'), reading('r2', 10220, '2026-01-02T00:00:00.000Z')];
    const original = readings.map((item) => item.id);
    expect(calculateMeterConsumption(readings, options).actualConsumptionKwh).toBe(46);
    expect(readings.map((item) => item.id)).toEqual(original);
  });

  it('deduplicates identical observations and conflicts differing observations', () => {
    const duplicate = calculateMeterConsumption([reading('r1', 100, '2026-01-01T00:00:00.000Z'), reading('r1-copy', 100, '2026-01-01T00:00:00.000Z'), reading('r2', 110, '2026-01-02T00:00:00.000Z')], options);
    expect(duplicate.actualConsumptionKwh).toBe(10);
    expect(duplicate.anomalies.map((item) => item.code)).toContain('DUPLICATE_OBSERVATION');
    const conflict = calculateMeterConsumption([reading('r1', 100, '2026-01-01T00:00:00.000Z'), reading('r2', 101, '2026-01-01T00:00:00.000Z'), reading('r3', 110, '2026-01-02T00:00:00.000Z')], options);
    expect(conflict.dataQuality).toBe('CONFLICTED');
    expect(conflict.anomalies.map((item) => item.code)).toContain('CONFLICTING_SAME_TIME_OBSERVATION');
  });

  it('rejects decreasing values, forged baselines, and unsupported rollover', () => {
    const decreasing = calculateMeterConsumption([reading('r1', 150, '2026-01-01T00:00:00.000Z'), reading('r2', 140, '2026-01-02T00:00:00.000Z')], options);
    expect(decreasing.actualConsumptionKwh).toBe(0);
    expect(decreasing.dataQuality).toBe('INVALID');
    const forged = calculateMeterConsumption([reading('r1', 150, '2026-01-01T00:00:00.000Z'), reading('r2', 20, '2026-01-02T00:00:00.000Z', { isBaseline: true })], options);
    expect(forged.anomalies.map((item) => item.code)).toContain('UNAUTHORIZED_BASELINE');
    const rollover: MeterLifecycleEvent = { id: 'rollover-1', meterId: 'meter-1', connectionId: 'connection-1', householdId: 'household-1', type: 'rollover', occurredAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z' };
    expect(calculateMeterConsumption([reading('r1', 999, '2026-01-01T00:00:00.000Z'), reading('r2', 1, '2026-01-02T00:00:00.000Z')], { ...options, lifecycleEvents: [rollover] }).dataQuality).toBe('UNSUPPORTED');
  });

  it('creates an authorized lifecycle boundary without negative contamination', () => {
    const event: MeterLifecycleEvent = { id: 'reset-1', meterId: 'meter-1', connectionId: 'connection-1', householdId: 'household-1', type: 'reset', occurredAt: '2026-01-02T00:00:00.000Z', baselineReading: 20, createdAt: '2026-01-02T00:00:00.000Z' };
    const result = calculateMeterConsumption([
      reading('r1', 150, '2026-01-01T00:00:00.000Z'), reading('r2', 20, '2026-01-02T00:00:00.000Z', { isBaseline: true, lifecycleEventId: event.id }), reading('r3', 30, '2026-01-03T00:00:00.000Z'),
    ], { ...options, lifecycleEvents: [event] });
    expect(result.actualConsumptionKwh).toBe(10);
    expect(result.intervals.some((item) => item.status === 'BOUNDARY')).toBe(true);
    expect(result.anomalies.map((item) => item.code)).toContain('LIFECYCLE_TRANSITION_BOUNDARY');
  });

  it('keeps invalid sequences partial rather than summing across the gap', () => {
    const result = calculateMeterConsumption([reading('r1', 100, '2026-01-01T00:00:00.000Z'), reading('r2', 90, '2026-01-05T00:00:00.000Z'), reading('r3', 110, '2026-01-10T00:00:00.000Z'), reading('r4', 120, '2026-01-15T00:00:00.000Z')], options);
    expect(result.actualConsumptionKwh).toBe(10);
    expect(result.dataQuality).toBe('PARTIAL');
    expect(result.anomalies.map((item) => item.code)).toContain('INCOMPLETE_INTERVAL_SEQUENCE');
  });

  it('calculates physical rate and explicit cycle time without using updatedAt', () => {
    const result = calculateCycleResult(cycle, [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 100, '2026-01-11T00:00:00.000Z')], { ...options, asOf: '2026-01-21T00:00:00.000Z', targetKwh: 200 });
    expect(result.actualConsumptionKwh).toBe(100);
    expect(result.observedRateKwhPerDay).toBe(10);
    expect(result.elapsedCycleDays).toBe(20);
    expect(result.remainingCycleDays).toBe(11);
    expect(result.projectedEndCycleKwh).toBe(210);
  });

  it('changes projections with asOf while preserving actual history', () => {
    const readings = [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 100, '2026-01-11T00:00:00.000Z')];
    const early = calculateCycleResult(cycle, readings, { ...options, asOf: '2026-01-11T00:00:00.000Z', targetKwh: 200 });
    const late = calculateCycleResult(cycle, readings, { ...options, asOf: '2026-01-21T00:00:00.000Z', targetKwh: 200 });
    expect(early.actualConsumptionKwh).toBe(late.actualConsumptionKwh);
    expect(early.projectedEndCycleKwh).toBeGreaterThan(late.projectedEndCycleKwh!);
  });

  it('excludes physical readings after asOf while including the exact boundary', () => {
    const readings = [
      reading('r1', 0, '2026-01-01T00:00:00.000Z'),
      reading('r2', 100, '2026-01-10T00:00:00.000Z'),
      reading('r3', 150, '2026-01-20T00:00:00.000Z'),
    ];
    const atBoundary = calculateMeterConsumption(readings, { ...options, asOf: '2026-01-10T00:00:00.000Z' });
    const after = calculateMeterConsumption(readings, { ...options, asOf: '2026-01-21T00:00:00.000Z' });
    expect(atBoundary.actualConsumptionKwh).toBe(100);
    expect(atBoundary.currentCumulativeKwh).toBe(100);
    expect(after.actualConsumptionKwh).toBe(150);
  });

  it('excludes lifecycle events after asOf from historical quality and totals', () => {
    const rolloverAfterAsOf: MeterLifecycleEvent = {
      id: 'rollover-after-as-of', meterId: 'meter-1', connectionId: 'connection-1', householdId: 'household-1',
      type: 'rollover', occurredAt: '2026-01-20T00:00:00.000Z', createdAt: '2026-01-20T00:00:00.000Z',
    };
    const historical = calculateMeterConsumption([
      reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 100, '2026-01-10T00:00:00.000Z'),
    ], { ...options, asOf: '2026-01-10T00:00:00.000Z', lifecycleEvents: [rolloverAfterAsOf] });
    expect(historical.actualConsumptionKwh).toBe(100);
    expect(historical.dataQuality).toBe('VALID');
    expect(historical.anomalies.map((item) => item.code)).not.toContain('UNSUPPORTED_ROLLOVER');
  });

  it('treats timezone-equivalent physical timestamps as one instant', () => {
    const result = calculateMeterConsumption([
      reading('r1', 100, '2026-01-01T00:00:00.000Z'),
      reading('r2', 100, '2026-01-01T05:00:00.000+05:00'),
      reading('r3', 110, '2026-01-02T00:00:00.000Z'),
    ], options);
    expect(result.anomalies.map((item) => item.code)).toContain('DUPLICATE_OBSERVATION');
    expect(result.actualConsumptionKwh).toBe(10);
  });

  it('does not let a later physical reading change a historical projection', () => {
    const beforeLaterReading = [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 100, '2026-01-10T00:00:00.000Z')];
    const withLaterReading = [...beforeLaterReading, reading('r3', 300, '2026-01-20T00:00:00.000Z')];
    const historical = { ...options, asOf: '2026-01-10T00:00:00.000Z', targetKwh: 200 };
    expect(calculateCycleResult(cycle, beforeLaterReading, historical)).toEqual(calculateCycleResult(cycle, withLaterReading, historical));
  });

  it('separates target progress, remaining target, overrun, and zero-target behavior', () => {
    const under = calculateCycleResult(cycle, [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 150, '2026-01-11T00:00:00.000Z')], { ...options, targetKwh: 200 });
    expect(under.targetProgressPercent).toBe(75);
    expect(under.remainingTargetKwh).toBe(50);
    expect(under.targetOverrunKwh).toBe(0);
    const over = calculateCycleResult(cycle, [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 220, '2026-01-11T00:00:00.000Z')], { ...options, targetKwh: 200 });
    expect(over.remainingTargetKwh).toBe(0);
    expect(over.targetOverrunKwh).toBe(20);
    expect(calculateCycleResult(cycle, [reading('r1', 0, '2026-01-01T00:00:00.000Z'), reading('r2', 10, '2026-01-11T00:00:00.000Z')], { ...options, targetKwh: 0 }).targetProgressPercent).toBeUndefined();
  });

  it('isolates entities and reports insufficient data without fabricated rate', () => {
    const other = reading('other', 900, '2026-01-01T00:00:00.000Z', { householdId: 'household-2', meterId: 'meter-2', cycleId: 'cycle-2' });
    const result = calculateMeterConsumption([reading('r1', 10, '2026-01-01T00:00:00.000Z'), other], options);
    expect(result.actualConsumptionKwh).toBe(0);
    expect(result.anomalies.map((item) => item.code)).toContain('CROSS_ENTITY_CONTAMINATION');
    const one = calculateMeterConsumption([reading('r1', 10, '2026-01-01T00:00:00.000Z')], options);
    expect(one.dataQuality).toBe('INSUFFICIENT_DATA');
    expect(one.observedRateKwhPerDay).toBeUndefined();
  });
});