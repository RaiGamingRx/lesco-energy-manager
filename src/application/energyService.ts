import {
  AppSettings,
  AuditRecord,
  BillingCycle,
  Household,
  Meter,
  MeterReading,
  MeterLifecycleEvent,
  OfficialBill,
  CommandContext,
} from '../types';
import { EnergyRepository } from '../storage/ports';
import { DomainOperationError } from '../storage/errors';

export interface EnergySnapshot {
  settings: AppSettings;
  household: Household;
  meters: Meter[];
  cycles: BillingCycle[];
  bills: OfficialBill[];
  readings: MeterReading[];
  lifecycleEvents: MeterLifecycleEvent[];
  auditLogs: AuditRecord[];
}

/** Application use cases. Presentation code depends on this service, not persistence. */
export class EnergyApplicationService {
  constructor(private readonly repository: EnergyRepository) {}

  async loadSnapshot(): Promise<EnergySnapshot> {
    const [settings, household, meters, cycles, bills, readings, lifecycleEvents, auditLogs] = await Promise.all([
      this.repository.getSettings(),
      this.repository.getHousehold(),
      this.repository.getMeters(),
      this.repository.getBillingCycles(),
      this.repository.getOfficialBills(),
      this.repository.getMeterReadings(),
      this.repository.getLifecycleEvents ? this.repository.getLifecycleEvents() : Promise.resolve([]),
      this.repository.getAuditRecords(),
    ]);
    return { settings, household, meters, cycles, bills, readings, lifecycleEvents, auditLogs };
  }

  createReading(reading: Omit<MeterReading, 'id' | 'entry_timestamp'>, context?: CommandContext): Promise<MeterReading> {
    return this.repository.addMeterReading(reading, context);
  }

  correctReading(id: string, updates: Partial<MeterReading>, reason?: string): Promise<MeterReading> {
    return this.repository.updateMeterReading(id, updates, reason);
  }

  removeReading(id: string, reason?: string): Promise<void> {
    return this.repository.deleteMeterReading(id, reason);
  }

  createMeterLifecycleEvent(event: Omit<MeterLifecycleEvent, 'id' | 'createdAt'>): Promise<MeterLifecycleEvent> {
    return this.repository.createMeterLifecycleEvent(event);
  }

  createLifecycleBaseline(event: Omit<MeterLifecycleEvent, 'id' | 'createdAt'>, reading: Omit<MeterReading, 'id' | 'entry_timestamp'>): Promise<{ event: MeterLifecycleEvent; reading: MeterReading }> {
    return this.repository.createLifecycleBaseline(event, reading);
  }

  createOrUpdateCycle(cycle: BillingCycle, reason?: string, context?: CommandContext): Promise<BillingCycle> {
    return this.repository.saveBillingCycle(cycle, reason, context);
  }

  createOrUpdateCycleWithOfficialBill(cycle: BillingCycle, bill: OfficialBill, reason?: string, context?: CommandContext): Promise<BillingCycle> {
    return this.repository.saveCycleWithOfficialBill(cycle, bill, reason, context);
  }

  finalizeCycle(id: string, finalData?: Partial<BillingCycle>): Promise<BillingCycle> {
    return this.repository.closeBillingCycle(id, finalData);
  }

  async synchronizeOutdoorMeter(cycle: BillingCycle, outdoorReading: number): Promise<BillingCycle> {
    if (!Number.isFinite(outdoorReading) || outdoorReading < cycle.currentOfficialReading) {
      throw new DomainOperationError('validation_failed', 'Outdoor meter reading must be valid and cannot be below the official bill reading.');
    }
    const now = new Date().toISOString();
    return this.repository.saveBillingCycle({
      ...cycle,
      syncOutdoorReading: outdoorReading,
      syncReadingTimestamp: now,
      gapUnits: Number((outdoorReading - cycle.currentOfficialReading).toFixed(2)),
      indoorResetConfirmed: true,
      updatedAt: now,
    }, `Outdoor meter sync: Reading ${outdoorReading} vs bill ${cycle.currentOfficialReading}`);
  }

  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.repository.updateSettings(settings);
  }

  updateHousehold(household: Partial<Household>): Promise<Household> {
    return this.repository.updateHousehold(household);
  }

  importValidatedData(json: string): Promise<{ success: boolean; message: string }> {
    return this.repository.importData(json);
  }

  exportData(): Promise<string> {
    return this.repository.exportAllData();
  }

  exportReadings(): Promise<string> {
    return this.repository.exportReadingsCSV();
  }

  resetDevelopmentData(): Promise<void> {
    return this.repository.resetToDefaultData();
  }

  loadDevelopmentScenario(id: number): Promise<string> {
    return this.repository.loadScenario(id);
  }
}
