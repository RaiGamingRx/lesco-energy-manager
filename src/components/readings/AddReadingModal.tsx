import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Clock, Calendar, Check, Zap, Sparkles } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { validateMeterReading } from '../../engine/validation';
import { DataBadge } from '../common/DataBadge';

interface AddReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddReadingModal: React.FC<AddReadingModalProps> = ({ isOpen, onClose }) => {
  const { readings, activeCycle, meters, household, settings, addReading } = useEnergy();

  // Primary input state
  const [cumulativeKWh, setCumulativeKWh] = useState<string>('');
  const [readingTimeOption, setReadingTimeOption] = useState<'now' | 'custom'>('now');
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date();
    // format as YYYY-MM-DDTHH:mm
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedSpikeWarning, setConfirmedSpikeWarning] = useState<boolean>(false);

  // Identify last reading for context
  const cycleReadings = useMemo(() => {
    if (!activeCycle) return [];
    return readings
      .filter((r) => r.cycleId === activeCycle.id)
      .sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());
  }, [readings, activeCycle]);

  const lastReading = cycleReadings.length > 0 ? cycleReadings[cycleReadings.length - 1] : null;

  // Selected meter
  const targetMeter = useMemo(() => {
    if (settings?.trackingMode === 'outdoor_meter') {
      return meters.find((m) => m.type === 'outdoor_lesco_digital') || meters[0];
    }
    return meters.find((m) => m.type === 'indoor_cumulative_protector') || meters[0];
  }, [meters, settings]);

  // Derived effective reading timestamp
  const effectiveReadingTimestamp = useMemo(() => {
    if (readingTimeOption === 'now') {
      return new Date().toISOString();
    }
    return new Date(customDateTime).toISOString();
  }, [readingTimeOption, customDateTime]);

  // Real-time validation
  const validation = useMemo(() => {
    const num = parseFloat(cumulativeKWh);
    if (isNaN(num)) return null;

    return validateMeterReading(
      {
        cumulativeKWh: num,
        reading_timestamp: effectiveReadingTimestamp,
        source: settings?.trackingMode === 'outdoor_meter' ? 'outdoor_meter' : 'indoor_meter',
      },
      readings,
      undefined,
      activeCycle && targetMeter && household ? { household, meter: targetMeter, cycle: activeCycle } : undefined,
    );
  }, [cumulativeKWh, effectiveReadingTimestamp, readings, settings]);

  // Calculated delta preview
  const deltaPreview = useMemo(() => {
    const num = parseFloat(cumulativeKWh);
    if (isNaN(num) || !lastReading) return null;

    const diffUnits = num - lastReading.cumulativeKWh;
    const diffHours =
      (new Date(effectiveReadingTimestamp).getTime() -
        new Date(lastReading.reading_timestamp).getTime()) /
      (1000 * 60 * 60);

    return {
      units: diffUnits,
      hours: Math.max(0.1, diffHours),
      pace24h: diffHours > 0 ? (diffUnits / diffHours) * 24 : diffUnits,
    };
  }, [cumulativeKWh, lastReading, effectiveReadingTimestamp]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle) return;
    if (!validation || !validation.isValid) return;

    if (validation.status === 'warning' && !confirmedSpikeWarning) {
      setConfirmedSpikeWarning(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await addReading({
        cycleId: activeCycle.id,
        meterId: targetMeter ? targetMeter.id : 'm-1',
        householdId: activeCycle.householdId,
        connectionId: targetMeter?.connectionId || activeCycle.connectionId,
        cumulativeKWh: parseFloat(cumulativeKWh),
        reading_timestamp: effectiveReadingTimestamp,
        source: settings?.trackingMode === 'outdoor_meter' ? 'outdoor_meter' : 'indoor_meter',
        notes: notes.trim() || undefined,
        validationStatus: validation.status,
        validationMessage: validation.message,
      });

      onClose();
      // reset
      setCumulativeKWh('');
      setNotes('');
      setConfirmedSpikeWarning(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Log Meter Reading</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetMeter?.name || 'Main Household Meter'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Last Reading Baseline */}
          {lastReading && (
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Previous Reading</span>
                <span className="font-mono text-slate-900 font-bold">
                  {lastReading.cumulativeKWh.toFixed(1)} kWh
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Taken</span>
                <span className="text-slate-700 font-medium">
                  {new Date(lastReading.reading_timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(lastReading.reading_timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Reading Value Input with Big Mobile Numerics */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="reading-input" className="text-xs font-semibold text-slate-800">
                Current Cumulative Reading (kWh)
              </label>
              <DataBadge origin="user_entered" size="sm" />
            </div>
            <div className="relative">
              <input
                id="reading-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                autoFocus
                placeholder={lastReading ? (lastReading.cumulativeKWh + 1.5).toFixed(1) : '000.0'}
                value={cumulativeKWh}
                onChange={(e) => {
                  setCumulativeKWh(e.target.value);
                  setConfirmedSpikeWarning(false);
                }}
                className="w-full rounded-xl bg-white border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 py-3 px-4 font-mono text-2xl font-bold text-slate-900 tracking-wide outline-none placeholder:text-slate-300 shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-slate-400">
                kWh
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Enter the exact total reading displayed on the meter digital display or dials.
            </p>
          </div>

          {/* Consumption Delta Preview */}
          {deltaPreview && deltaPreview.units >= 0 && (
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Calculated Consumption:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  +{deltaPreview.units.toFixed(2)} kWh
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                <span>Over interval:</span>
                <span>{deltaPreview.hours.toFixed(1)} hours (run rate: {deltaPreview.pace24h.toFixed(1)} kWh/day)</span>
              </div>
            </div>
          )}

          {/* Physical Reading Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>When was this reading taken?</span>
              </label>
              <span className="text-[11px] text-slate-500">Affects pace rate</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setReadingTimeOption('now')}
                className={`py-2 px-3 rounded-lg border text-center transition font-medium ${
                  readingTimeOption === 'now'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Just Now ({new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </button>

              <button
                type="button"
                onClick={() => setReadingTimeOption('custom')}
                className={`py-2 px-3 rounded-lg border text-center transition font-medium ${
                  readingTimeOption === 'custom'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Earlier Time
              </button>
            </div>

            {readingTimeOption === 'custom' && (
              <div className="pt-2">
                <input
                  type="datetime-local"
                  value={customDateTime}
                  max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-200 py-2 px-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-900"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Calculations strictly use physical reading time to determine daily pace.
                </p>
              </div>
            )}
          </div>

          {/* Notes (optional) */}
          <div>
            <label className="text-xs text-slate-600 block mb-1 font-medium">
              Optional Note (e.g., Heavy AC usage, guests stayed over)
            </label>
            <input
              type="text"
              placeholder="e.g., Normal household load"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-200 py-2 px-3 text-xs text-slate-900 outline-none focus:border-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Validation Feedback & Warnings */}
          {validation && !validation.isValid && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-900">Invalid Reading</span>
                <p className="text-[11px] leading-relaxed mt-0.5">{validation.message}</p>
              </div>
            </div>
          )}

          {validation && validation.isValid && validation.status === 'warning' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <span className="font-bold block text-amber-900">Consumption Spike Warning</span>
                <p className="text-[11px] leading-relaxed">{validation.message}</p>
                {!confirmedSpikeWarning ? (
                  <button
                    type="button"
                    onClick={() => setConfirmedSpikeWarning(true)}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-200 transition"
                  >
                    Confirm this spike is intentional
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                    <Check className="w-3.5 h-3.5" /> Spike verified
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !cumulativeKWh ||
                (validation !== null && !validation.isValid) ||
                (validation?.status === 'warning' && !confirmedSpikeWarning) ||
                isSubmitting
              }
              className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none py-2.5 text-xs font-semibold text-white shadow-xs transition active:scale-98"
            >
              {isSubmitting ? 'Saving...' : 'Save Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
