import { PersistenceError } from './errors';
import type { PersistedEnvelope } from './schema';
import { PersistenceState } from './ports';

const CURRENT_SCHEMA_VERSION = 3;

type LegacyRecord = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeOwnership(state: LegacyRecord): PersistenceState {
  const household = state.household as PersistenceState['household'];
  const connections = asArray(state.connections) as PersistenceState['connections'];
  const normalizedConnections = connections.length > 0 ? connections : [{ id: 'connection-migrated', householdId: household.id, provider: household.provider, referenceNumber: household.referenceNumber, createdAt: household.createdAt, isActive: true }];
  const connection = normalizedConnections[0];
  const meters = (asArray(state.meters) as PersistenceState['meters']).map((meter) => ({ ...meter, connectionId: meter.connectionId || connection.id }));
  const defaultMeter = meters[0];
  const cycles = (asArray(state.cycles) as PersistenceState['cycles']).map((cycle) => ({ ...cycle, connectionId: cycle.connectionId || connection.id, meterId: cycle.meterId || defaultMeter?.id || 'meter-migrated' }));
  const cycleById = new Map(cycles.map((cycle) => [cycle.id, cycle]));
  const readings = (asArray(state.readings) as PersistenceState['readings']).map((reading) => ({ ...reading, connectionId: reading.connectionId || cycleById.get(reading.cycleId)?.connectionId || connection.id }));
  const lifecycleEvents = (asArray(state.lifecycleEvents) as PersistenceState['lifecycleEvents']).map((event) => ({ ...event, connectionId: event.connectionId || meters.find((meter) => meter.id === event.meterId)?.connectionId || connection.id }));
  const bills = (asArray(state.bills) as PersistenceState['bills']).map((bill) => {
    const cycle = cycleById.get(bill.billingCycleId);
    return { ...bill, billingPeriodStart: bill.billingPeriodStart || cycle?.billingPeriodStart || household.createdAt.slice(0, 10), billingPeriodEnd: bill.billingPeriodEnd || cycle?.billingPeriodEnd || household.createdAt.slice(0, 10), extractionState: bill.extractionState || 'not_applicable', source: bill.source || 'user_entered' };
  });
  return {
    accounts: asArray(state.accounts).length > 0 ? state.accounts as PersistenceState['accounts'] : [{ id: 'account-migrated', displayName: 'Migrated local account', createdAt: household.createdAt }],
    memberships: asArray(state.memberships).length > 0 ? state.memberships as PersistenceState['memberships'] : [{ id: 'membership-migrated', householdId: household.id, accountId: 'account-migrated', role: 'owner', createdAt: household.createdAt }],
    settings: state.settings as PersistenceState['settings'],
    household: { ...household, connectionIds: household.connectionIds?.length ? household.connectionIds : normalizedConnections.map((item) => item.id) },
    connections: normalizedConnections,
    meters,
    cycles,
    bills,
    readings,
    lifecycleEvents,
    auditLogs: asArray(state.auditLogs) as PersistenceState['auditLogs'],
  };
}

export function migrateVersionOne(input: unknown): PersistedEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PersistenceError('migration_failed', 'Schema version 1 data is not an object.');
  const record = input as LegacyRecord;
  const state = (record.state && typeof record.state === 'object' ? record.state : record) as LegacyRecord;
  if (!state.settings || !state.household || !Array.isArray(state.meters) || !Array.isArray(state.cycles) || !Array.isArray(state.readings)) {
    throw new PersistenceError('migration_failed', 'Schema version 1 data is missing required records.');
  }
  return { schemaVersion: CURRENT_SCHEMA_VERSION, writtenAt: new Date().toISOString(), dataOrigin: 'user_data', state: normalizeOwnership(state) };
}

export function migrateVersionTwo(input: unknown): PersistedEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PersistenceError('migration_failed', 'Schema version 2 data is not an object.');
  const record = input as LegacyRecord;
  const state = (record.state && typeof record.state === 'object' ? record.state : record) as LegacyRecord;
  if (!state.settings || !state.household || !Array.isArray(state.meters) || !Array.isArray(state.cycles) || !Array.isArray(state.readings)) throw new PersistenceError('migration_failed', 'Schema version 2 data is missing required records.');
  return { schemaVersion: CURRENT_SCHEMA_VERSION, writtenAt: new Date().toISOString(), dataOrigin: 'user_data', state: normalizeOwnership(state) };
}

export function migrateLegacyKeys(records: {
  settings: string | null;
  household: string | null;
  meters: string | null;
  cycles: string | null;
  readings: string | null;
  auditLogs: string | null;
}): PersistedEnvelope {
  try {
    return migrateVersionOne({
      settings: records.settings ? JSON.parse(records.settings) : null,
      household: records.household ? JSON.parse(records.household) : null,
      meters: records.meters ? JSON.parse(records.meters) : null,
      cycles: records.cycles ? JSON.parse(records.cycles) : null,
      readings: records.readings ? JSON.parse(records.readings) : null,
      auditLogs: records.auditLogs ? JSON.parse(records.auditLogs) : [],
    });
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    throw new PersistenceError('migration_failed', 'Legacy WattWise data could not be migrated safely.', error);
  }
}