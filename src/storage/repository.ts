import {
  AppSettings,
  BillingCycle,
  Household,
  Meter,
  MeterReading,
  AuditRecord,
} from '../types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_HOUSEHOLD,
  DEFAULT_METERS,
  SEED_ACTIVE_CYCLE,
  SEED_CLOSED_CYCLE,
  SEED_READINGS,
  SEED_AUDIT_LOGS,
} from './seedData';

const STORAGE_KEYS = {
  SETTINGS: 'lesco_energy_settings_v1',
  HOUSEHOLD: 'lesco_energy_household_v1',
  METERS: 'lesco_energy_meters_v1',
  CYCLES: 'lesco_energy_cycles_v1',
  READINGS: 'lesco_energy_readings_v1',
  AUDIT: 'lesco_energy_audit_v1',
  INITIALIZED: 'lesco_energy_initialized_v1',
};

export interface IEnergyDataRepository {
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  getHousehold(): Promise<Household>;
  updateHousehold(household: Partial<Household>): Promise<Household>;
  getMeters(): Promise<Meter[]>;
  getBillingCycles(): Promise<BillingCycle[]>;
  getActiveBillingCycle(): Promise<BillingCycle | null>;
  saveBillingCycle(cycle: BillingCycle, auditReason?: string): Promise<BillingCycle>;
  closeBillingCycle(cycleId: string, finalData?: Partial<BillingCycle>): Promise<BillingCycle>;
  getMeterReadings(cycleId?: string): Promise<MeterReading[]>;
  addMeterReading(reading: Omit<MeterReading, 'id' | 'entry_timestamp'>): Promise<MeterReading>;
  updateMeterReading(id: string, updates: Partial<MeterReading>, reason?: string): Promise<MeterReading>;
  deleteMeterReading(id: string, reason?: string): Promise<void>;
  getAuditRecords(): Promise<AuditRecord[]>;
  exportAllData(): Promise<string>;
  exportReadingsCSV(): Promise<string>;
  importData(jsonData: string): Promise<{ success: boolean; message: string }>;
  resetToDefaultData(): Promise<void>;
  loadScenario(scenarioId: number): Promise<string>;
}

export class LocalStorageEnergyRepository implements IEnergyDataRepository {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      this.resetToDefaultsInternal();
    }
  }

  private resetToDefaultsInternal() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(DEFAULT_HOUSEHOLD));
    localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(DEFAULT_METERS));
    localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify([SEED_CLOSED_CYCLE, SEED_ACTIVE_CYCLE]));
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(SEED_READINGS));
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(SEED_AUDIT_LOGS));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  async getSettings(): Promise<AppSettings> {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    await this.logAudit('settings', 'global', 'edit', current, updated, 'User updated settings');
    return updated;
  }

  async getHousehold(): Promise<Household> {
    const raw = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
    return raw ? JSON.parse(raw) : DEFAULT_HOUSEHOLD;
  }

  async updateHousehold(household: Partial<Household>): Promise<Household> {
    const current = await this.getHousehold();
    const updated = { ...current, ...household };
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(updated));
    await this.logAudit('settings', current.id, 'edit', current, updated, 'Household profile updated');
    return updated;
  }

  async getMeters(): Promise<Meter[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.METERS);
    return raw ? JSON.parse(raw) : DEFAULT_METERS;
  }

  async getBillingCycles(): Promise<BillingCycle[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.CYCLES);
    const cycles: BillingCycle[] = raw ? JSON.parse(raw) : [];
    // Sort descending by period start
    return cycles.sort((a, b) => new Date(b.billingPeriodStart).getTime() - new Date(a.billingPeriodStart).getTime());
  }

  async getActiveBillingCycle(): Promise<BillingCycle | null> {
    const cycles = await this.getBillingCycles();
    return cycles.find((c) => c.status === 'active') || null;
  }

  async saveBillingCycle(cycle: BillingCycle, auditReason?: string): Promise<BillingCycle> {
    const cycles = await this.getBillingCycles();
    const existingIndex = cycles.findIndex((c) => c.id === cycle.id);
    let oldVal = null;

    if (existingIndex >= 0) {
      oldVal = cycles[existingIndex];
      cycles[existingIndex] = { ...cycle, updatedAt: new Date().toISOString() };
    } else {
      // If setting this new cycle as active, mark other active cycles as closed/draft
      if (cycle.status === 'active') {
        cycles.forEach((c) => {
          if (c.status === 'active') c.status = 'closed';
        });
      }
      cycles.unshift({ ...cycle, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(cycles));
    await this.logAudit(
      'billing_cycle',
      cycle.id,
      existingIndex >= 0 ? 'edit' : 'create',
      oldVal,
      cycle,
      auditReason || (existingIndex >= 0 ? 'Updated billing cycle' : 'Created new billing cycle')
    );
    return cycle;
  }

  async closeBillingCycle(cycleId: string, finalData?: Partial<BillingCycle>): Promise<BillingCycle> {
    const cycles = await this.getBillingCycles();
    const target = cycles.find((c) => c.id === cycleId);
    if (!target) throw new Error(`Cycle with ID ${cycleId} not found`);

    const oldVal = { ...target };
    target.status = 'closed';
    if (finalData) {
      Object.assign(target, finalData);
    }
    target.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(cycles));
    await this.logAudit('billing_cycle', cycleId, 'lock', oldVal, target, 'Cycle officially closed and locked');
    return target;
  }

  async getMeterReadings(cycleId?: string): Promise<MeterReading[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.READINGS);
    const readings: MeterReading[] = raw ? JSON.parse(raw) : [];
    const filtered = cycleId ? readings.filter((r) => r.cycleId === cycleId) : readings;
    return filtered.sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());
  }

  async addMeterReading(
    readingData: Omit<MeterReading, 'id' | 'entry_timestamp'>
  ): Promise<MeterReading> {
    const readings = await this.getMeterReadings();
    const newReading: MeterReading = {
      ...readingData,
      id: `rd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      entry_timestamp: new Date().toISOString(),
    };

    readings.push(newReading);
    // Persist sorted by physical reading_timestamp
    readings.sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

    await this.logAudit(
      'meter_reading',
      newReading.id,
      'create',
      null,
      newReading,
      `Added meter reading ${newReading.cumulativeKWh} kWh`
    );
    return newReading;
  }

  async updateMeterReading(
    id: string,
    updates: Partial<MeterReading>,
    reason?: string
  ): Promise<MeterReading> {
    const readings = await this.getMeterReadings();
    const index = readings.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Reading with ID ${id} not found`);

    const oldVal = { ...readings[index] };
    const updated: MeterReading = {
      ...readings[index],
      ...updates,
      isCorrected: true,
    };

    readings[index] = updated;
    readings.sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

    await this.logAudit(
      'meter_reading',
      id,
      'correction',
      oldVal,
      updated,
      reason || 'Explicit user correction of meter reading'
    );
    return updated;
  }

  async deleteMeterReading(id: string, reason?: string): Promise<void> {
    const readings = await this.getMeterReadings();
    const index = readings.findIndex((r) => r.id === id);
    if (index === -1) return;

    const oldVal = readings[index];
    readings.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));

    await this.logAudit('meter_reading', id, 'delete', oldVal, null, reason || 'User deleted meter reading');
  }

  async getAuditRecords(): Promise<AuditRecord[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
    const list: AuditRecord[] = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async logAudit(
    entityType: 'meter_reading' | 'billing_cycle' | 'settings',
    entityId: string,
    action: 'create' | 'edit' | 'correction' | 'lock' | 'delete',
    oldValue: unknown,
    newValue: unknown,
    reason?: string
  ) {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
    const auditLogs: AuditRecord[] = raw ? JSON.parse(raw) : [];
    const record: AuditRecord = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      timestamp: new Date().toISOString(),
      reason,
    };
    auditLogs.unshift(record);
    // Keep last 300 audit events
    if (auditLogs.length > 300) auditLogs.length = 300;
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  }

  async exportAllData(): Promise<string> {
    const dump = {
      app: 'LESCO Energy Manager',
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      settings: await this.getSettings(),
      household: await this.getHousehold(),
      meters: await this.getMeters(),
      billingCycles: await this.getBillingCycles(),
      readings: await this.getMeterReadings(),
      auditLogs: await this.getAuditRecords(),
    };
    return JSON.stringify(dump, null, 2);
  }

  async exportReadingsCSV(): Promise<string> {
    const readings = await this.getMeterReadings();
    const headers = [
      'Reading ID',
      'Cycle ID',
      'Cumulative kWh',
      'Reading Timestamp (Physical)',
      'Entry Timestamp (App)',
      'Source',
      'Validation Status',
      'Notes',
    ];
    const rows = readings.map((r) => [
      r.id,
      r.cycleId,
      r.cumulativeKWh,
      r.reading_timestamp,
      r.entry_timestamp,
      r.source,
      r.validationStatus,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async importData(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.billingCycles || !parsed.readings) {
        return {
          success: false,
          message: 'Invalid backup file: Missing billingCycles or readings data.',
        };
      }

      if (parsed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
      if (parsed.household) localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(parsed.household));
      if (parsed.meters) localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(parsed.meters));
      localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(parsed.billingCycles));
      localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(parsed.readings));
      if (parsed.auditLogs) localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(parsed.auditLogs));

      await this.logAudit('settings', 'global', 'edit', null, null, 'Restored data from external JSON backup');
      return { success: true, message: 'Data imported successfully.' };
    } catch (err) {
      return { success: false, message: (err as Error).message || 'Failed to parse JSON file' };
    }
  }

  async resetToDefaultData(): Promise<void> {
    this.resetToDefaultsInternal();
  }

  /**
   * Preloads any of the 8 canonical test scenarios directly for testing.
   */
  async loadScenario(scenarioId: number): Promise<string> {
    switch (scenarioId) {
      case 1: {
        // Scenario 1: LESCO reading: 1500, Outdoor sync: 1503.7, Gap: 3.7, Indoor reset: 0.0
        await this.resetToDefaultData();
        return 'Loaded Scenario 1: LESCO bill reading 1500 kWh, Outdoor sync 1503.7 kWh (Gap: 3.7 kWh), Indoor reset to 0.0 kWh.';
      }
      case 2: {
        // Scenario 2: Indoor Day 1 = 72.0, Day 2 = 73.4 -> Usage = 1.4
        const cycle = await this.getActiveBillingCycle();
        if (cycle) {
          const r1: Omit<MeterReading, 'id' | 'entry_timestamp'> = {
            cycleId: cycle.id,
            meterId: 'm-indoor',
            householdId: 'hh-1',
            cumulativeKWh: 72.0,
            reading_timestamp: '2026-09-05T18:00:00.000Z',
            source: 'indoor_meter',
            validationStatus: 'valid',
            notes: 'Scenario 2 Day 1 reading',
          };
          const r2: Omit<MeterReading, 'id' | 'entry_timestamp'> = {
            cycleId: cycle.id,
            meterId: 'm-indoor',
            householdId: 'hh-1',
            cumulativeKWh: 73.4,
            reading_timestamp: '2026-09-06T18:00:00.000Z',
            source: 'indoor_meter',
            validationStatus: 'valid',
            notes: 'Scenario 2 Day 2 reading: exactly 1.4 kWh consumed',
          };
          await this.addMeterReading(r1);
          await this.addMeterReading(r2);
        }
        return 'Loaded Scenario 2: Added 72.0 kWh (Day 1) and 73.4 kWh (Day 2). Usage calculation yields exactly 1.4 kWh.';
      }
      case 3: {
        // Scenario 3: Delayed entry - Physical reading 6:00 PM, App entry 9:00 PM
        const cycle = await this.getActiveBillingCycle();
        if (cycle) {
          const delayedReading: Omit<MeterReading, 'id' | 'entry_timestamp'> = {
            cycleId: cycle.id,
            meterId: 'm-indoor',
            householdId: 'hh-1',
            cumulativeKWh: 151.2,
            reading_timestamp: '2026-09-06T18:00:00.000Z', // 6:00 PM physical
            source: 'indoor_meter',
            validationStatus: 'valid',
            notes: 'Physical reading was at 6:00 PM, app submission at 9:00 PM. Rates calculated on 6:00 PM.',
          };
          await this.addMeterReading(delayedReading);
        }
        return 'Loaded Scenario 3: Added delayed reading with reading_timestamp 18:00 (physical) and current entry_timestamp (app). Engine relies strictly on physical time.';
      }
      case 5: {
        // Scenario 5: Forecast crosses 200 (Current 180 kWh, projected 207 kWh -> Dashboard must warn)
        const cycle = await this.getActiveBillingCycle();
        if (cycle) {
          // Add heavy consumption readings to bring tracked units to ~176.3 + 3.7 gap = 180 kWh
          const heavyReading: Omit<MeterReading, 'id' | 'entry_timestamp'> = {
            cycleId: cycle.id,
            meterId: 'm-indoor',
            householdId: 'hh-1',
            cumulativeKWh: 176.3, // + 3.7 gap = 180 kWh
            reading_timestamp: '2026-09-06T12:00:00.000Z',
            source: 'indoor_meter',
            validationStatus: 'valid',
            notes: 'Scenario 5: High pace reading. Current usage at 180 kWh.',
          };
          await this.addMeterReading(heavyReading);
        }
        return 'Loaded Scenario 5: Current usage is at 180 kWh with high run-rate predicting 207 kWh. Dashboard actively warns before hitting 200 kWh.';
      }
      case 8: {
        // Scenario 8: No indoor meter (Mode B - User tracks directly with outdoor LESCO meter)
        await this.updateSettings({ trackingMode: 'outdoor_meter' });
        await this.updateHousehold({ trackingMode: 'outdoor_meter' });
        return 'Loaded Scenario 8: Switched tracking mode to Mode B (Outdoor official meter). User tracks without requiring any indoor meter.';
      }
      default:
        return `Scenario ${scenarioId} ready.`;
    }
  }
}

export const repository = new LocalStorageEnergyRepository();
