import React, { useState } from 'react';
import { X, Gauge, AlertTriangle, Check } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { validateOutdoorSync } from '../../engine/validation';
import { DataBadge } from '../common/DataBadge';

interface OutdoorSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OutdoorSyncModal: React.FC<OutdoorSyncModalProps> = ({ isOpen, onClose }) => {
  const { activeCycle, syncOutdoorMeter } = useEnergy();

  const [outdoorReading, setOutdoorReading] = useState<string>(
    activeCycle?.syncOutdoorReading?.toString() || ''
  );
  const [confirmedUnusual, setConfirmedUnusual] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !activeCycle) return null;

  const billReading = activeCycle.currentOfficialReading;
  const num = parseFloat(outdoorReading);
  const gap = !isNaN(num) && num >= billReading ? num - billReading : null;

  const validation = !isNaN(num) ? validateOutdoorSync(num, billReading) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation || !validation.isValid) return;
    if (validation.status === 'warning' && !confirmedUnusual) {
      setConfirmedUnusual(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await syncOutdoorMeter(num);
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Outdoor Meter Synchronization</h3>
            <p className="text-xs text-slate-500 mt-0.5">Reconcile official outdoor meter reading</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">LESCO Bill Reading:</span>
              <span className="font-mono text-slate-900 font-bold">{billReading.toFixed(1)} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Official Reading Date:</span>
              <span className="text-slate-800 font-medium">{activeCycle.officialReadingDate}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-800 font-semibold">
                Outdoor Meter Reading at Sync (kWh)
              </label>
              <DataBadge origin="calculated" size="sm" />
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              autoFocus
              value={outdoorReading}
              onChange={(e) => {
                setOutdoorReading(e.target.value);
                setConfirmedUnusual(false);
              }}
              placeholder={(billReading + 3.7).toFixed(1)}
              className="w-full rounded-xl bg-white border border-slate-300 py-2.5 px-3.5 font-mono text-xl text-slate-900 font-bold outline-none focus:border-slate-900 shadow-xs"
            />
          </div>

          {gap !== null && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-medium">Resulting Gap Units:</span>
                <span className="font-mono text-sm font-bold text-slate-900">
                  +{gap.toFixed(2)} kWh
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Outdoor ({num.toFixed(1)}) − Bill ({billReading.toFixed(1)}) = {gap.toFixed(2)} kWh
              </p>
            </div>
          )}

          {validation && !validation.isValid && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
              {validation.message}
            </div>
          )}

          {validation?.status === 'warning' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p>{validation.message}</p>
              {!confirmedUnusual && (
                <button
                  type="button"
                  onClick={() => setConfirmedUnusual(true)}
                  className="mt-2 px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-semibold text-xs"
                >
                  Confirm this value is correct
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
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
                isSubmitting ||
                !outdoorReading ||
                (validation !== null && !validation.isValid) ||
                (validation?.status === 'warning' && !confirmedUnusual)
              }
              className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 py-2.5 text-xs font-semibold text-white shadow-xs transition"
            >
              {isSubmitting ? 'Saving...' : 'Confirm Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
