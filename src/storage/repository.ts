import {
  AppSettings,
  AuditRecord,
  BillingCycle,
  Household,
  Meter,
  MeterReading,
  MeterLifecycleEvent,
} from '../types';
import { validateBillingCycleMutation, validateReadingMutation } from '../domain/validation';
import { DomainOperationError, PersistenceError } from './errors';
import { EnergyRepository, PersistenceState, StateStore } from './ports';
import { deserializeState, serializeState } from './schema';
import { LocalStorageStateAdapter } from './localStorageAdapter';

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function operationFailure(result: { message?: string }): DomainOperationError {
  return new DomainOperationError('validation_failed', result.message || 'Domain validation failed.');
}

/**
 * Domain-aware repository over a replaceable state store.
 * The browser adapter is temporary; this repository has no storage API dependency.
 */
export class LocalStorageEnergyRepository implements EnergyRepository {
  constructor(private readonly store: StateStore = new LocalStorageStateAdapter()) {}

  private async state(): Promise<PersistenceState> {
    return clone(await this.store.load());
  }

  private async commit(state: PersistenceState, origin: 'user_data' | 'imported_data' = 'user_data'): Promise<void> {
    await this.store.commit(state, origin);
  }

  private audit(state: PersistenceState, entityType: AuditRecord['entityType'], entityId: string, action: AuditRecord['action'], oldValue: unknown, newValue: unknown, reason: string): void {
    state.auditLogs.unshift({ id: id('audit'), entityType, entityId, action, oldValue, newValue, timestamp: new Date().toISOString(), reason });
    state.auditLogs = state.auditLogs.slice(0, 300);
  }

  async getSettings(): Promise<AppSettings> { return (await this.state()).settings; }

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const state = await this.state();
    const oldValue = state.settings;
    state.settings = { ...state.settings, ...settings };
    this.audit(state, 'settings', 'global', 'edit', oldValue, state.settings, 'User updated settings');
    await this.commit(state);
    return state.settings;
  }

  async getHousehold(): Promise<Household> { return (await this.state()).household; }

  async updateHousehold(household: Partial<Household>): Promise<Household> {
    const state = await this.state();
    const oldValue = state.household;
    state.household = { ...state.household, ...household };
    this.audit(state, 'settings', state.household.id, 'edit', oldValue, state.household, 'Household profile updated');
    await this.commit(state);
    return state.household;
  }

  async getMeters(): Promise<Meter[]> { return (await this.state()).meters; }

  async getBillingCycles(): Promise<BillingCycle[]> {
    return (await this.state()).cycles.sort((a, b) => Date.parse(b.billingPeriodStart) - Date.parse(a.billingPeriodStart));
  }

  async getActiveBillingCycle(): Promise<BillingCycle | null> {
    return (await this.state()).cycles.find((cycle) => cycle.status === 'active') || null;
  }

  async saveBillingCycle(cycle: BillingCycle, auditReason?: string): Promise<BillingCycle> {
    const state = await this.state();
    const existingIndex = state.cycles.findIndex((candidate) => candidate.id === cycle.id);
    const existing = existingIndex >= 0 ? state.cycles[existingIndex] : undefined;
    if (existing && (existing.status === 'closed' || existing.status === 'locked')) {
      throw new DomainOperationError('immutable_record', 'Finalized billing cycles cannot be edited.');
    }
    const validation = validateBillingCycleMutation(cycle, state.cycles, state.household);
    if (!validation.isValid) throw operationFailure(validation);
    const now = new Date().toISOString();
    const saved = { ...cycle, createdAt: existing?.createdAt || now, updatedAt: now };
    if (existingIndex >= 0) state.cycles[existingIndex] = saved;
    else state.cycles.push(saved);
    this.audit(state, 'billing_cycle', cycle.id, existing ? 'edit' : 'create', existing || null, saved, auditReason || 'Billing cycle saved');
    await this.commit(state);
    return saved;
  }

  async closeBillingCycle(cycleId: string, finalData?: Partial<BillingCycle>): Promise<BillingCycle> {
    const state = await this.state();
    const index = state.cycles.findIndex((cycle) => cycle.id === cycleId);
    if (index < 0) throw new DomainOperationError('not_found', `Billing cycle ${cycleId} was not found.`);
    const current = state.cycles[index];
    if (current.status === 'closed' || current.status === 'locked') throw new DomainOperationError('immutable_record', 'Finalized billing cycles cannot be closed or edited.');
    const candidate: BillingCycle = { ...current, ...finalData, status: 'closed', updatedAt: new Date().toISOString() };
    const validation = validateBillingCycleMutation(candidate, state.cycles, state.household);
    if (!validation.isValid) throw operationFailure(validation);
    state.cycles[index] = candidate;
    this.audit(state, 'billing_cycle', cycleId, 'lock', current, candidate, 'Cycle officially closed and finalized');
    await this.commit(state);
    return candidate;
  }

  async getMeterReadings(cycleId?: string): Promise<MeterReading[]> {
    const readings = (await this.state()).readings;
    return readings.filter((reading) => !cycleId || reading.cycleId === cycleId).sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
  }

  async addMeterReading(readingData: Omit<MeterReading, 'id' | 'entry_timestamp'>): Promise<MeterReading> {
    const state = await this.state();
    const reading: MeterReading = { ...readingData, id: id('reading'), entry_timestamp: new Date().toISOString() };
    const meter = state.meters.find((candidate) => candidate.id === reading.meterId);
    const cycle = state.cycles.find((candidate) => candidate.id === reading.cycleId);
    if (!meter || !cycle) throw new DomainOperationError('validation_failed', 'Reading must reference an existing meter and billing cycle.');
    if (cycle.status === 'closed' || cycle.status === 'locked') throw new DomainOperationError('immutable_record', 'Readings cannot be added to a finalized billing cycle.');
    const validation = validateReadingMutation(reading, { household: state.household, meter, cycle, existingReadings: state.readings, lifecycleEvents: state.lifecycleEvents });
    if (!validation.isValid) throw operationFailure(validation);
    state.readings.push(reading);
    state.readings.sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
    this.audit(state, 'meter_reading', reading.id, 'create', null, reading, `Added meter reading ${reading.cumulativeKWh} kWh`);
    await this.commit(state);
    return reading;
  }

  async updateMeterReading(readingId: string, updates: Partial<MeterReading>, reason?: string): Promise<MeterReading> {
    const state = await this.state();
    const index = state.readings.findIndex((reading) => reading.id === readingId);
    if (index < 0) throw new DomainOperationError('not_found', `Reading ${readingId} was not found.`);
    const oldValue = state.readings[index];
    const cycle = state.cycles.find((candidate) => candidate.id === oldValue.cycleId);
    if (!cycle) throw new DomainOperationError('validation_failed', 'Reading references a missing billing cycle.');
    if (cycle.status === 'closed' || cycle.status === 'locked') throw new DomainOperationError('immutable_record', 'Readings in finalized billing cycles cannot be edited.');
    const updated: MeterReading = { ...oldValue, ...updates, isCorrected: true, correctionHistory: [...(oldValue.correctionHistory || []), { correctedAt: new Date().toISOString(), reason: reason || 'Explicit correction', previousValue: oldValue.cumulativeKWh, previousReadingTimestamp: oldValue.reading_timestamp }] };
    const meter = state.meters.find((candidate) => candidate.id === updated.meterId);
    if (!meter) throw new DomainOperationError('validation_failed', 'Reading references a missing meter.');
    const validation = validateReadingMutation(updated, { household: state.household, meter, cycle, existingReadings: state.readings, lifecycleEvents: state.lifecycleEvents, currentReadingId: readingId });
    if (!validation.isValid) throw operationFailure(validation);
    state.readings[index] = updated;
    state.readings.sort((a, b) => Date.parse(a.reading_timestamp) - Date.parse(b.reading_timestamp));
    this.audit(state, 'meter_reading', readingId, 'correction', oldValue, updated, reason || 'Explicit user correction');
    await this.commit(state);
    return updated;
  }

  async deleteMeterReading(readingId: string, reason?: string): Promise<void> {
    const state = await this.state();
    const index = state.readings.findIndex((reading) => reading.id === readingId);
    if (index < 0) throw new DomainOperationError('not_found', `Reading ${readingId} was not found.`);
    const reading = state.readings[index];
    const cycle = state.cycles.find((candidate) => candidate.id === reading.cycleId);
    if (cycle && (cycle.status === 'closed' || cycle.status === 'locked')) throw new DomainOperationError('immutable_record', 'Readings in finalized billing cycles cannot be deleted.');
    state.readings.splice(index, 1);
    this.audit(state, 'meter_reading', readingId, 'delete', reading, null, reason || 'User deleted meter reading');
    await this.commit(state);
  }

  async createMeterLifecycleEvent(eventData: Omit<MeterLifecycleEvent, 'id' | 'createdAt'>): Promise<MeterLifecycleEvent> {
    const state = await this.state();
    const meter = state.meters.find((candidate) => candidate.id === eventData.meterId);
    if (!meter || meter.householdId !== eventData.householdId || state.household.id !== eventData.householdId) {
      throw new DomainOperationError('validation_failed', 'Meter lifecycle event has an invalid household or meter relationship.');
    }
    if (!Number.isFinite(Date.parse(eventData.occurredAt)) || (eventData.baselineReading !== undefined && (!Number.isFinite(eventData.baselineReading) || eventData.baselineReading < 0))) {
      throw new DomainOperationError('validation_failed', 'Meter lifecycle event contains invalid date or baseline data.');
    }
    const event: MeterLifecycleEvent = { ...eventData, id: id('meter-event'), createdAt: new Date().toISOString() };
    state.lifecycleEvents.push(event);
    const index = state.meters.findIndex((candidate) => candidate.id === event.meterId);
    state.meters[index] = { ...state.meters[index], lifecycleEventIds: [...(state.meters[index].lifecycleEventIds || []), event.id] };
    this.audit(state, 'meter_lifecycle_event', event.id, 'create', null, event, 'Meter lifecycle event recorded');
    await this.commit(state);
    return event;
  }

  async getAuditRecords(): Promise<AuditRecord[]> { return (await this.state()).auditLogs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); }

  async exportAllData(): Promise<string> {
    const state = await this.state();
    return serializeState(state, 'user_data');
  }

  async exportReadingsCSV(): Promise<string> {
    const readings = await this.getMeterReadings();
    const headers = ['Reading ID', 'Cycle ID', 'Meter ID', 'Cumulative kWh', 'Physical Reading At', 'Recorded At', 'Source', 'Validation Status', 'Notes'];
    const rows = readings.map((reading) => [reading.id, reading.cycleId, reading.meterId, reading.cumulativeKWh, reading.reading_timestamp, reading.entry_timestamp, reading.source, reading.validationStatus, `"${(reading.notes || '').replace(/"/g, '""')}"`]);
    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  async importData(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const envelope = deserializeState(jsonData);
      await this.commit(envelope.state, 'imported_data');
      return { success: true, message: 'Data imported successfully.' };
    } catch (error) {
      if (error instanceof PersistenceError) return { success: false, message: error.message };
      return { success: false, message: 'The import could not be completed safely.' };
    }
  }

  async resetToDefaultData(): Promise<void> { await this.store.reset(); }

  async loadScenario(scenarioId: number): Promise<string> {
    await this.resetToDefaultData();
    if (scenarioId === 8) {
      await this.updateSettings({ trackingMode: 'outdoor_meter' });
      await this.updateHousehold({ trackingMode: 'outdoor_meter' });
      return 'Loaded Scenario 8: Switched tracking mode to outdoor official meter.';
    }
    if (scenarioId === 2) {
      const cycle = await this.getActiveBillingCycle();
      if (cycle) {
        await this.addMeterReading({ cycleId: cycle.id, meterId: 'm-indoor', householdId: cycle.householdId, cumulativeKWh: 72, reading_timestamp: '2026-09-05T18:00:00.000Z', source: 'indoor_meter', validationStatus: 'valid', isBaseline: true });
        await this.addMeterReading({ cycleId: cycle.id, meterId: 'm-indoor', householdId: cycle.householdId, cumulativeKWh: 73.4, reading_timestamp: '2026-09-06T18:00:00.000Z', source: 'indoor_meter', validationStatus: 'valid' });
      }
      return 'Loaded Scenario 2: Added increasing indoor meter readings.';
    }
    return `Scenario ${scenarioId} ready.`;
  }
}

export const repository = new LocalStorageEnergyRepository();
export type { EnergyRepository };
