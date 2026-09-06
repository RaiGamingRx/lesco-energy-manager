import React, { useState } from 'react';
import { X, AlertCircle, Trash2, History } from 'lucide-react';
import { MeterReading } from '../../types';
import { useEnergy } from '../../context/EnergyContext';
import { validateMeterReading } from '../../engine/validation';

interface EditReadingModalProps {
  reading: MeterReading | null;
  onClose: () => void;
}

export const EditReadingModal: React.FC<EditReadingModalProps> = ({ reading, onClose }) => {
  const { readings, meters, cycles, household, updateReading, deleteReading } = useEnergy();

  const [cumulativeKWh, setCumulativeKWh] = useState<string>(
    reading ? reading.cumulativeKWh.toString() : ''
  );
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    if (!reading) return '';
    const d = new Date(reading.reading_timestamp);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [reason, setReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!reading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(cumulativeKWh);
    if (isNaN(num)) return;

    const validation = validateMeterReading(
      {
        cumulativeKWh: num,
        reading_timestamp: new Date(customDateTime).toISOString(),
        source: reading.source,
      },
      readings,
      reading.id,
      household && meters.find((meter) => meter.id === reading.meterId) && cycles.find((cycle) => cycle.id === reading.cycleId)
        ? { household, meter: meters.find((meter) => meter.id === reading.meterId)!, cycle: cycles.find((cycle) => cycle.id === reading.cycleId)! }
        : undefined,
    );

    if (!validation.isValid) {
      alert(validation.message || 'Invalid reading values');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateReading(
        reading.id,
        {
          cumulativeKWh: num,
          reading_timestamp: new Date(customDateTime).toISOString(),
          notes: reading.notes,
        },
        reason.trim() || 'Corrected typo in meter reading'
      );
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this meter reading? An audit entry will record this removal.')) {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteReading(reading.id, reason.trim() || 'User requested reading deletion');
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Correct Meter Reading</h3>
            <p className="text-xs text-slate-500 mt-0.5">Edits are transparently logged in audit trail</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs text-slate-800 font-semibold block mb-1">
              Cumulative Reading (kWh)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={cumulativeKWh}
              onChange={(e) => setCumulativeKWh(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 py-2.5 px-3 font-mono text-xl font-bold text-slate-900 outline-none focus:border-slate-900 shadow-xs"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Original: {reading.cumulativeKWh.toFixed(1)} kWh
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-800 font-semibold block mb-1">
              Physical Reading Time
            </label>
            <input
              type="datetime-local"
              required
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="text-xs text-slate-800 font-semibold block mb-1">
              Reason for Correction <span className="text-amber-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Corrected mistyped digit on meter"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 text-xs text-slate-900 outline-none focus:border-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              This will update the reading and record a permanent audit entry showing previous value{' '}
              <strong className="text-slate-900 font-mono">{reading.cumulativeKWh}</strong> and new value{' '}
              <strong className="text-slate-900 font-mono">{cumulativeKWh || '...'}</strong>.
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold text-white shadow-xs transition"
              >
                {isSubmitting ? 'Saving...' : 'Apply Correction'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
