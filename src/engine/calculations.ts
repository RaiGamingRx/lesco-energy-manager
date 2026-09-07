import {
  BillingCycle,
  CalculationSummary,
  MeterReading,
  ThresholdStatus,
  TrackingMode,
} from '../types';

/**
 * Calculates consumption between consecutive readings sorted by reading_timestamp.
 * Crucial: Uses physical reading_timestamp, never entry_timestamp.
 */
export function calculateConsumption(readings: MeterReading[]): {
  processedReadings: MeterReading[];
  totalTrackedUnits: number;
  isValid: boolean;
  error?: string;
} {
  if (!readings || readings.length === 0) {
    return { processedReadings: [], totalTrackedUnits: 0, isValid: true };
  }

  let totalTracked = 0;
  const processed: MeterReading[] = [];
  let error: string | undefined;
  const sequences = new Map<string, MeterReading[]>();
  for (const reading of readings) {
    const key = `${reading.householdId}:${reading.meterId}:${reading.cycleId}`;
    const sequence = sequences.get(key) ?? [];
    sequence.push(reading);
    sequences.set(key, sequence);
  }

  for (const sequence of sequences.values()) {
    const sorted = sequence.sort(
      (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime() || a.id.localeCompare(b.id)
    );
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (i === 0) {
        processed.push({ ...current, consumptionFromPrevious: 0, intervalHours: 0 });
        continue;
      }
      const prev = sorted[i - 1];
      const prevTime = new Date(prev.reading_timestamp).getTime();
      const currTime = new Date(current.reading_timestamp).getTime();
      const hours = Math.max(0.01, (currTime - prevTime) / (1000 * 60 * 60));
      const delta = current.cumulativeKWh - prev.cumulativeKWh;
      if (currTime === prevTime && delta !== 0) {
        error ??= 'Invalid meter sequence: conflicting cumulative values share the same physical timestamp.';
        processed.push({ ...current, consumptionFromPrevious: undefined, intervalHours: undefined });
        continue;
      }
      if (delta < 0) {
        error ??= `Invalid meter sequence: ${current.cumulativeKWh} kWh is lower than ${prev.cumulativeKWh} kWh.`;
        processed.push({ ...current, consumptionFromPrevious: undefined, intervalHours: undefined });
        continue;
      }
      totalTracked += delta;
      processed.push({ ...current, consumptionFromPrevious: parseFloat(delta.toFixed(2)), intervalHours: parseFloat(hours.toFixed(2)) });
    }
  }

  return {
    processedReadings: processed,
    totalTrackedUnits: parseFloat(totalTracked.toFixed(2)),
    isValid: !error,
    error,
  };
}

/**
 * Gap Units = Outdoor meter reading at synchronization - Current LESCO reading from the bill
 */
export function calculateGapUnits(
  outdoorSyncReading: number | undefined,
  currentOfficialReading: number | undefined
): number {
  if (
    outdoorSyncReading === undefined ||
    currentOfficialReading === undefined ||
    isNaN(outdoorSyncReading) ||
    isNaN(currentOfficialReading)
  ) {
    return 0;
  }
  const gap = outdoorSyncReading - currentOfficialReading;
  return gap > 0 ? parseFloat(gap.toFixed(2)) : 0;
}

/**
 * Calculates remaining units before target or ceiling.
 */
export function calculateRemainingUnits(currentUsage: number, target: number): number {
  const remaining = target - currentUsage;
  return parseFloat(remaining.toFixed(2));
}

/**
 * Safe daily allowance = remaining units / days remaining.
 */
export function calculateDailyAllowance(remainingUnits: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  if (remainingUnits <= 0) return 0;
  return parseFloat((remainingUnits / daysRemaining).toFixed(2));
}

/**
 * Evaluates the status zone for the current or projected usage.
 * 0-179 -> On Track
 * 180-189 -> Safety Zone
 * 190-199 -> Very Close
 * 200+ -> Threshold Exceeded
 */
export function calculateThresholdRisk(
  usage: number,
  officialCeiling = 200,
  personalTarget = 190
): ThresholdStatus {
  if (usage >= officialCeiling) {
    return {
      zone: 'exceeded',
      label: 'THRESHOLD EXCEEDED',
      colorClass: 'text-rose-700',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      description: `Critical: Usage is at or above ${officialCeiling} kWh. Protected tariff status is lost, risking heavy surcharge rates.`,
    };
  }
  if (usage >= personalTarget) {
    return {
      zone: 'very_close',
      label: 'VERY CLOSE',
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      description: `Alert: Within ${(officialCeiling - usage).toFixed(1)} kWh of the ${officialCeiling} kWh threshold. Strict conservation recommended.`,
    };
  }
  if (usage >= 180) {
    return {
      zone: 'safety_zone',
      label: 'SAFETY ZONE',
      colorClass: 'text-blue-700',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-200',
      description: `Caution: Reached the caution buffer (180+ kWh). Keep daily pace low to stay under personal target (${personalTarget} kWh).`,
    };
  }
  return {
    zone: 'on_track',
    label: 'ON TRACK',
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    description: `Healthy: Currently pacing safely below the ${personalTarget} kWh safety target and ${officialCeiling} kWh ceiling.`,
  };
}

/**
 * Comprehensive calculation engine for an active billing cycle and its meter readings.
 */
export function calculateCycleSummary(
  cycle: BillingCycle | null,
  readings: MeterReading[],
  trackingMode: TrackingMode = 'indoor_cumulative',
  officialCeiling = 200,
  personalTarget = 190
): CalculationSummary {
  if (!cycle) {
    return {
      cycleId: '',
      totalTrackedUnits: 0,
      gapUnits: 0,
      currentEstimatedCycleUnits: 0,
      officialCeiling,
      personalTarget,
      remainingUnitsOfficial: officialCeiling,
      remainingUnitsPersonal: personalTarget,
      daysInCycle: 30,
      daysElapsed: 0,
      daysRemaining: 30,
      currentDailyAverage: 0,
      recentDailyAverage: 0,
      safeDailyAllowanceOfficial: parseFloat((officialCeiling / 30).toFixed(2)),
      safeDailyAllowancePersonal: parseFloat((personalTarget / 30).toFixed(2)),
      projectedFinalUsage: 0,
      forecastConfidence: 'limited_data',
      forecastMethod: 'cycle_average',
      paceDifferencePerDay: 0,
      status: calculateThresholdRisk(0, officialCeiling, personalTarget),
      dataQuality: 'valid',
      currentUsage: 0,
      projectedUsage: 0,
      projectedRisk: calculateThresholdRisk(0, officialCeiling, personalTarget),
    };
  }

  // 1. Calculate Gap Units from Outdoor sync
  const gapUnits = calculateGapUnits(cycle.syncOutdoorReading, cycle.currentOfficialReading);

  // 2. Calculate consumption from readings
  const cycleReadings = readings.filter((r) => r.cycleId === cycle.id);
  const { processedReadings, totalTrackedUnits, isValid, error } = calculateConsumption(cycleReadings);

  // Mode differences:
  // For indoor meter, usage in cycle = gapUnits + cumulative meter delta
  // For outdoor meter mode, usage in cycle = latest outdoor reading - currentOfficialReading from bill
  // For manual usage, totalTrackedUnits is direct
  let estimatedCycleUnits = 0;
  if (trackingMode === 'outdoor_meter') {
    if (cycleReadings.length > 0) {
      const latestReading = cycleReadings[cycleReadings.length - 1].cumulativeKWh;
      const outdoorDelta = latestReading - cycle.currentOfficialReading;
      estimatedCycleUnits = outdoorDelta;
    } else {
      estimatedCycleUnits = gapUnits;
    }
  } else {
    // Mode A: indoor cumulative or Mode C: manual
    estimatedCycleUnits = gapUnits + totalTrackedUnits;
  }
  estimatedCycleUnits = parseFloat(estimatedCycleUnits.toFixed(2));

  // 3. Billing cycle date calculations
  const startDate = new Date(cycle.billingPeriodStart).getTime();
  const endDate = new Date(cycle.billingPeriodEnd).getTime();
  const now = Date.parse(cycle.updatedAt);

  const totalCycleMs = Math.max(24 * 60 * 60 * 1000, endDate - startDate);
  const daysInCycle = Math.max(1, Math.round(totalCycleMs / (1000 * 60 * 60 * 24)));

  // Days elapsed since bill official reading or cycle start
  const refStart = cycle.officialReadingDate
    ? new Date(cycle.officialReadingDate).getTime()
    : startDate;
  const elapsedMs = Math.max(0, Math.min(now - refStart, totalCycleMs));
  const daysElapsed = Math.max(0.5, elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, Math.round((endDate - now) / (1000 * 60 * 60 * 24)));

  // 4. Daily averages
  const currentDailyAverage = parseFloat((estimatedCycleUnits / daysElapsed).toFixed(2));

  // 5. Recent daily average (Weighted last 3-5 days if available)
  let recentDailyAverage = currentDailyAverage;
  let forecastConfidence: 'high' | 'medium' | 'limited_data' = 'limited_data';
  let forecastMethod: 'recent_trend' | 'cycle_average' = 'cycle_average';

  if (processedReadings.length >= 3) {
    // Take readings in the last 4 days
    const recentThreshold = now - 4 * 24 * 60 * 60 * 1000;
    const recentReadings = processedReadings.filter(
      (r) => new Date(r.reading_timestamp).getTime() >= recentThreshold
    );

    if (recentReadings.length >= 2) {
      const firstRecent = recentReadings[0];
      const lastRecent = recentReadings[recentReadings.length - 1];
      const recentKWh = lastRecent.cumulativeKWh - firstRecent.cumulativeKWh;
      const recentHours =
        (new Date(lastRecent.reading_timestamp).getTime() -
          new Date(firstRecent.reading_timestamp).getTime()) /
        (1000 * 60 * 60);

      if (recentHours >= 12) {
        const recentPace = (recentKWh / recentHours) * 24;
        // Weight recent 65%, full cycle average 35%
        recentDailyAverage = parseFloat((recentPace * 0.65 + currentDailyAverage * 0.35).toFixed(2));
        forecastConfidence = recentHours >= 48 ? 'high' : 'medium';
        forecastMethod = 'recent_trend';
      }
    }
  }

  // 6. Safe daily allowance
  const remainingUnitsOfficial = calculateRemainingUnits(estimatedCycleUnits, officialCeiling);
  const remainingUnitsPersonal = calculateRemainingUnits(estimatedCycleUnits, personalTarget);

  const safeDailyAllowanceOfficial = calculateDailyAllowance(remainingUnitsOfficial, daysRemaining);
  const safeDailyAllowancePersonal = calculateDailyAllowance(remainingUnitsPersonal, daysRemaining);

  // 7. Projected final usage
  // Projected = Current estimated + (daily rate * days remaining)
  const activeRate = forecastMethod === 'recent_trend' ? recentDailyAverage : currentDailyAverage;
  let projectedFinalUsage = estimatedCycleUnits + activeRate * daysRemaining;
  projectedFinalUsage = parseFloat(projectedFinalUsage.toFixed(1));

  // 8. Pace difference (current daily pace vs safe personal allowance)
  const paceDifferencePerDay = parseFloat(
    (currentDailyAverage - safeDailyAllowancePersonal).toFixed(2)
  );

  // 9. Projected threshold-crossing date (if projected >= 200)
  let projectedThresholdCrossingDate: string | undefined;
  if (activeRate > 0 && remainingUnitsOfficial > 0 && projectedFinalUsage >= officialCeiling) {
    const daysUntilCrossing = remainingUnitsOfficial / activeRate;
    const crossingTimestamp = now + daysUntilCrossing * 24 * 60 * 60 * 1000;
    projectedThresholdCrossingDate = new Date(crossingTimestamp).toISOString();
  } else if (estimatedCycleUnits >= officialCeiling) {
    projectedThresholdCrossingDate = new Date().toISOString();
  }

  // Status is evaluated based on the HIGHER of current estimated usage or projected usage
  // to warn users BEFORE they cross 200!
  const status = calculateThresholdRisk(estimatedCycleUnits, officialCeiling, personalTarget);
  const projectedRisk = calculateThresholdRisk(projectedFinalUsage, officialCeiling, personalTarget);

  return {
    cycleId: cycle.id,
    totalTrackedUnits,
    gapUnits,
    currentEstimatedCycleUnits: estimatedCycleUnits,
    officialCeiling,
    personalTarget,
    remainingUnitsOfficial,
    remainingUnitsPersonal,
    daysInCycle,
    daysElapsed: parseFloat(daysElapsed.toFixed(1)),
    daysRemaining,
    currentDailyAverage,
    recentDailyAverage,
    safeDailyAllowanceOfficial,
    safeDailyAllowancePersonal,
    projectedFinalUsage,
    forecastConfidence,
    forecastMethod,
    projectedThresholdCrossingDate,
    paceDifferencePerDay,
    status,
    dataQuality: isValid && estimatedCycleUnits >= 0 ? 'valid' : 'invalid',
    dataQualityMessage: error || (estimatedCycleUnits < 0 ? 'Invalid consumption cannot be calculated.' : undefined),
    currentUsage: estimatedCycleUnits,
    projectedUsage: projectedFinalUsage,
    projectedRisk,
  };
}

/**
 * Determines the next recommended reading time based on user history and preferences.
 */
export function getRecommendedReadingTime(
  readings: MeterReading[],
  preferredTime = '18:00'
): {
  recommendationText: string;
  isTodayRecorded: boolean;
  targetDateTime: string;
} {
  const now = new Date();
  const [prefHour, prefMin] = preferredTime.split(':').map((v) => parseInt(v, 10) || 0);

  // Check if today already has a reading
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const hasTodayReading = readings.some((r) => {
    const t = new Date(r.reading_timestamp).getTime();
    return t >= todayStart && t < todayEnd;
  });

  const targetDate = new Date(now);
  let recommendationText = '';

  if (hasTodayReading) {
    // Already recorded today -> recommend tomorrow at preferred time
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(prefHour, prefMin, 0, 0);
    recommendationText = `Tomorrow around ${formatHourAmPm(prefHour, prefMin)}`;
  } else {
    // Not recorded today yet
    targetDate.setHours(prefHour, prefMin, 0, 0);
    if (now.getTime() > targetDate.getTime()) {
      recommendationText = 'Today as soon as convenient';
    } else {
      recommendationText = `Today around ${formatHourAmPm(prefHour, prefMin)}`;
    }
  }

  return {
    recommendationText,
    isTodayRecorded: hasTodayReading,
    targetDateTime: targetDate.toISOString(),
  };
}

function formatHourAmPm(hour: number, min: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mStr = min > 0 ? `:${min.toString().padStart(2, '0')}` : ':00';
  return `${h12}${mStr} ${period}`;
}
