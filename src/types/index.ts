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

export interface LescoConnection {
  id: string;
  householdId: string;
  provider: 'LESCO';
  referenceNumber: string;
  createdAt: string;
  isActive: boolean;
}

export interface OfficialBill {
  id: string;
  householdId: string;
  connectionId: string;
  billingCycleId: string;
  provider: Provider;
  billReference: string;
  issuedOn: string;
  dueOn?: string;
  previousReading: number;
  currentReading: number;
  billedUnits: number;
  amount: number;
  charges: BillCharges;
  source: 'user_entered' | 'provider_import';
  createdAt: string;
  finalizedAt?: string;
}

export interface MeterLifecycleEvent {
  id: string;
  meterId: string;
  householdId: string;
  type: MeterLifecycleEventType;
  occurredAt: string;
  previousMeterId?: string;
  baselineReading?: number;
  reason?: string;
  createdAt: string;
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
  id: string;
  name: string;
  provider: Provider;
  referenceNumber: string; // LESCO 14-digit reference
  trackingMode: TrackingMode;
  address?: string;
  createdAt: string;
  connectionIds?: string[];
}

export interface Meter {
  id: string;
  householdId: string;
  name: string;
  type: 'outdoor_lesco_digital' | 'indoor_cumulative_protector' | 'manual_counter';
  unit: 'kWh';
  serialNumber?: string;
  isIndoorResetSupported: boolean;
  isActive?: boolean;
  installedAt?: string;
  retiredAt?: string;
  lifecycleEventIds?: string[];
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
  provider: Provider;
  tariffCategory: TariffCategory;
  billingPeriodStart: string; // ISO Date YYYY-MM-DD
  billingPeriodEnd: string;   // ISO Date YYYY-MM-DD
  officialReadingDate: string; // Actual date LESCO meter reader logged
  previousOfficialReading: number; // kWh
  currentOfficialReading: number;  // kWh
  billedUnits: number; // Official units
  billAmount: number;  // PKR
  status: CycleStatus;
  
  // Outdoor sync & gap units
  syncOutdoorReading?: number; // Reading at time user received bill and checked outdoor meter
  syncReadingTimestamp?: string; // ISO datetime
  gapUnits?: number; // syncOutdoorReading - currentOfficialReading
  indoorResetConfirmed?: boolean;
  
  billReference?: string;
  applicableCharges: BillCharges;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  connectionId?: string;
  officialReadingSource?: ReadingSource;
}

export interface MeterReading {
  id: string;
  cycleId: string;
  meterId: string;
  householdId: string;
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
}

export interface AuditRecord {
  id: string;
  entityType: 'meter_reading' | 'billing_cycle' | 'meter_lifecycle_event' | 'settings';
  entityId: string;
  action: 'create' | 'edit' | 'correction' | 'lock' | 'delete';
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  reason?: string;
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
