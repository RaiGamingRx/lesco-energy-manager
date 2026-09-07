import {
  DEFAULT_HOUSEHOLD,
  DEFAULT_ACCOUNT,
  DEFAULT_MEMBERSHIP,
  DEFAULT_METERS,
  DEFAULT_SETTINGS,
  SEED_ACTIVE_CYCLE,
  SEED_AUDIT_LOGS,
  SEED_CLOSED_CYCLE,
  SEED_OFFICIAL_BILLS,
  SEED_READINGS,
} from './seedData';
import { PersistenceError } from './errors';
import { migrateLegacyKeys } from './migrations';
import { PersistenceState, StateStore } from './ports';
import { assertState, CURRENT_SCHEMA_VERSION, deserializeState, PERSISTENCE_KEY, serializeState } from './schema';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const LEGACY_KEYS = {
  settings: 'lesco_energy_settings_v1',
  household: 'lesco_energy_household_v1',
  meters: 'lesco_energy_meters_v1',
  cycles: 'lesco_energy_cycles_v1',
  readings: 'lesco_energy_readings_v1',
  auditLogs: 'lesco_energy_audit_v1',
};
const LEGACY_PERSISTENCE_KEYS = ['wattwise_persistence_v2'];

function developmentFixtureState(): PersistenceState {
  return {
    accounts: [structuredClone(DEFAULT_ACCOUNT)],
    memberships: [structuredClone(DEFAULT_MEMBERSHIP)],
    settings: structuredClone(DEFAULT_SETTINGS),
    household: structuredClone(DEFAULT_HOUSEHOLD),
    connections: [{
      id: 'connection-lesco-demo',
      householdId: DEFAULT_HOUSEHOLD.id,
      provider: 'LESCO',
      referenceNumber: DEFAULT_HOUSEHOLD.referenceNumber,
      createdAt: DEFAULT_HOUSEHOLD.createdAt,
      isActive: true,
    }],
    meters: structuredClone(DEFAULT_METERS).map((meter) => ({ ...meter, isActive: true })),
    cycles: structuredClone([SEED_CLOSED_CYCLE, SEED_ACTIVE_CYCLE]),
    bills: structuredClone(SEED_OFFICIAL_BILLS),
    readings: structuredClone(SEED_READINGS),
    lifecycleEvents: [],
    auditLogs: structuredClone(SEED_AUDIT_LOGS),
  };
}

export class LocalStorageStateAdapter implements StateStore {
  private readonly storage: StorageLike;

  constructor(storage?: StorageLike) {
    const browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
    // Tests and non-browser consumers must inject a durable adapter in real deployments.
    this.storage = storage ?? browserStorage ?? createMemoryStorage();
  }

  async load(): Promise<PersistenceState> {
    const primary = this.storage.getItem(PERSISTENCE_KEY);
    const legacy = LEGACY_PERSISTENCE_KEYS.map((key) => this.storage.getItem(key)).find((value): value is string => value !== null);
    const current = primary || legacy;
    if (current) {
      const envelope = deserializeState(current);
      if (!primary || envelope.schemaVersion !== CURRENT_SCHEMA_VERSION) await this.commit(envelope.state);
      return envelope.state;
    }

    const legacyRecords = {
      settings: this.storage.getItem(LEGACY_KEYS.settings),
      household: this.storage.getItem(LEGACY_KEYS.household),
      meters: this.storage.getItem(LEGACY_KEYS.meters),
      cycles: this.storage.getItem(LEGACY_KEYS.cycles),
      readings: this.storage.getItem(LEGACY_KEYS.readings),
      auditLogs: this.storage.getItem(LEGACY_KEYS.auditLogs),
    };
    const hasLegacyData = Object.values(legacyRecords).some((value) => value !== null);
    if (hasLegacyData) {
      const legacy = migrateLegacyKeys(legacyRecords);
      assertState(legacy.state);
      await this.commit(legacy.state);
      return legacy.state;
    }

    const fixture = developmentFixtureState();
    await this.commit(fixture, 'development_fixture');
    return fixture;
  }

  async commit(nextState: PersistenceState, dataOrigin: 'development_fixture' | 'user_data' | 'imported_data' = 'user_data'): Promise<void> {
    assertState(nextState);
    const serialized = serializeState(nextState, dataOrigin);
    try {
      this.storage.setItem(PERSISTENCE_KEY, serialized);
    } catch (error) {
      throw new PersistenceError('atomic_write_failed', 'WattWise could not commit the complete local state.', error);
    }
  }

  async reset(): Promise<void> {
    await this.commit(developmentFixtureState(), 'development_fixture');
  }
}

export function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const records = new Map(Object.entries(initial));
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); },
    removeItem: (key) => { records.delete(key); },
  };
}
