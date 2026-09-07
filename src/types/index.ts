/**
 * LESCO Energy Manager Domain Models & Types
 * Designed with strict separation of data sources:
 * - Official LESCO bill data
 * - User-entered meter readings
 * - Calculated consumption
 * - Estimated current-cycle consumption
 * - Forecast / projected consumption
 */

export type TrackingMode = 'indoor_cumulative' | 'outdoor_meter' | 'manual_usage';

export type Provider = 'LESCO' | 'GEPCO' | 'FESCO' | 'IESCO' | 'MEPCO' | 'K-Electric';

export type TariffCategory = 'domestic_protected' | 'domestic_unprotected' | 'commercial';

export type CycleStatus = 'draft' | 'active' | 'closed' | 'locked';

export type ReadingSource = 'indoor_meter' | 'outdoor_meter' | 'manual';

export type MeterLifecycleEventType = 'installed' | 'replaced' | 'reset' | 'rollover';

export type DataAuthority = 'client_proposed' | 'local_user_data' | 'imported_data' | 'server_authoritative';
export type RevisionStatus = 'active' | 'finalized' | 'superseded';
export type OfficialBillSource = 'user_entered' | 'provider_import' | 'ocr_proposed';
export type OfficialBillExtractionState = 'not_applicable' | 'proposed' | 'verified' | 'rejected';

export interface Account {
  id: string;
  email?: string;
  displayName?: string;
  createdAt: string;
}

export type HouseholdRole = 'owner' | 'member' | 'viewer';

export interface HouseholdMembership {
  id: string;
  householdId: string;
  accountId: string;
  role: HouseholdRole;
  createdAt: string;
  revokedAt?: string;
}

export interface LescoConnection {
  id: string;
  householdId: string;
  provider: Provider;
  referenceNumber: string;
  createdAt: string;
  isActive: boolean;
  version?: number;
}

export type Connection = LescoConnection;

export interface OfficialBill {
  id: string;
  householdId: string;
  connectionId: string;
  billingCycleId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  provider: Provider;
  billReference: string;
  issuedOn: string;
  dueOn?: string;
  previousReading: number;
  currentReading: number;
  billedUnits: number;
  amount: number;
  charges: BillCharges;
  source: OfficialBillSource;
  extractionState: OfficialBillExtractionState;
  confirmedByAccountId?: string;
  confirmedAt?: string;
  documentReference?: string;
  provenance?: string;
  createdAt: string;
  finalizedAt?: string;
  version?: number;
  revisionStatus?: RevisionStatus;
}

export interface MeterLifecycleEvent {
  id: string;
  meterId: string;
  householdId: string;
  connectionId: string;
  type: MeterLifecycleEventType;
  occurredAt: string;
  previousMeterId?: string;
  baselineReading?: number;
  reason?: string;
  createdAt: string;
  version?: number;
}

export interface ReadingCorrection {
  correctedAt: string;
  correctedBy?: string;
  reason: string;
  previousValue: number;
  previousReadingTimestamp: string;
}

export type ValidationStatus = 'valid' | 'warning' | 'error';

export type DataOrigin = 'official' | 'calculated' | 'estimated' | 'user_entered';

export interface Household {
  /** Transitional local singleton representation. The future canonical model is Account -> HouseholdMembership -> Household. */
  id: string;
  name: string;
  provider: Provider;
  referenceNumber: string; // LESCO 14-digit reference
  trackingMode: TrackingMode;
  address?: string;
  createdAt: string;
  connectionIds?: string[];
  version?: number;
}

export interface Meter {
  id: string;
  householdId: string;
  connectionId: string;
  name: string;
  type: 'outdoor_lesco_digital' | 'indoor_cumulative_protector' | 'manual_counter';
  unit: 'kWh';
  serialNumber?: string;
  isIndoorResetSupported: boolean;
  isActive?: boolean;
  installedAt?: string;
  retiredAt?: string;
  lifecycleEventIds?: string[];
  version?: number;
}

export interface BillCharges {
  tariffRatePerUnit: number;
  electricityDuty: number;
  tvFee: number;
  fca: number; // Fuel charges adjustment
  gst: number;
  fpa: number; // Financing cost surcharge / FPA
  otherCharges: number;
}

export interface BillingCycle {
  id: string;
  householdId: string;
  connectionId: string;
  meterId: string;
  provider: Provider;
  tariffCategory: TariffCategory;
  billingPeriodStart: string; // ISO Date YYYY-MM-DD
  billingPeriodEnd: string;   // ISO Date YYYY-MM-DD
  officialReadingDate: string; // Actual date LESCO meter reader logged
  /** @deprecated Transitional local projection; authoritative provider facts belong to OfficialBill. */
  previousOfficialReading: number;
  /** @deprecated Transitional local projection; authoritative provider facts belong to OfficialBill. */
  currentOfficialReading: number;
  /** @deprecated Transitional local projection; authoritative provider facts belong to OfficialBill. */
  billedUnits: number;
  /** @deprecated Transitional local projection; authoritative provider facts belong to OfficialBill. */
  billAmount: number;
  status: CycleStatus;
  
  // Outdoor sync & gap units
  syncOutdoorReading?: number; // Reading at time user received bill and checked outdoor meter
  syncReadingTimestamp?: string; // ISO datetime
  gapUnits?: number; // syncOutdoorReading - currentOfficialReading
  indoorResetConfirmed?: boolean;
  
  /** @deprecated Transitional local projection; use OfficialBill.billReference. */
  billReference?: string;
  /** @deprecated Transitional local projection; use OfficialBill.charges. */
  applicableCharges: BillCharges;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  officialReadingSource?: ReadingSource;
  officialBillId?: string;
  version?: number;
  revisionStatus?: RevisionStatus;
  /** Transitional local projection; authoritative bill facts belong to OfficialBill. */
  legacyBillProjection?: {
    previousReading: number;
    currentReading: number;
    billedUnits: number;
    amount: number;
    reference?: string;
  };
}

export interface MeterReading {
  id: string;
  cycleId: string;
  meterId: string;
  householdId: string;
  connectionId: string;
  cumulativeKWh: number;
  reading_timestamp: string; // Actual time user read meter
  entry_timestamp: string;   // Time user submitted in app
  source: ReadingSource;
  notes?: string;
  validationStatus: ValidationStatus;
  validationMessage?: string;
  
  // Calculated metadata derived from reading sequence
  consumptionFromPrevious?: number;
  intervalHours?: number;
  isCorrected?: boolean;
  isBaseline?: boolean;
  lifecycleEventId?: string;
  correctionHistory?: ReadingCorrection[];
  authority?: DataAuthority;
  version?: number;
  revisionStatus?: RevisionStatus;
}

export interface AuditRecord {
  id: string;
  entityType: 'meter_reading' | 'billing_cycle' | 'official_bill' | 'meter_lifecycle_event' | 'settings';
  entityId: string;
  action: 'create' | 'edit' | 'correction' | 'lock' | 'delete';
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  reason?: string;
  actorAccountId?: string;
  householdId?: string;
  correlationId?: string;
  /** Future server-contract metadata only; local storage does not deduplicate commands. */
  idempotencyKey?: string;
  entityVersion?: number;
  authority?: DataAuthority;
}

export interface CommandContext {
  actorAccountId?: string;
  householdId?: string;
  correlationId?: string;
  /** Future server contract; local storage records this metadata but does not provide distributed idempotency. */
  idempotencyKey?: string;
  /** Future server contract; local storage only checks this on supported billing-cycle writes. */
  expectedVersion?: number;
  authoritativeAt?: string;
}

export interface RevisionConflict {
  entityType: string;
  entityId: string;
  expectedVersion: number;
  actualVersion: number;
}

export interface AppSettings {
  householdName: string;
  provider: Provider;
  tariffCategory: TariffCategory;
  trackingMode: TrackingMode;
  referenceNumber: string;
  officialThreshold: number; // 200 kWh
  personalTarget: number;    // 190 kWh default
  cautionThreshold: number;  // 180 kWh
  criticalThreshold: number; // 190 kWh
  preferredReadingTime: string; // e.g. "18:00"
  readingFrequency: 'daily' | 'bidaily' | 'weekly';
  notificationsEnabled: boolean;
  theme: 'dark' | 'light';
}

export interface ThresholdStatus {
  zone: 'on_track' | 'safety_zone' | 'very_close' | 'exceeded';
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
}

export interface CalculationSummary {
  cycleId: string;
  // Tracked units from readings
  totalTrackedUnits: number;
  // Gap units from outdoor sync
  gapUnits: number;
  // Estimated current cycle units: gapUnits + totalTrackedUnits (or latest reading - sync base)
  currentEstimatedCycleUnits: number;
  
  officialCeiling: number; // 200 kWh
  personalTarget: number;  // 190 kWh
  remainingUnitsOfficial: number;
  remainingUnitsPersonal: number;
  
  daysInCycle: number;
  daysElapsed: number;
  daysRemaining: number;
  
  currentDailyAverage: number;
  recentDailyAverage: number; // Weighted last 3-5 days
  safeDailyAllowanceOfficial: number;
  safeDailyAllowancePersonal: number;
  
  projectedFinalUsage: number;
  forecastConfidence: 'high' | 'medium' | 'limited_data';
  forecastMethod: 'recent_trend' | 'cycle_average';
  projectedThresholdCrossingDate?: string;
  paceDifferencePerDay: number; // Difference between current daily pace and safe daily allowance
  
  status: ThresholdStatus;
  dataQuality: 'valid' | 'invalid';
  dataQualityMessage?: string;
  currentUsage: number;
  projectedUsage: number;
  projectedRisk: ThresholdStatus;
}
