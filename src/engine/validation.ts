import { MeterReading, BillingCycle, ValidationStatus } from '../types';

export interface ValidationResult {
  isValid: boolean;
  status: ValidationStatus;
  message?: string;
  isFatal: boolean;
}

/**
 * Validates a new or updated meter reading against previous history.
 */
export function validateMeterReading(
  newReading: {
    cumulativeKWh: number;
    reading_timestamp: string;
    entry_timestamp?: string;
    source: string;
  },
  existingReadings: MeterReading[],
  currentReadingId?: string
): ValidationResult {
  // 1. Numerical validity
  if (isNaN(newReading.cumulativeKWh) || newReading.cumulativeKWh < 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Meter reading must be a positive number.',
      isFatal: true,
    };
  }

  // 2. Future timestamp check
  const readingTime = new Date(newReading.reading_timestamp).getTime();
  const now = Date.now();
  // Allow up to 2 minutes clock skew
  if (readingTime > now + 2 * 60 * 1000) {
    return {
      isValid: false,
      status: 'error',
      message: "Reading time can't be in the future.",
      isFatal: true,
    };
  }

  // Filter out self if updating
  const otherReadings = existingReadings
    .filter((r) => r.id !== currentReadingId)
    .sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());

  // 3. Duplicate check
  const isDuplicate = otherReadings.some((r) => {
    const timeDiff = Math.abs(new Date(r.reading_timestamp).getTime() - readingTime);
    return timeDiff < 60 * 1000 && Math.abs(r.cumulativeKWh - newReading.cumulativeKWh) < 0.001;
  });

  if (isDuplicate) {
    return {
      isValid: false,
      status: 'error',
      message: 'A reading with this exact time and value already exists.',
      isFatal: true,
    };
  }

  // 4. Chronological sequence check (previous reading before this time)
  const previousReadings = otherReadings.filter(
    (r) => new Date(r.reading_timestamp).getTime() <= readingTime
  );
  const nextReadings = otherReadings.filter(
    (r) => new Date(r.reading_timestamp).getTime() > readingTime
  );

  const lastBefore = previousReadings.length > 0 ? previousReadings[previousReadings.length - 1] : null;
  const firstAfter = nextReadings.length > 0 ? nextReadings[0] : null;

  // Scenario 4: Reading decreased
  if (lastBefore && newReading.cumulativeKWh < lastBefore.cumulativeKWh) {
    return {
      isValid: false,
      status: 'error',
      message: `This reading is lower than your last reading (${lastBefore.cumulativeKWh} kWh). Please check the number.`,
      isFatal: true,
    };
  }

  if (firstAfter && newReading.cumulativeKWh > firstAfter.cumulativeKWh) {
    return {
      isValid: false,
      status: 'error',
      message: `This reading (${newReading.cumulativeKWh} kWh) is higher than a later reading (${firstAfter.cumulativeKWh} kWh). Please check the date and number.`,
      isFatal: true,
    };
  }

  // 5. Spike warning check (Outlier usage)
  if (lastBefore) {
    const hoursDiff = (readingTime - new Date(lastBefore.reading_timestamp).getTime()) / (1000 * 60 * 60);
    const consumed = newReading.cumulativeKWh - lastBefore.cumulativeKWh;
    
    // In domestic household, > 25 kWh in 24 hours is unusually high for a protected consumer
    const ratePerHour = hoursDiff > 0 ? consumed / hoursDiff : consumed;
    if (hoursDiff >= 0.5 && ratePerHour > 2.5) { // Equivalent to > 60 kWh/day
      return {
        isValid: true,
        status: 'warning',
        message: `High consumption detected: ${consumed.toFixed(1)} kWh in ${hoursDiff.toFixed(1)} hours (${(ratePerHour * 24).toFixed(1)} kWh/day pace). Please verify this is correct.`,
        isFatal: false,
      };
    }
  }

  return {
    isValid: true,
    status: 'valid',
    isFatal: false,
  };
}

/**
 * Validates outdoor meter synchronization reading when a bill arrives.
 */
export function validateOutdoorSync(
  outdoorReading: number,
  billCurrentReading: number
): ValidationResult {
  if (isNaN(outdoorReading) || outdoorReading < 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Outdoor meter reading must be a valid positive number.',
      isFatal: true,
    };
  }

  if (outdoorReading < billCurrentReading) {
    return {
      isValid: false,
      status: 'error',
      message: `Outdoor meter (${outdoorReading} kWh) cannot be lower than the LESCO bill reading (${billCurrentReading} kWh). Physical meter values only increase.`,
      isFatal: true,
    };
  }

  const gap = outdoorReading - billCurrentReading;
  if (gap > 80) {
    return {
      isValid: true,
      status: 'warning',
      message: `Unusually large Gap detected (${gap.toFixed(1)} kWh). Are you sure your outdoor meter reads ${outdoorReading} vs bill reading ${billCurrentReading}?`,
      isFatal: false,
    };
  }

  return {
    isValid: true,
    status: 'valid',
    isFatal: false,
  };
}

/**
 * Validates a new billing cycle input to prevent duplicate bills or overlapping periods.
 */
export function validateBillingCycle(
  newCycle: Partial<BillingCycle>,
  existingCycles: BillingCycle[],
  currentCycleId?: string
): ValidationResult {
  const otherCycles = existingCycles.filter((c) => c.id !== currentCycleId);

  // 1. Check duplicate reference / dates
  if (newCycle.officialReadingDate && newCycle.currentOfficialReading !== undefined) {
    const isDuplicate = otherCycles.some(
      (c) =>
        c.officialReadingDate === newCycle.officialReadingDate &&
        Math.abs(c.currentOfficialReading - (newCycle.currentOfficialReading || 0)) < 0.01
    );
    if (isDuplicate) {
      return {
        isValid: false,
        status: 'error',
        message: 'A billing cycle for this official reading date and meter value already exists. Duplicate bills are prevented.',
        isFatal: true,
      };
    }
  }

  // 2. Reading continuity check
  if (
    newCycle.previousOfficialReading !== undefined &&
    newCycle.currentOfficialReading !== undefined
  ) {
    if (newCycle.currentOfficialReading < newCycle.previousOfficialReading) {
      return {
        isValid: false,
        status: 'error',
        message: 'Current official reading cannot be lower than previous official reading.',
        isFatal: true,
      };
    }

    const calculatedUnits = newCycle.currentOfficialReading - newCycle.previousOfficialReading;
    if (newCycle.billedUnits !== undefined && Math.abs(calculatedUnits - newCycle.billedUnits) > 1.0) {
      return {
        isValid: true,
        status: 'warning',
        message: `Difference between readings is ${calculatedUnits} kWh, but billed units is ${newCycle.billedUnits} kWh. This may reflect meter multiplier or adjustment factors on your LESCO bill.`,
        isFatal: false,
      };
    }
  }

  // 3. Billing period validation
  if (newCycle.billingPeriodStart && newCycle.billingPeriodEnd) {
    const start = new Date(newCycle.billingPeriodStart).getTime();
    const end = new Date(newCycle.billingPeriodEnd).getTime();
    if (start >= end) {
      return {
        isValid: false,
        status: 'error',
        message: 'Billing period start date must be before the end date.',
        isFatal: true,
      };
    }
  }

  return {
    isValid: true,
    status: 'valid',
    isFatal: false,
  };
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return dateStr;
  }
}
