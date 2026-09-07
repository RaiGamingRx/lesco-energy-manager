import { PersistenceError } from './errors';
import { PersistenceState } from './ports';
import { migrateVersionOne, migrateVersionTwo } from './migrations';
import { validateStateIntegrity } from '../domain/validation';

export const CURRENT_SCHEMA_VERSION = 3;
export const PERSISTENCE_KEY = 'wattwise_persistence_v3';

export interface PersistedEnvelope {
  schemaVersion: number;
  writtenAt: string;
  dataOrigin: 'development_fixture' | 'user_data' | 'imported_data';
  state: PersistenceState;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isDataOrigin = (value: unknown): value is PersistedEnvelope['dataOrigin'] => value === 'development_fixture' || value === 'user_data' || value === 'imported_data';
const isDate = (value: unknown): value is string => isString(value) && Number.isFinite(Date.parse(value));
const uniqueIds = (items: unknown[]): boolean => {
  const ids = items.filter(isRecord).map((item) => item.id).filter(isString);
  return ids.length === items.length && new Set(ids).size === ids.length;
};

function validateState(value: unknown): value is PersistenceState {
  if (!isRecord(value)) return false;
  if (!isRecord(value.settings) || !isRecord(value.household)) return false;
  const household = value.household;
  if (!isString(household.id) || !isString(household.name)) return false;
  if (!isArray(value.accounts) || !isArray(value.memberships) || !isArray(value.connections) || !isArray(value.meters) || !isArray(value.cycles) || !isArray(value.bills) || !isArray(value.readings) || !isArray(value.lifecycleEvents) || !isArray(value.auditLogs)) return false;
  if (![value.accounts, value.memberships, value.connections, value.meters, value.cycles, value.bills, value.readings, value.lifecycleEvents, value.auditLogs].every(uniqueIds)) return false;
  const accountIds = new Set(value.accounts.filter(isRecord).map((account) => account.id));
  if (!value.accounts.every((account) => isRecord(account) && isString(account.id) && isDate(account.createdAt))) return false;
  if (!value.memberships.every((membership) => isRecord(membership) && isString(membership.id) && membership.householdId === household.id && isString(membership.accountId) && accountIds.has(membership.accountId) && isString(membership.role))) return false;
  if (!value.connections.every((connection) => isRecord(connection) && isString(connection.id) && connection.householdId === household.id && isString(connection.provider))) return false;
  const connectionIds = new Set(value.connections.filter(isRecord).map((connection) => connection.id));
  if (!value.meters.every((meter) => isRecord(meter) && isString(meter.id) && meter.householdId === household.id && isString(meter.connectionId) && connectionIds.has(meter.connectionId))) return false;
  const meterIds = new Set(value.meters.filter(isRecord).map((meter) => meter.id));
  if (!value.cycles.every((cycle) => isRecord(cycle) && isString(cycle.id) && cycle.householdId === household.id && isString(cycle.connectionId) && connectionIds.has(cycle.connectionId) && isString(cycle.meterId) && meterIds.has(cycle.meterId) && isDate(cycle.billingPeriodStart) && isDate(cycle.billingPeriodEnd) && isDate(cycle.officialReadingDate) && isFiniteNumber(cycle.previousOfficialReading) && isFiniteNumber(cycle.currentOfficialReading) && isFiniteNumber(cycle.billedUnits))) return false;
  const cycleIds = new Set(value.cycles.filter(isRecord).map((cycle) => cycle.id));
  if (!value.readings.every((reading) => isRecord(reading) && isString(reading.id) && reading.householdId === household.id && isString(reading.meterId) && meterIds.has(reading.meterId) && isString(reading.connectionId) && connectionIds.has(reading.connectionId) && isString(reading.cycleId) && cycleIds.has(reading.cycleId) && isFiniteNumber(reading.cumulativeKWh) && reading.cumulativeKWh >= 0 && isDate(reading.reading_timestamp) && isDate(reading.entry_timestamp))) return false;
  if (!value.bills.every((bill) => isRecord(bill) && isString(bill.id) && bill.householdId === household.id && isString(bill.connectionId) && connectionIds.has(bill.connectionId) && isString(bill.billingCycleId) && cycleIds.has(bill.billingCycleId) && isDate(bill.billingPeriodStart) && isDate(bill.billingPeriodEnd) && isDate(bill.issuedOn) && isString(bill.billReference) && isString(bill.source) && isString(bill.extractionState))) return false;
  if (!value.lifecycleEvents.every((event) => isRecord(event) && isString(event.id) && event.householdId === household.id && meterIds.has(event.meterId) && isString(event.connectionId) && connectionIds.has(event.connectionId) && isDate(event.occurredAt))) return false;
  return true;
}

export function serializeState(state: PersistenceState, dataOrigin: PersistedEnvelope['dataOrigin'] = 'user_data', writtenAt = new Date().toISOString()): string {
  const envelope: PersistedEnvelope = { schemaVersion: CURRENT_SCHEMA_VERSION, writtenAt, dataOrigin, state };
  return JSON.stringify(envelope);
}

export function deserializeState(raw: string): PersistedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new PersistenceError('corrupt_data', 'Persisted WattWise data is not valid JSON.', error);
  }
  if (!isRecord(parsed)) {
    throw new PersistenceError('unsupported_schema', 'Persisted WattWise data uses an unsupported schema version.');
  }
  if (parsed.schemaVersion === 1) {
    const migrated = migrateVersionOne(parsed);
    if (!validateState(migrated.state)) throw new PersistenceError('migration_failed', 'Migrated WattWise data failed current schema validation.');
    const semantic = validateStateIntegrity(migrated.state);
    if (!semantic.isValid) throw new PersistenceError('migration_failed', semantic.message || 'Migrated WattWise data failed domain integrity validation.');
    return migrated;
  }
  if (parsed.schemaVersion === 2) {
    const migrated = migrateVersionTwo(parsed);
    if (!validateState(migrated.state)) throw new PersistenceError('migration_failed', 'Migrated schema v2 data failed current schema validation.');
    const semantic = validateStateIntegrity(migrated.state);
    if (!semantic.isValid) throw new PersistenceError('migration_failed', semantic.message || 'Migrated schema v2 data failed domain integrity validation.');
    return migrated;
  }
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new PersistenceError('unsupported_schema', 'Persisted WattWise data uses an unsupported schema version.');
  if (!isString(parsed.writtenAt) || !isDataOrigin(parsed.dataOrigin) || !validateState(parsed.state)) {
    throw new PersistenceError('corrupt_data', 'Persisted WattWise data failed structural validation.');
  }
  const semantic = validateStateIntegrity(parsed.state);
  if (!semantic.isValid) throw new PersistenceError('corrupt_data', semantic.message || 'Persisted WattWise data failed domain integrity validation.');
  return parsed as unknown as PersistedEnvelope;
}

export function assertState(state: PersistenceState): void {
  if (!validateState(state)) throw new PersistenceError('corrupt_data', 'The application attempted to persist invalid domain state.');
  const semantic = validateStateIntegrity(state);
  if (!semantic.isValid) throw new PersistenceError('corrupt_data', semantic.message || 'The application attempted to persist invalid domain state.');
}