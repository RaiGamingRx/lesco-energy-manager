import { BillingCycle, Household, Meter, MeterLifecycleEvent, MeterReading, ValidationStatus } from '../types';

export type DomainValidationCode =
  | 'negative_reading'
  | 'invalid_timestamp'
  | 'future_physical_timestamp'
  | 'decreasing_reading'
  | 'duplicate_reading'
  | 'wrong_meter_relationship'
  | 'wrong_household_relationship'
  | 'invalid_cycle_relationship'
  | 'invalid_cycle_period'
  | 'overlapping_cycle'
  | 'invalid_billing_reading'
  | 'billed_units_mismatch';

export interface DomainValidationIssue {
  code: DomainValidationCode;
  message: string;
  blocking: boolean;
}

export interface DomainValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  issues: DomainValidationIssue[];
  message?: string;
  isFatal: boolean;
}

const validDate = (value: string): boolean => Boolean(value) && Number.isFinite(Date.parse(value));
const issue = (code: DomainValidationCode, message: string): DomainValidationIssue => ({ code, message, blocking: true });

export interface ReadingValidationContext {
  household: Household;
  meter: Meter;
  cycle: BillingCycle;
  existingReadings: MeterReading[];
  lifecycleEvents?: MeterLifecycleEvent[];
  currentReadingId?: string;
  now?: string;
}

export function validateReadingMutation(reading: MeterReading, context: ReadingValidationContext): DomainValidationResult {
  const issues: DomainValidationIssue[] = [];
  const readingTime = Date.parse(reading.reading_timestamp);
  const now = Date.parse(context.now ?? new Date().toISOString());

  if (!Number.isFinite(reading.cumulativeKWh) || reading.cumulativeKWh < 0) issues.push(issue('negative_reading', 'Meter reading cannot be negative or non-numeric.'));
  if (!validDate(reading.reading_timestamp) || !validDate(reading.entry_timestamp)) issues.push(issue('invalid_timestamp', 'Physical and app entry timestamps must be valid dates.'));
  if (Number.isFinite(readingTime) && readingTime > now) issues.push(issue('future_physical_timestamp', 'Physical reading timestamp cannot be in the future.'));
  if (reading.householdId !== context.household.id) issues.push(issue('wrong_household_relationship', 'Reading belongs to a different household.'));
  if (reading.meterId !== context.meter.id || context.meter.householdId !== context.household.id) issues.push(issue('wrong_meter_relationship', 'Reading is not attached to the selected household meter.'));
  if (reading.cycleId !== context.cycle.id || context.cycle.householdId !== context.household.id) issues.push(issue('invalid_cycle_relationship', 'Reading is not attached to the selected household billing cycle.'));

  const others = context.existingReadings
    .filter((candidate) => candidate.id !== context.currentReadingId && candidate.meterId === reading.meterId && candidate.cycleId === reading.cycleId)
    .sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
  if (others.some((candidate) => candidate.reading_timestamp === reading.reading_timestamp && candidate.cumulativeKWh === reading.cumulativeKWh)) {
    issues.push(issue('duplicate_reading', 'An identical reading already exists for this meter.'));
  }

  const previous = [...others].reverse().find((candidate) => Date.parse(candidate.reading_timestamp) <= readingTime);
  const hasResetEvent = (context.lifecycleEvents ?? []).some((event) =>
    (event.type === 'reset' || event.type === 'replaced' || event.type === 'rollover') &&
    event.meterId === reading.meterId && Date.parse(event.occurredAt) <= readingTime &&
    (!event.baselineReading || event.baselineReading === reading.cumulativeKWh)
  );
  if (previous && reading.cumulativeKWh < previous.cumulativeKWh && !hasResetEvent && !reading.isBaseline) {
    issues.push(issue('decreasing_reading', `Reading decreased from ${previous.cumulativeKWh} kWh without a meter lifecycle event.`));
  }

  return resultFromIssues(issues);
}

export function validateBillingCycleMutation(cycle: BillingCycle, existingCycles: BillingCycle[], household: Household, connectionId?: string): DomainValidationResult {
  const issues: DomainValidationIssue[] = [];
  const start = Date.parse(cycle.billingPeriodStart);
  const end = Date.parse(cycle.billingPeriodEnd);
  const officialDate = Date.parse(cycle.officialReadingDate);
  if (!validDate(cycle.billingPeriodStart) || !validDate(cycle.billingPeriodEnd) || start >= end) issues.push(issue('invalid_cycle_period', 'Billing cycle start must be before its end.'));
  if (!validDate(cycle.officialReadingDate) || officialDate < start || officialDate > end) issues.push(issue('invalid_cycle_period', 'Official reading date must fall within the billing period.'));
  if (cycle.householdId !== household.id || (connectionId && cycle.connectionId && cycle.connectionId !== connectionId)) issues.push(issue('invalid_cycle_relationship', 'Billing cycle belongs to a different household or connection.'));
  if (cycle.previousOfficialReading < 0 || cycle.currentOfficialReading < 0 || cycle.currentOfficialReading < cycle.previousOfficialReading) issues.push(issue('invalid_billing_reading', 'Official readings must be non-negative and current reading must not be lower than previous reading.'));
  if (cycle.billedUnits < 0 || Math.abs((cycle.currentOfficialReading - cycle.previousOfficialReading) - cycle.billedUnits) > 1) issues.push(issue('billed_units_mismatch', 'Billed units must reconcile with the official reading difference.'));
  const others = existingCycles.filter((candidate) => candidate.id !== cycle.id && candidate.householdId === cycle.householdId);
  if (others.some((candidate) => Date.parse(cycle.billingPeriodStart) < Date.parse(candidate.billingPeriodEnd) && Date.parse(candidate.billingPeriodStart) < Date.parse(cycle.billingPeriodEnd))) issues.push(issue('overlapping_cycle', 'Billing periods cannot overlap for a household.'));
  return resultFromIssues(issues);
}

function resultFromIssues(issues: DomainValidationIssue[]): DomainValidationResult {
  return { isValid: issues.length === 0, status: issues.length === 0 ? 'valid' : 'error', issues, message: issues[0]?.message, isFatal: issues.length > 0 };
}