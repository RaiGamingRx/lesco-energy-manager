import {
  AppSettings,
  Account,
  AuditRecord,
  BillingCycle,
  Household,
  HouseholdMembership,
  CommandContext,
  LescoConnection,
  Meter,
  MeterLifecycleEvent,
  MeterReading,
  OfficialBill,
} from '../types';

export interface PersistenceState {
  accounts: Account[];
  memberships: HouseholdMembership[];
  settings: AppSettings;
  /** Transitional local singleton; future canonical ownership is Account -> HouseholdMembership -> Household. */
  household: Household;
  connections: LescoConnection[];
  meters: Meter[];
  cycles: BillingCycle[];
  bills: OfficialBill[];
  readings: MeterReading[];
  lifecycleEvents: MeterLifecycleEvent[];
  auditLogs: AuditRecord[];
}

export interface StateStore {
  load(): Promise<PersistenceState>;
  commit(nextState: PersistenceState, dataOrigin?: 'development_fixture' | 'user_data' | 'imported_data'): Promise<void>;
  reset(): Promise<void>;
}

export interface EnergyRepository {
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
  getHousehold(): Promise<Household>;
  updateHousehold(household: Partial<Household>): Promise<Household>;
  getMeters(): Promise<Meter[]>;
  getBillingCycles(): Promise<BillingCycle[]>;
  getOfficialBills(): Promise<OfficialBill[]>;
  getActiveBillingCycle(): Promise<BillingCycle | null>;
  saveBillingCycle(cycle: BillingCycle, auditReason?: string, context?: CommandContext): Promise<BillingCycle>;
  saveCycleWithOfficialBill(cycle: BillingCycle, bill: OfficialBill, auditReason?: string, context?: CommandContext): Promise<BillingCycle>;
  closeBillingCycle(cycleId: string, finalData?: Partial<BillingCycle>): Promise<BillingCycle>;
  getMeterReadings(cycleId?: string): Promise<MeterReading[]>;
  getLifecycleEvents?(): Promise<MeterLifecycleEvent[]>;
  addMeterReading(reading: Omit<MeterReading, 'id' | 'entry_timestamp'>, context?: CommandContext): Promise<MeterReading>;
  updateMeterReading(id: string, updates: Partial<MeterReading>, reason?: string): Promise<MeterReading>;
  deleteMeterReading(id: string, reason?: string): Promise<void>;
  createMeterLifecycleEvent(event: Omit<MeterLifecycleEvent, 'id' | 'createdAt'>): Promise<MeterLifecycleEvent>;
  createLifecycleBaseline(event: Omit<MeterLifecycleEvent, 'id' | 'createdAt'>, reading: Omit<MeterReading, 'id' | 'entry_timestamp'>): Promise<{ event: MeterLifecycleEvent; reading: MeterReading }>;
  getAuditRecords(): Promise<AuditRecord[]>;
  exportAllData(): Promise<string>;
  exportReadingsCSV(): Promise<string>;
  importData(jsonData: string): Promise<{ success: boolean; message: string }>;
  resetToDefaultData(): Promise<void>;
  loadScenario(scenarioId: number): Promise<string>;
}