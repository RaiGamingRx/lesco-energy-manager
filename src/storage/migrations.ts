import { PersistenceError } from './errors';
import type { PersistedEnvelope } from './schema';
import { PersistenceState } from './ports';

const CURRENT_SCHEMA_VERSION = 2;

type LegacyRecord = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function migrateVersionOne(input: unknown): PersistedEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PersistenceError('migration_failed', 'Schema version 1 data is not an object.');
  const record = input as LegacyRecord;
  const state = (record.state && typeof record.state === 'object' ? record.state : record) as LegacyRecord;
  if (!state.settings || !state.household || !Array.isArray(state.meters) || !Array.isArray(state.cycles) || !Array.isArray(state.readings)) {
    throw new PersistenceError('migration_failed', 'Schema version 1 data is missing required records.');
  }
  const migratedState: PersistenceState = {
    settings: state.settings as PersistenceState['settings'],
    household: state.household as PersistenceState['household'],
    connections: asArray(state.connections) as PersistenceState['connections'],
    meters: state.meters as PersistenceState['meters'],
    cycles: state.cycles as PersistenceState['cycles'],
    bills: asArray(state.bills) as PersistenceState['bills'],
    readings: state.readings as PersistenceState['readings'],
    lifecycleEvents: asArray(state.lifecycleEvents) as PersistenceState['lifecycleEvents'],
    auditLogs: asArray(state.auditLogs) as PersistenceState['auditLogs'],
  };
  return { schemaVersion: CURRENT_SCHEMA_VERSION, writtenAt: new Date().toISOString(), dataOrigin: 'user_data', state: migratedState };
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