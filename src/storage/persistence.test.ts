import { describe, expect, it } from 'vitest';
import { EnergyApplicationService } from '../application/energyService';
import { EnergyRepository } from './ports';
import { PersistenceError } from './errors';
import { createMemoryStorage, LocalStorageStateAdapter } from './localStorageAdapter';
import { migrateVersionOne } from './migrations';
import { CURRENT_SCHEMA_VERSION, deserializeState, PERSISTENCE_KEY, serializeState } from './schema';
import { LocalStorageEnergyRepository } from './repository';
import { AppSettings, AuditRecord, BillingCycle, Household, Meter, MeterReading } from '../types';

class RecordingRepository implements EnergyRepository {
  public createdReading: Omit<MeterReading, 'id' | 'entry_timestamp'> | undefined;
  private readonly settings: AppSettings = {
    householdName: 'Test', provider: 'LESCO', tariffCategory: 'domestic_protected', trackingMode: 'indoor_cumulative', referenceNumber: 'ref', officialThreshold: 200, personalTarget: 190, cautionThreshold: 180, criticalThreshold: 190, preferredReadingTime: '18:00', readingFrequency: 'daily', notificationsEnabled: false, theme: 'light',
  };
  private readonly household: Household = { id: 'h-1', name: 'Test', provider: 'LESCO', referenceNumber: 'ref', trackingMode: 'indoor_cumulative', createdAt: '2026-01-01T00:00:00.000Z' };
  async getSettings(): Promise<AppSettings> { return this.settings; }
  async updateSettings(value: Partial<AppSettings>): Promise<AppSettings> { Object.assign(this.settings, value); return this.settings; }
  async getHousehold(): Promise<Household> { return this.household; }
  async updateHousehold(value: Partial<Household>): Promise<Household> { Object.assign(this.household, value); return this.household; }
  async getMeters(): Promise<Meter[]> { return []; }
  async getBillingCycles(): Promise<BillingCycle[]> { return []; }
  async getOfficialBills(): Promise<import('../types').OfficialBill[]> { return []; }
  async getActiveBillingCycle(): Promise<BillingCycle | null> { return null; }
  async saveBillingCycle(cycle: BillingCycle): Promise<BillingCycle> { return cycle; }
  async saveCycleWithOfficialBill(cycle: BillingCycle): Promise<BillingCycle> { return cycle; }
  async closeBillingCycle(cycleId: string): Promise<BillingCycle> { throw new Error(cycleId); }
  async getMeterReadings(): Promise<MeterReading[]> { return []; }
  async addMeterReading(reading: Omit<MeterReading, 'id' | 'entry_timestamp'>): Promise<MeterReading> { this.createdReading = reading; return { ...reading, id: 'r-1', entry_timestamp: '2026-01-01T00:00:00.000Z' }; }
  async updateMeterReading(): Promise<MeterReading> { throw new Error('unused'); }
  async deleteMeterReading(): Promise<void> { return undefined; }
  async createMeterLifecycleEvent(): Promise<import('../types').MeterLifecycleEvent> { throw new Error('unused'); }
  async createLifecycleBaseline(): Promise<{ event: import('../types').MeterLifecycleEvent; reading: MeterReading }> { throw new Error('unused'); }
  async getAuditRecords(): Promise<AuditRecord[]> { return []; }
  async exportAllData(): Promise<string> { return ''; }
  async exportReadingsCSV(): Promise<string> { return ''; }
  async importData(): Promise<{ success: boolean; message: string }> { return { success: true, message: 'ok' }; }
  async resetToDefaultData(): Promise<void> { return undefined; }
  async loadScenario(): Promise<string> { return 'ok'; }
}

describe('persistence schema and migrations', () => {
  it('round-trips domain state and preserves timestamp semantics', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const state = await adapter.load();
    const timestamp = '2026-08-12T18:30:00+05:00';
    state.readings[0].reading_timestamp = timestamp;
    await adapter.commit(state);
    const loaded = await adapter.load();
    expect(loaded.readings[0].reading_timestamp).toBe(timestamp);
    expect(deserializeState((await adapter.load(), serializeState(loaded))).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('rejects malformed JSON, malformed entities, and unsupported schemas', () => {
    expect(() => deserializeState('{not json')).toThrowError(PersistenceError);
    expect(() => deserializeState(JSON.stringify({ schemaVersion: 999 }))).toThrowError(PersistenceError);
    expect(() => deserializeState(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, writtenAt: '2026-01-01T00:00:00.000Z', dataOrigin: 'user_data', state: { settings: {}, household: {}, connections: [], meters: [], cycles: [], bills: [], readings: [{ id: 'r', cumulativeKWh: 'bad' }], lifecycleEvents: [], auditLogs: [] } }))).toThrowError(PersistenceError);
  });

  it('migrates schema v1 without dropping required collections', () => {
    const migrated = migrateVersionOne({
      schemaVersion: 1,
      settings: { householdName: 'Legacy' },
      household: { id: 'h-1', name: 'Legacy' },
      meters: [], cycles: [], readings: [], auditLogs: [],
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.state.settings).toEqual({ householdName: 'Legacy' });
    expect(migrated.state.connections).toHaveLength(1);
  });

  it('loads a version 1 envelope through the adapter migration path', async () => {
    const state = await new LocalStorageStateAdapter(createMemoryStorage()).load();
    const storage = createMemoryStorage({ [PERSISTENCE_KEY]: JSON.stringify({ schemaVersion: 1, state }) });
    const loaded = await new LocalStorageStateAdapter(storage).load();
    expect(loaded.household.id).toBe(state.household.id);
    expect(deserializeState(storage.getItem(PERSISTENCE_KEY) || '').schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('discovers and rewrites the previous v2 persistence key', async () => {
    const state = await new LocalStorageStateAdapter(createMemoryStorage()).load();
    const envelope = JSON.parse(serializeState(state)) as { schemaVersion: number; state: typeof state };
    envelope.schemaVersion = 2;
    const storage = createMemoryStorage({ wattwise_persistence_v2: JSON.stringify(envelope) });
    const loaded = await new LocalStorageStateAdapter(storage).load();
    expect(loaded.household.id).toBe(state.household.id);
    expect(deserializeState(storage.getItem(PERSISTENCE_KEY) || '').schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('keeps malformed legacy migration from becoming an empty valid state', () => {
    expect(() => migrateVersionOne({ settings: {}, household: {} })).toThrowError(PersistenceError);
  });
});

describe('application and repository boundaries', () => {
  it('routes application operations through the repository port', async () => {
    const repository = new RecordingRepository();
    const service = new EnergyApplicationService(repository);
    const reading = { cycleId: 'c-1', meterId: 'm-1', householdId: 'h-1', connectionId: 'connection-1', cumulativeKWh: 10, reading_timestamp: '2026-01-01T00:00:00.000Z', source: 'manual' as const, validationStatus: 'valid' as const };
    await service.createReading(reading);
    expect(repository.createdReading).toEqual(reading);
  });

  it('rejects invalid writes without changing the previous valid state', async () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageStateAdapter(storage);
    const repository = new LocalStorageEnergyRepository(adapter);
    const before = (await adapter.load()).readings.length;
    await expect(repository.addMeterReading({ cycleId: 'cycle-2026-09', meterId: 'm-indoor', householdId: 'wrong-household', connectionId: 'connection-lesco-demo', cumulativeKWh: -1, reading_timestamp: '2026-01-01T00:00:00.000Z', source: 'manual', validationStatus: 'valid' })).rejects.toThrow();
    expect((await adapter.load()).readings.length).toBe(before);
    expect(storage.getItem(PERSISTENCE_KEY)).toBeTruthy();
  });

  it('protects finalized cycles from destructive reading edits', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const state = await adapter.load();
    state.readings[0].cycleId = 'cycle-2026-08';
    state.readings[0].meterId = 'm-outdoor';
    state.readings[0].reading_timestamp = '2026-08-01T18:00:00.000Z';
    state.readings[0].entry_timestamp = '2026-08-01T18:05:00.000Z';
    await adapter.commit(state);
    const repository = new LocalStorageEnergyRepository(adapter);
    await expect(repository.updateMeterReading(state.readings[0].id, { cumulativeKWh: 25 }, 'test')).rejects.toThrowError(/finalized/i);
    expect((await adapter.load()).readings[0].cumulativeKWh).toBe(state.readings[0].cumulativeKWh);
  });

  it('rejects semantically invalid imports without changing existing state', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const before = await adapter.load();
    const exported = JSON.parse(await repository.exportAllData()) as { state: typeof before };
    exported.state.readings[0].cumulativeKWh = -10;
    const result = await repository.importData(JSON.stringify(exported));
    expect(result.success).toBe(false);
    expect((await adapter.load()).readings[0].cumulativeKWh).toBe(before.readings[0].cumulativeKWh);
  });

  it('rejects finalized-record tampering through import', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const before = await adapter.load();
    const exported = JSON.parse(await repository.exportAllData()) as { state: typeof before };
    exported.state.cycles.find((cycle) => cycle.id === 'cycle-2026-08')!.billAmount = 1;
    const result = await repository.importData(JSON.stringify(exported));
    expect(result.success).toBe(false);
    expect((await adapter.load()).cycles.find((cycle) => cycle.id === 'cycle-2026-08')?.billAmount).toBe(2640);
  });

  it('keeps lifecycle and baseline transitions atomic on validation failure', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const before = await adapter.load();
    await expect(repository.createLifecycleBaseline(
      { meterId: 'm-indoor', connectionId: 'connection-lesco-demo', householdId: 'hh-1', type: 'reset', occurredAt: '2026-09-06T17:00:00.000Z', baselineReading: 0 },
      { cycleId: 'cycle-2026-09', meterId: 'm-indoor', householdId: 'hh-1', connectionId: 'connection-lesco-demo', cumulativeKWh: 0, reading_timestamp: '2026-09-10T18:00:00.000Z', source: 'indoor_meter', validationStatus: 'valid' },
    )).rejects.toThrow();
    const after = await adapter.load();
    expect(after.lifecycleEvents).toHaveLength(before.lifecycleEvents.length);
    expect(after.readings).toHaveLength(before.readings.length);
  });

  it('rejects a second active cycle through the normal repository write path', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const active = (await adapter.load()).cycles.find((cycle) => cycle.status === 'active')!;
    await expect(repository.saveBillingCycle({ ...active, id: 'cycle-2026-10', billingPeriodStart: '2026-09-10', billingPeriodEnd: '2026-10-09', officialReadingDate: '2026-09-10' })).rejects.toThrow(/active/i);
  });

  it('persists a cycle and its OfficialBill atomically', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const active = (await adapter.load()).cycles.find((cycle) => cycle.status === 'active')!;
    const bill = {
      id: 'bill-new-cycle', householdId: active.householdId, connectionId: active.connectionId, billingCycleId: active.id,
      billingPeriodStart: active.billingPeriodStart, billingPeriodEnd: active.billingPeriodEnd, provider: active.provider,
      billReference: 'TEST-BILL', issuedOn: active.officialReadingDate, previousReading: active.previousOfficialReading,
      currentReading: active.currentOfficialReading, billedUnits: active.billedUnits, amount: active.billAmount,
      charges: active.applicableCharges, source: 'user_entered' as const, extractionState: 'not_applicable' as const,
      createdAt: '2026-09-07T00:00:00.000Z', finalizedAt: '2026-09-07T00:00:00.000Z', revisionStatus: 'finalized' as const,
    };
    const saved = await repository.saveCycleWithOfficialBill({ ...active, id: 'cycle-with-bill', status: 'draft', billingPeriodStart: '2026-09-10', billingPeriodEnd: '2026-10-09', officialReadingDate: '2026-09-10', previousOfficialReading: 1500, currentOfficialReading: 1500, billedUnits: 0, billAmount: 0 }, { ...bill, billingCycleId: 'cycle-with-bill', billingPeriodStart: '2026-09-10', billingPeriodEnd: '2026-10-09' });
    expect(saved.officialBillId).toBe('bill-new-cycle');
    expect((await repository.getOfficialBills()).some((item) => item.id === 'bill-new-cycle')).toBe(true);
  });

  it('checks supported cycle versions and records future command-contract metadata', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const active = (await adapter.load()).cycles.find((cycle) => cycle.status === 'active')!;
    const saved = await repository.saveBillingCycle(active, 'versioned update', { actorAccountId: 'account-1', householdId: active.householdId, correlationId: 'request-1', idempotencyKey: 'idem-1', expectedVersion: 0, authoritativeAt: '2026-09-07T00:00:00.000Z' });
    expect(saved.version).toBe(1);
    await expect(repository.saveBillingCycle(saved, 'stale update', { expectedVersion: 0 })).rejects.toThrow(/stale/i);
    const audit = (await repository.getAuditRecords())[0];
    expect(audit.actorAccountId).toBe('account-1');
    expect(audit.householdId).toBe(active.householdId);
    expect(audit.idempotencyKey).toBe('idem-1');
  });

  it('rejects imported readings with a forged connection context atomically', async () => {
    const adapter = new LocalStorageStateAdapter(createMemoryStorage());
    const repository = new LocalStorageEnergyRepository(adapter);
    const before = await adapter.load();
    const exported = JSON.parse(await repository.exportAllData()) as { state: typeof before };
    exported.state.readings[0].connectionId = 'forged-connection';
    const result = await repository.importData(JSON.stringify(exported));
    expect(result.success).toBe(false);
    expect((await adapter.load()).readings[0].connectionId).toBe(before.readings[0].connectionId);
  });
});
