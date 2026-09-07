import { AppSettings, AuditRecord, BillingCycle, Household, LescoConnection, Meter, MeterLifecycleEvent, MeterReading, OfficialBill, ValidationStatus } from '../types';

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
  | 'billed_units_mismatch'
  | 'invalid_id' | 'duplicate_entity_id' | 'invalid_numeric_value'
  | 'invalid_connection_relationship' | 'reading_outside_cycle' | 'same_timestamp_conflict'
  | 'baseline_without_lifecycle' | 'invalid_lifecycle_relationship' | 'invalid_lifecycle_chronology'
  | 'unsupported_rollover' | 'invalid_bill_relationship' | 'multiple_active_cycles'
  | 'invalid_settings' | 'finalized_record_tampering';

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

export interface IntegrityState {
  settings: AppSettings;
  household: Household;
  connections: LescoConnection[];
  meters: Meter[];
  cycles: BillingCycle[];
  bills: OfficialBill[];
  readings: MeterReading[];
  lifecycleEvents: MeterLifecycleEvent[];
  auditLogs: AuditRecord[];
}

export function validateReadingMutation(reading: MeterReading, context: ReadingValidationContext): DomainValidationResult {
  const issues: DomainValidationIssue[] = [];
  const readingTime = Date.parse(reading.reading_timestamp);
  const now = Date.parse(context.now ?? new Date().toISOString());

  if (!Number.isFinite(reading.cumulativeKWh) || reading.cumulativeKWh < 0) issues.push(issue('negative_reading', 'Meter reading cannot be negative or non-numeric.'));
  if (!validDate(reading.reading_timestamp) || !validDate(reading.entry_timestamp)) issues.push(issue('invalid_timestamp', 'Physical and app entry timestamps must be valid dates.'));
  if (Number.isFinite(readingTime) && readingTime > now) issues.push(issue('future_physical_timestamp', 'Physical reading timestamp cannot be in the future.'));
  if (validDate(reading.entry_timestamp) && Date.parse(reading.entry_timestamp) > now) issues.push(issue('invalid_timestamp', 'Application entry timestamp cannot be in the future.'));
  if (reading.householdId !== context.household.id) issues.push(issue('wrong_household_relationship', 'Reading belongs to a different household.'));
  if (reading.meterId !== context.meter.id || context.meter.householdId !== context.household.id) issues.push(issue('wrong_meter_relationship', 'Reading is not attached to the selected household meter.'));
  if (reading.cycleId !== context.cycle.id || context.cycle.householdId !== context.household.id) issues.push(issue('invalid_cycle_relationship', 'Reading is not attached to the selected household billing cycle.'));
  if (!inCycle(reading.reading_timestamp, context.cycle)) issues.push(issue('reading_outside_cycle', 'Physical reading timestamp must fall within the billing cycle.'));

  const others = context.existingReadings
    .filter((candidate) => candidate.id !== context.currentReadingId && candidate.meterId === reading.meterId && candidate.cycleId === reading.cycleId)
    .sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
  if (others.some((candidate) => candidate.reading_timestamp === reading.reading_timestamp && candidate.cumulativeKWh === reading.cumulativeKWh)) {
    issues.push(issue('duplicate_reading', 'An identical reading already exists for this meter.'));
  }
  if (others.some((candidate) => candidate.reading_timestamp === reading.reading_timestamp && candidate.cumulativeKWh !== reading.cumulativeKWh)) {
    issues.push(issue('same_timestamp_conflict', 'A physical timestamp cannot contain conflicting cumulative values.'));
  }

  const previous = [...others].reverse().find((candidate) => Date.parse(candidate.reading_timestamp) < readingTime);
  const next = others.find((candidate) => Date.parse(candidate.reading_timestamp) > readingTime);
  const lifecycleEvent = reading.lifecycleEventId ? (context.lifecycleEvents ?? []).find((event) => event.id === reading.lifecycleEventId) : undefined;
  const hasAuthorizedDiscontinuity = Boolean(lifecycleEvent && (lifecycleEvent.type === 'reset' || lifecycleEvent.type === 'replaced') && lifecycleEvent.meterId === reading.meterId && lifecycleEvent.householdId === reading.householdId && Date.parse(lifecycleEvent.occurredAt) <= readingTime && lifecycleEvent.baselineReading === reading.cumulativeKWh);
  if (reading.isBaseline && !hasAuthorizedDiscontinuity) issues.push(issue('baseline_without_lifecycle', 'A baseline reading requires an explicit matching reset or replacement lifecycle event.'));
  if (lifecycleEvent && Date.parse(lifecycleEvent.occurredAt) > readingTime) issues.push(issue('invalid_lifecycle_chronology', 'The lifecycle event must occur before or at the baseline reading.'));
  if (previous && reading.cumulativeKWh < previous.cumulativeKWh && !hasAuthorizedDiscontinuity) {
    issues.push(issue('decreasing_reading', `Reading decreased from ${previous.cumulativeKWh} kWh without a meter lifecycle event.`));
  }
  if (next && reading.cumulativeKWh > next.cumulativeKWh && !hasAuthorizedDiscontinuity) issues.push(issue('decreasing_reading', `Reading is greater than its chronological successor (${next.cumulativeKWh} kWh).`));

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
  if (!Number.isFinite(cycle.previousOfficialReading) || !Number.isFinite(cycle.currentOfficialReading) || cycle.previousOfficialReading < 0 || cycle.currentOfficialReading < 0 || cycle.currentOfficialReading < cycle.previousOfficialReading) issues.push(issue('invalid_billing_reading', 'Official readings must be non-negative and current reading must not be lower than previous reading.'));
  if (!Number.isFinite(cycle.billedUnits) || cycle.billedUnits < 0 || Math.abs((cycle.currentOfficialReading - cycle.previousOfficialReading) - cycle.billedUnits) > 1) issues.push(issue('billed_units_mismatch', 'Billed units must reconcile with the official reading difference.'));
  const others = existingCycles.filter((candidate) => candidate.id !== cycle.id && candidate.householdId === cycle.householdId && (candidate.connectionId || '') === (cycle.connectionId || ''));
  if (others.some((candidate) => cycleStart(cycle) < cycleEndExclusive(candidate) && cycleStart(candidate) < cycleEndExclusive(cycle))) issues.push(issue('overlapping_cycle', 'Billing periods cannot overlap for the same billing stream.'));
  return resultFromIssues(issues);
}

function resultFromIssues(issues: DomainValidationIssue[]): DomainValidationResult {
  return { isValid: issues.length === 0, status: issues.length === 0 ? 'valid' : 'error', issues, message: issues[0]?.message, isFatal: issues.length > 0 };
}

const cycleStart = (cycle: BillingCycle): number => Date.parse(`${cycle.billingPeriodStart}T00:00:00.000Z`);
const cycleEndExclusive = (cycle: BillingCycle): number => Date.parse(`${cycle.billingPeriodEnd}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
const inCycle = (timestamp: string, cycle: BillingCycle): boolean => {
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time >= cycleStart(cycle) && time < cycleEndExclusive(cycle);
};

export function validateStateIntegrity(state: IntegrityState, now = new Date().toISOString()): DomainValidationResult {
  const issues: DomainValidationIssue[] = [];
  const add = (result: DomainValidationResult): void => { issues.push(...result.issues); };
  const collections: Array<[string, Array<{ id: string }>]> = [
    ['connections', state.connections], ['meters', state.meters], ['cycles', state.cycles], ['bills', state.bills],
    ['readings', state.readings], ['lifecycleEvents', state.lifecycleEvents], ['auditLogs', state.auditLogs],
  ];
  for (const [collection, records] of collections) {
    const ids = new Set<string>();
    for (const record of records) {
      if (!record.id) issues.push(issue('invalid_id', `${collection} contains a record without an ID.`));
      if (ids.has(record.id)) issues.push(issue('duplicate_entity_id', `Duplicate ID in ${collection}: ${record.id}.`));
      ids.add(record.id);
    }
  }
  const connectionIds = new Set(state.connections.map((connection) => connection.id));
  const meterIds = new Set(state.meters.map((meter) => meter.id));
  const cycleIds = new Set(state.cycles.map((cycle) => cycle.id));
  const lifecycleIds = new Set(state.lifecycleEvents.map((event) => event.id));
  if (!state.household.id || !state.settings.householdName || state.settings.provider !== state.household.provider || !Number.isFinite(state.settings.personalTarget) || state.settings.personalTarget < 0 || !Number.isFinite(state.settings.officialThreshold) || state.settings.officialThreshold < 0 || !Number.isFinite(state.settings.cautionThreshold) || state.settings.cautionThreshold < 0 || !Number.isFinite(state.settings.criticalThreshold) || state.settings.criticalThreshold < 0) issues.push(issue('invalid_settings', 'Domain-relevant settings contain invalid values.'));
  if (state.connections.some((connection) => connection.householdId !== state.household.id || connection.provider !== state.household.provider)) issues.push(issue('invalid_connection_relationship', 'Connection does not belong to the household.'));
  if (state.meters.some((meter) => meter.householdId !== state.household.id)) issues.push(issue('wrong_meter_relationship', 'Meter does not belong to the household.'));
  for (const cycle of state.cycles) {
    add(validateBillingCycleMutation(cycle, state.cycles, state.household));
    if (cycle.provider !== state.household.provider) issues.push(issue('invalid_cycle_relationship', `Cycle ${cycle.id} provider does not match the household.`));
    if (cycle.connectionId && !connectionIds.has(cycle.connectionId)) issues.push(issue('invalid_connection_relationship', `Cycle ${cycle.id} references a missing connection.`));
    if (cycle.status === 'active' && state.cycles.some((other) => other.id !== cycle.id && other.status === 'active' && other.householdId === cycle.householdId && (other.connectionId || '') === (cycle.connectionId || ''))) issues.push(issue('multiple_active_cycles', 'Only one active cycle is allowed per household billing stream.'));
  }
  for (const bill of state.bills) {
    if (bill.householdId !== state.household.id || !connectionIds.has(bill.connectionId) || !cycleIds.has(bill.billingCycleId)) issues.push(issue('invalid_bill_relationship', `Bill ${bill.id} has an invalid household, connection, or cycle relationship.`));
    if (!Number.isFinite(bill.previousReading) || !Number.isFinite(bill.currentReading) || !Number.isFinite(bill.billedUnits) || bill.previousReading < 0 || bill.currentReading < bill.previousReading || Math.abs((bill.currentReading - bill.previousReading) - bill.billedUnits) > 1) issues.push(issue('invalid_billing_reading', `Bill ${bill.id} contains irreconcilable official readings.`));
    const cycle = state.cycles.find((candidate) => candidate.id === bill.billingCycleId);
    if (cycle && (bill.provider !== cycle.provider || bill.previousReading !== cycle.previousOfficialReading || bill.currentReading !== cycle.currentOfficialReading || Math.abs(bill.billedUnits - cycle.billedUnits) > 1)) issues.push(issue('invalid_bill_relationship', `Bill ${bill.id} does not reconcile with its billing cycle.`));
  }
  for (const event of state.lifecycleEvents) {
    if (!meterIds.has(event.meterId) || event.householdId !== state.household.id || state.meters.find((meter) => meter.id === event.meterId)?.householdId !== event.householdId) issues.push(issue('invalid_lifecycle_relationship', `Lifecycle event ${event.id} has an invalid meter or household relationship.`));
    if (!validDate(event.occurredAt) || Date.parse(event.occurredAt) > Date.parse(now) || event.type === 'rollover') issues.push(issue(event.type === 'rollover' ? 'unsupported_rollover' : 'invalid_lifecycle_chronology', `Lifecycle event ${event.id} has an unsupported or impossible chronology.`));
    if (event.type === 'reset' || event.type === 'replaced') if (!Number.isFinite(event.baselineReading) || (event.baselineReading ?? -1) < 0) issues.push(issue('invalid_lifecycle_chronology', `Lifecycle event ${event.id} requires a non-negative baseline reading.`));
    if (event.previousMeterId && (!meterIds.has(event.previousMeterId) || state.meters.find((meter) => meter.id === event.previousMeterId)?.householdId !== event.householdId)) issues.push(issue('invalid_lifecycle_relationship', `Lifecycle event ${event.id} references an invalid previous meter.`));
  }
  for (const audit of state.auditLogs) {
    const entityIds = audit.entityType === 'meter_reading' ? state.readings.map((reading) => reading.id) : audit.entityType === 'billing_cycle' ? state.cycles.map((cycle) => cycle.id) : audit.entityType === 'meter_lifecycle_event' ? state.lifecycleEvents.map((event) => event.id) : ['global'];
    if (!entityIds.includes(audit.entityId) || !['create', 'edit', 'correction', 'lock', 'delete'].includes(audit.action)) issues.push(issue('invalid_id', `Audit record ${audit.id} references an invalid entity or action.`));
    if (!validDate(audit.timestamp) || Date.parse(audit.timestamp) > Date.parse(now)) issues.push(issue('invalid_timestamp', `Audit record ${audit.id} has an invalid or future timestamp.`));
  }
  for (const reading of state.readings) {
    const cycle = state.cycles.find((candidate) => candidate.id === reading.cycleId);
    const meter = state.meters.find((candidate) => candidate.id === reading.meterId);
    if (!cycle || !meter || reading.householdId !== state.household.id || meter.householdId !== reading.householdId || cycle.householdId !== reading.householdId) issues.push(issue('invalid_cycle_relationship', `Reading ${reading.id} has an invalid household, meter, or cycle relationship.`));
    if (!Number.isFinite(reading.cumulativeKWh) || reading.cumulativeKWh < 0) issues.push(issue('invalid_numeric_value', `Reading ${reading.id} has an invalid cumulative value.`));
    if (!validDate(reading.reading_timestamp) || !validDate(reading.entry_timestamp) || Date.parse(reading.reading_timestamp) > Date.parse(now)) issues.push(issue('invalid_timestamp', `Reading ${reading.id} has an invalid or future timestamp.`));
    if (cycle && !inCycle(reading.reading_timestamp, cycle)) issues.push(issue('reading_outside_cycle', `Reading ${reading.id} is outside its billing cycle.`));
    const sameStream = state.readings.filter((candidate) => candidate.id !== reading.id && candidate.meterId === reading.meterId && candidate.cycleId === reading.cycleId);
    if (reading.lifecycleEventId && !lifecycleIds.has(reading.lifecycleEventId)) issues.push(issue('invalid_lifecycle_relationship', `Reading ${reading.id} references a missing lifecycle event.`));
    const sameTime = sameStream.filter((candidate) => candidate.reading_timestamp === reading.reading_timestamp);
    if (sameTime.some((candidate) => candidate.cumulativeKWh === reading.cumulativeKWh)) issues.push(issue('duplicate_reading', `Reading ${reading.id} duplicates an existing observation.`));
    if (sameTime.some((candidate) => candidate.cumulativeKWh !== reading.cumulativeKWh)) issues.push(issue('same_timestamp_conflict', `Reading ${reading.id} conflicts with an existing observation at the same physical time.`));
    const ordered = [...sameStream, reading].sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
    const index = ordered.findIndex((candidate) => candidate.id === reading.id);
    const previous = index > 0 ? ordered[index - 1] : undefined;
    const lifecycle = reading.lifecycleEventId ? state.lifecycleEvents.find((event) => event.id === reading.lifecycleEventId) : undefined;
    const authorized = Boolean(reading.isBaseline && lifecycle && (lifecycle.type === 'reset' || lifecycle.type === 'replaced') && lifecycle.meterId === reading.meterId && lifecycle.householdId === reading.householdId && Date.parse(lifecycle.occurredAt) <= Date.parse(reading.reading_timestamp) && lifecycle.baselineReading === reading.cumulativeKWh);
    if (reading.isBaseline && !authorized) issues.push(issue('baseline_without_lifecycle', `Baseline reading ${reading.id} lacks a matching authorized lifecycle event.`));
    if (previous && reading.cumulativeKWh < previous.cumulativeKWh && !authorized) issues.push(issue('decreasing_reading', `Reading ${reading.id} decreases chronologically without an authorized lifecycle transition.`));
  }
  return resultFromIssues(issues);
}