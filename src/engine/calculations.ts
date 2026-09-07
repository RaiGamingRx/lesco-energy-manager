import { BillingCycle, CalculationSummary, MeterLifecycleEvent, MeterReading, ThresholdStatus, TrackingMode } from '../types';

export type CalculationDataQuality = 'VALID' | 'INSUFFICIENT_DATA' | 'PARTIAL' | 'INVALID' | 'CONFLICTED' | 'UNSUPPORTED';
export type CalculationRiskStatus = 'ON_TRACK' | 'AT_RISK' | 'PROJECTED_OVER_TARGET' | 'INSUFFICIENT_DATA' | 'INVALID_DATA' | 'UNSUPPORTED';
export type CalculationIntervalStatus = 'VALID' | 'DUPLICATE' | 'BOUNDARY' | 'INVALID';
export type CalculationAnomalyCode = 'DECREASING_CUMULATIVE_READING' | 'CONFLICTING_SAME_TIME_OBSERVATION' | 'DUPLICATE_OBSERVATION' | 'ZERO_DURATION_INTERVAL' | 'NEGATIVE_DURATION_INTERVAL' | 'INVALID_TIMESTAMP' | 'MISSING_PREDECESSOR' | 'LIFECYCLE_TRANSITION_BOUNDARY' | 'UNAUTHORIZED_BASELINE' | 'UNSUPPORTED_ROLLOVER' | 'INSUFFICIENT_OBSERVATIONS' | 'INVALID_CYCLE' | 'CROSS_ENTITY_CONTAMINATION' | 'INCOMPLETE_INTERVAL_SEQUENCE' | 'INVALID_NUMERIC_VALUE' | 'INVALID_TARGET' | 'INCONSISTENT_GAP';

export interface CalculationAnomaly { code: CalculationAnomalyCode; readingIds?: string[]; lifecycleEventId?: string; detail?: string }
export interface CalculationInterval {
  previousReadingId?: string;
  currentReadingId: string;
  previousReading?: number;
  currentReading: number;
  previousReadingAt?: string;
  currentReadingAt: string;
  elapsedDays?: number;
  consumptionKwh?: number;
  status: CalculationIntervalStatus;
  lifecycleEventId?: string;
}
export interface CalculationScope { householdId: string; meterId: string; cycleId: string }
export interface CalculationOptions { asOf: string; scope?: CalculationScope; lifecycleEvents?: MeterLifecycleEvent[]; targetKwh?: number }
export interface MeterCalculationResult {
  scope?: CalculationScope;
  actualConsumptionKwh: number;
  currentCumulativeKwh?: number;
  observedRateKwhPerDay?: number;
  dataQuality: CalculationDataQuality;
  validIntervalCount: number;
  invalidIntervalCount: number;
  intervals: CalculationInterval[];
  anomalies: CalculationAnomaly[];
}
export interface CycleCalculationResult extends MeterCalculationResult {
  cycleId: string;
  targetKwh?: number;
  targetProgressPercent?: number;
  remainingTargetKwh?: number;
  targetOverrunKwh?: number;
  projectedEndCycleKwh?: number;
  projectedOverrunKwh?: number;
  elapsedCyclePercent?: number;
  remainingCyclePercent?: number;
  totalCycleDays?: number;
  elapsedCycleDays?: number;
  remainingCycleDays?: number;
  riskStatus: CalculationRiskStatus;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_REFERENCE_TIME = '1970-01-01T00:00:00.000Z';
const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value);
const round = (value: number, digits = 2): number => { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; };
const makeAnomaly = (code: CalculationAnomalyCode, detail?: string, readingIds?: string[], lifecycleEventId?: string): CalculationAnomaly => ({ code, ...(detail ? { detail } : {}), ...(readingIds ? { readingIds } : {}), ...(lifecycleEventId ? { lifecycleEventId } : {}) });

function authorizedBoundary(reading: MeterReading, events: MeterLifecycleEvent[]): MeterLifecycleEvent | undefined {
  if (!reading.isBaseline || !reading.lifecycleEventId) return undefined;
  return events.find((event) => event.id === reading.lifecycleEventId && (event.type === 'reset' || event.type === 'replaced') && event.meterId === reading.meterId && event.connectionId === reading.connectionId && event.householdId === reading.householdId && Date.parse(event.occurredAt) <= Date.parse(reading.reading_timestamp) && event.baselineReading === reading.cumulativeKWh);
}

function canonicalReadings(readings: MeterReading[], scope: CalculationScope | undefined, asOf: number): { readings: MeterReading[]; anomalies: CalculationAnomaly[] } {
  const scoped = scope ? readings.filter((reading) => reading.householdId === scope.householdId && reading.meterId === scope.meterId && reading.cycleId === scope.cycleId) : [...readings];
  const anomalies = scope && scoped.length !== readings.length ? [makeAnomaly('CROSS_ENTITY_CONTAMINATION')] : [];
  const eligible = scoped.filter((reading) => !Number.isFinite(asOf) || Date.parse(reading.reading_timestamp) <= asOf);
  return { readings: [...eligible].sort((left, right) => Date.parse(left.reading_timestamp) - Date.parse(right.reading_timestamp) || left.id.localeCompare(right.id)), anomalies };
}

/** Authoritative, deterministic cumulative-meter calculation. */
export function calculateMeterConsumption(readings: MeterReading[], options: CalculationOptions): MeterCalculationResult {
  const asOf = Date.parse(options.asOf);
  const { readings: sorted, anomalies } = canonicalReadings(readings, options.scope, asOf);
  const events = (options.lifecycleEvents ?? []).filter((event) => !Number.isFinite(asOf) || Date.parse(event.occurredAt) <= asOf);
  const intervals: CalculationInterval[] = [];
  let actualConsumptionKwh = 0;
  let validIntervalCount = 0;
  let invalidIntervalCount = 0;
  let sequenceBroken = false;
  const seen = new Map<string, MeterReading>();
  for (const reading of sorted) {
    const timestamp = Date.parse(reading.reading_timestamp);
    if (!finite(reading.cumulativeKWh) || reading.cumulativeKWh < 0 || !Number.isFinite(timestamp)) {
      anomalies.push(makeAnomaly(!Number.isFinite(timestamp) ? 'INVALID_TIMESTAMP' : 'INVALID_NUMERIC_VALUE', undefined, [reading.id]));
      invalidIntervalCount += 1;
      sequenceBroken = true;
      continue;
    }
    const duplicateKey = `${timestamp}:${reading.cumulativeKWh}`;
    if (seen.has(duplicateKey)) { anomalies.push(makeAnomaly('DUPLICATE_OBSERVATION', undefined, [seen.get(duplicateKey)!.id, reading.id])); continue; }
    seen.set(duplicateKey, reading);
    const sameTime = sorted.filter((candidate) => Date.parse(candidate.reading_timestamp) === timestamp && finite(candidate.cumulativeKWh));
    if (sameTime.some((candidate) => candidate.cumulativeKWh !== reading.cumulativeKWh)) {
      anomalies.push(makeAnomaly('CONFLICTING_SAME_TIME_OBSERVATION', undefined, sameTime.map((candidate) => candidate.id)));
      invalidIntervalCount += 1;
      sequenceBroken = true;
      intervals.push({ currentReadingId: reading.id, currentReading: reading.cumulativeKWh, currentReadingAt: reading.reading_timestamp, status: 'INVALID' });
      continue;
    }
    const previous = [...seen.values()].filter((candidate) => candidate.reading_timestamp < reading.reading_timestamp).at(-1);
    if (!previous) continue;
    if (sequenceBroken) {
      anomalies.push(makeAnomaly('INCOMPLETE_INTERVAL_SEQUENCE', undefined, [previous.id, reading.id]));
      sequenceBroken = false;
      continue;
    }
    const previousTime = Date.parse(previous.reading_timestamp);
    const elapsedDays = (timestamp - previousTime) / MS_PER_DAY;
    const boundary = authorizedBoundary(reading, events);
    if (boundary) {
      anomalies.push(makeAnomaly('LIFECYCLE_TRANSITION_BOUNDARY', undefined, [previous.id, reading.id], boundary.id));
      intervals.push({ previousReadingId: previous.id, currentReadingId: reading.id, previousReading: previous.cumulativeKWh, currentReading: reading.cumulativeKWh, previousReadingAt: previous.reading_timestamp, currentReadingAt: reading.reading_timestamp, elapsedDays, status: 'BOUNDARY', lifecycleEventId: boundary.id });
      continue;
    }
    if (elapsedDays <= 0) {
      anomalies.push(makeAnomaly(elapsedDays === 0 ? 'ZERO_DURATION_INTERVAL' : 'NEGATIVE_DURATION_INTERVAL', undefined, [previous.id, reading.id]));
      invalidIntervalCount += 1;
      sequenceBroken = true;
      intervals.push({ previousReadingId: previous.id, currentReadingId: reading.id, previousReading: previous.cumulativeKWh, currentReading: reading.cumulativeKWh, previousReadingAt: previous.reading_timestamp, currentReadingAt: reading.reading_timestamp, elapsedDays, status: 'INVALID' });
      continue;
    }
    const consumptionKwh = reading.cumulativeKWh - previous.cumulativeKWh;
    if (consumptionKwh < 0) {
      anomalies.push(makeAnomaly('DECREASING_CUMULATIVE_READING', undefined, [previous.id, reading.id]));
      invalidIntervalCount += 1;
      sequenceBroken = true;
      intervals.push({ previousReadingId: previous.id, currentReadingId: reading.id, previousReading: previous.cumulativeKWh, currentReading: reading.cumulativeKWh, previousReadingAt: previous.reading_timestamp, currentReadingAt: reading.reading_timestamp, elapsedDays, status: 'INVALID' });
      continue;
    }
    actualConsumptionKwh += consumptionKwh;
    validIntervalCount += 1;
    intervals.push({ previousReadingId: previous.id, currentReadingId: reading.id, previousReading: previous.cumulativeKWh, currentReading: reading.cumulativeKWh, previousReadingAt: previous.reading_timestamp, currentReadingAt: reading.reading_timestamp, elapsedDays, consumptionKwh, status: 'VALID' });
  }
  if (sorted.length === 1) anomalies.push(makeAnomaly('INSUFFICIENT_OBSERVATIONS', undefined, [sorted[0].id]));
  if (sorted.some((reading) => reading.isBaseline && !authorizedBoundary(reading, events))) anomalies.push(makeAnomaly('UNAUTHORIZED_BASELINE'));
  if (events.some((event) => event.type === 'rollover')) anomalies.push(makeAnomaly('UNSUPPORTED_ROLLOVER'));
  const hasConflict = anomalies.some((item) => item.code === 'CONFLICTING_SAME_TIME_OBSERVATION');
  const hasUnsupported = anomalies.some((item) => item.code === 'UNSUPPORTED_ROLLOVER');
  const hasInvalid = invalidIntervalCount > 0 || anomalies.some((item) => ['DECREASING_CUMULATIVE_READING', 'INVALID_TIMESTAMP', 'INVALID_NUMERIC_VALUE', 'UNAUTHORIZED_BASELINE', 'UNSUPPORTED_ROLLOVER'].includes(item.code));
  const dataQuality: CalculationDataQuality = hasConflict ? 'CONFLICTED' : hasUnsupported ? 'UNSUPPORTED' : hasInvalid && validIntervalCount > 0 ? 'PARTIAL' : hasInvalid ? 'INVALID' : validIntervalCount === 0 ? 'INSUFFICIENT_DATA' : 'VALID';
  const elapsedDays = intervals.filter((item) => item.status === 'VALID' && item.elapsedDays !== undefined).reduce((total, item) => total + item.elapsedDays!, 0);
  return { scope: options.scope, actualConsumptionKwh: round(actualConsumptionKwh), currentCumulativeKwh: sorted.at(-1)?.cumulativeKWh, observedRateKwhPerDay: elapsedDays > 0 && validIntervalCount > 0 ? actualConsumptionKwh / elapsedDays : undefined, dataQuality, validIntervalCount, invalidIntervalCount, intervals, anomalies };
}

export function calculateCycleResult(cycle: BillingCycle, readings: MeterReading[], options: CalculationOptions): CycleCalculationResult {
  const start = Date.parse(`${cycle.billingPeriodStart}T00:00:00.000Z`);
  const end = Date.parse(`${cycle.billingPeriodEnd}T00:00:00.000Z`) + MS_PER_DAY;
  const asOf = Date.parse(options.asOf);
  const result = calculateMeterConsumption(readings, options);
  const anomalies = [...result.anomalies];
  if (finite(cycle.syncOutdoorReading) && finite(cycle.currentOfficialReading) && cycle.syncOutdoorReading < cycle.currentOfficialReading) anomalies.push(makeAnomaly('INCONSISTENT_GAP'));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) anomalies.push(makeAnomaly('INVALID_CYCLE'));
  if (!Number.isFinite(asOf)) anomalies.push(makeAnomaly('INVALID_TIMESTAMP'));
  const totalCycleDays = Number.isFinite(start) && Number.isFinite(end) ? (end - start) / MS_PER_DAY : undefined;
  const elapsedCycleDays = totalCycleDays === undefined ? undefined : Math.max(0, Math.min(totalCycleDays, (asOf - start) / MS_PER_DAY));
  const remainingCycleDays = totalCycleDays === undefined || elapsedCycleDays === undefined ? undefined : Math.max(0, totalCycleDays - elapsedCycleDays);
  const targetKwh = options.targetKwh;
  const targetValid = targetKwh === undefined || (finite(targetKwh) && targetKwh >= 0);
  if (!targetValid) anomalies.push(makeAnomaly('INVALID_TARGET'));
  const targetProgressPercent = targetValid && targetKwh !== undefined && targetKwh > 0 ? (result.actualConsumptionKwh / targetKwh) * 100 : undefined;
  const remainingTargetKwh = targetValid && targetKwh !== undefined ? Math.max(0, targetKwh - result.actualConsumptionKwh) : undefined;
  const targetOverrunKwh = targetValid && targetKwh !== undefined ? Math.max(0, result.actualConsumptionKwh - targetKwh) : undefined;
  const canProject = result.dataQuality === 'VALID' && result.observedRateKwhPerDay !== undefined && remainingCycleDays !== undefined;
  const projectedEndCycleKwh = canProject ? result.actualConsumptionKwh + result.observedRateKwhPerDay! * remainingCycleDays : undefined;
  const projectedOverrunKwh = projectedEndCycleKwh !== undefined && targetKwh !== undefined && targetValid ? Math.max(0, projectedEndCycleKwh - targetKwh) : undefined;
  let riskStatus: CalculationRiskStatus = 'INSUFFICIENT_DATA';
  if (result.dataQuality === 'UNSUPPORTED') riskStatus = 'UNSUPPORTED';
  else if (result.dataQuality === 'INVALID' || result.dataQuality === 'CONFLICTED' || result.dataQuality === 'PARTIAL') riskStatus = 'INVALID_DATA';
  else if (projectedOverrunKwh !== undefined && projectedOverrunKwh > 0) riskStatus = 'PROJECTED_OVER_TARGET';
  else if (targetOverrunKwh !== undefined && targetOverrunKwh > 0) riskStatus = 'AT_RISK';
  else if (result.dataQuality === 'VALID') riskStatus = 'ON_TRACK';
  const quality = anomalies.some((item) => item.code === 'INVALID_CYCLE') ? 'INVALID' : anomalies.some((item) => item.code === 'UNSUPPORTED_ROLLOVER') ? 'UNSUPPORTED' : anomalies.some((item) => item.code === 'INCONSISTENT_GAP') && result.dataQuality === 'VALID' ? 'PARTIAL' : result.dataQuality;
  return { ...result, cycleId: cycle.id, targetKwh, targetProgressPercent, remainingTargetKwh, targetOverrunKwh, projectedEndCycleKwh, projectedOverrunKwh, elapsedCyclePercent: totalCycleDays && elapsedCycleDays !== undefined ? (elapsedCycleDays / totalCycleDays) * 100 : undefined, remainingCyclePercent: totalCycleDays && remainingCycleDays !== undefined ? (remainingCycleDays / totalCycleDays) * 100 : undefined, totalCycleDays, elapsedCycleDays, remainingCycleDays, dataQuality: quality, anomalies, riskStatus };
}

/** Compatibility adapter for the original reading-list consumer. */
export function calculateConsumption(readings: MeterReading[]): { processedReadings: MeterReading[]; totalTrackedUnits: number; isValid: boolean; error?: string } {
  const first = readings[0];
  const scope = first ? { householdId: first.householdId, meterId: first.meterId, cycleId: first.cycleId } : undefined;
  const latestTimestamp = readings.reduce((latest, reading) => Date.parse(reading.reading_timestamp) > Date.parse(latest) ? reading.reading_timestamp : latest, first?.reading_timestamp ?? DEFAULT_REFERENCE_TIME);
  const result = calculateMeterConsumption(readings, { asOf: latestTimestamp, scope });
  const validById = new Map(result.intervals.filter((interval) => interval.status === 'VALID').map((interval) => [interval.currentReadingId, interval]));
  const processedReadings = [...readings].filter((reading) => !scope || (reading.householdId === scope.householdId && reading.meterId === scope.meterId && reading.cycleId === scope.cycleId)).sort((left, right) => Date.parse(left.reading_timestamp) - Date.parse(right.reading_timestamp) || left.id.localeCompare(right.id)).map((reading) => { const interval = validById.get(reading.id); return { ...reading, consumptionFromPrevious: interval?.consumptionKwh ?? (interval ? 0 : undefined), intervalHours: interval?.elapsedDays === undefined ? undefined : interval.elapsedDays * 24 }; });
  const error = result.anomalies.find((item) => !['DUPLICATE_OBSERVATION', 'CROSS_ENTITY_CONTAMINATION'].includes(item.code));
  return { processedReadings, totalTrackedUnits: result.actualConsumptionKwh, isValid: result.dataQuality === 'VALID' || result.dataQuality === 'INSUFFICIENT_DATA', ...(error ? { error: error.code } : {}) };
}

export function calculateGapUnits(outdoorSyncReading: number | undefined, currentOfficialReading: number | undefined): number { return !finite(outdoorSyncReading) || !finite(currentOfficialReading) || outdoorSyncReading < currentOfficialReading ? 0 : round(outdoorSyncReading - currentOfficialReading); }
export function calculateRemainingUnits(currentUsage: number, target: number): number { return !finite(currentUsage) || !finite(target) ? 0 : round(target - currentUsage); }
export function calculateDailyAllowance(remainingUnits: number, daysRemaining: number): number { return finite(remainingUnits) && finite(daysRemaining) && daysRemaining > 0 && remainingUnits > 0 ? round(remainingUnits / daysRemaining) : 0; }

/** Legacy presentation adapter. Regulatory or tariff status is intentionally absent. */
export function calculateThresholdRisk(usage: number, _officialCeiling = 200, personalTarget = 190): ThresholdStatus { return usage >= personalTarget ? { zone: 'very_close', label: 'TARGET REACHED', colorClass: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', description: `Personal management target of ${personalTarget} kWh has been reached.` } : { zone: 'on_track', label: 'ON TRACK', colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', description: `Usage is below the personal management target of ${personalTarget} kWh.` }; }

export function calculateCycleSummary(cycle: BillingCycle | null, readings: MeterReading[], trackingMode: TrackingMode = 'indoor_cumulative', officialCeiling = 200, personalTarget = 190, asOf?: string, scope?: CalculationScope, lifecycleEvents: MeterLifecycleEvent[] = []): CalculationSummary {
  const cycleReadings = cycle ? readings.filter((reading) => reading.cycleId === cycle.id) : [];
  const referenceTime = asOf ?? cycleReadings.at(-1)?.reading_timestamp ?? cycle?.officialReadingDate ?? DEFAULT_REFERENCE_TIME;
  const meterResult = cycle ? calculateMeterConsumption(cycleReadings, { asOf: referenceTime, scope, lifecycleEvents }) : undefined;
  const gapUnits = calculateGapUnits(cycle?.syncOutdoorReading, cycle?.currentOfficialReading);
  const estimatedCycleUnits = gapUnits + (meterResult?.actualConsumptionKwh ?? 0);
  const result = cycle ? calculateCycleResult(cycle, cycleReadings, { asOf: referenceTime, targetKwh: personalTarget, scope, lifecycleEvents }) : undefined;
  const daysInCycle = result?.totalCycleDays ?? 30; const daysElapsed = result?.elapsedCycleDays ?? 0; const daysRemaining = result?.remainingCycleDays ?? daysInCycle; const currentDailyAverage = result?.observedRateKwhPerDay ?? 0; const projectedFinalUsage = result?.projectedEndCycleKwh ?? estimatedCycleUnits; const quality = result?.dataQuality ?? 'INSUFFICIENT_DATA';
  return { cycleId: cycle?.id ?? '', totalTrackedUnits: meterResult?.actualConsumptionKwh ?? 0, gapUnits, currentEstimatedCycleUnits: round(estimatedCycleUnits), officialCeiling, personalTarget, remainingUnitsOfficial: calculateRemainingUnits(estimatedCycleUnits, officialCeiling), remainingUnitsPersonal: calculateRemainingUnits(estimatedCycleUnits, personalTarget), daysInCycle: Math.max(1, round(daysInCycle)), daysElapsed: round(daysElapsed, 1), daysRemaining: Math.max(0, round(daysRemaining)), currentDailyAverage: round(currentDailyAverage), recentDailyAverage: round(currentDailyAverage), safeDailyAllowanceOfficial: calculateDailyAllowance(officialCeiling - estimatedCycleUnits, daysRemaining), safeDailyAllowancePersonal: calculateDailyAllowance(personalTarget - estimatedCycleUnits, daysRemaining), projectedFinalUsage: round(projectedFinalUsage, 1), forecastConfidence: result?.observedRateKwhPerDay !== undefined ? 'medium' : 'limited_data', forecastMethod: 'cycle_average', paceDifferencePerDay: round(currentDailyAverage - calculateDailyAllowance(personalTarget - estimatedCycleUnits, daysRemaining)), status: calculateThresholdRisk(estimatedCycleUnits, officialCeiling, personalTarget), dataQuality: quality === 'VALID' || quality === 'INSUFFICIENT_DATA' ? 'valid' : 'invalid', dataQualityMessage: result?.anomalies[0]?.code, currentUsage: round(estimatedCycleUnits), projectedUsage: round(projectedFinalUsage, 1), projectedRisk: calculateThresholdRisk(projectedFinalUsage, officialCeiling, personalTarget) };
}

export function getRecommendedReadingTime(readings: MeterReading[], preferredTime = '18:00', asOf = DEFAULT_REFERENCE_TIME): { recommendationText: string; isTodayRecorded: boolean; targetDateTime: string } {
  const now = new Date(asOf); const [prefHour, prefMin] = preferredTime.split(':').map((value) => parseInt(value, 10) || 0); const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime(); const todayEnd = todayStart + MS_PER_DAY; const isTodayRecorded = readings.some((reading) => { const time = Date.parse(reading.reading_timestamp); return time >= todayStart && time < todayEnd; }); const target = new Date(now); if (isTodayRecorded) target.setUTCDate(target.getUTCDate() + 1); target.setUTCHours(prefHour, prefMin, 0, 0); return { recommendationText: isTodayRecorded ? `Tomorrow around ${formatHourAmPm(prefHour, prefMin)}` : now.getTime() > target.getTime() ? 'Today as soon as convenient' : `Today around ${formatHourAmPm(prefHour, prefMin)}`, isTodayRecorded, targetDateTime: target.toISOString() };
}
function formatHourAmPm(hour: number, min: number): string { const period = hour >= 12 ? 'PM' : 'AM'; const h12 = hour % 12 === 0 ? 12 : hour % 12; return `${h12}:${min.toString().padStart(2, '0')} ${period}`; }