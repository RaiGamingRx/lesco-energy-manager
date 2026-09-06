import React, { useState } from 'react';
import { Plus, FileText, Lock, Calendar, CheckCircle2, AlertCircle, Gauge, ArrowRight } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { DataBadge } from '../common/DataBadge';

interface BillsViewProps {
  onOpenBillEntry: () => void;
  onOpenSyncOutdoor: () => void;
}

export const BillsView: React.FC<BillsViewProps> = ({
  onOpenBillEntry,
  onOpenSyncOutdoor,
}) => {
  const { cycles, activeCycle, closeCycle } = useEnergy();
  const [isClosingCycle, setIsClosingCycle] = useState(false);

  const handleCloseActiveCycle = async () => {
    if (!activeCycle) return;
    const confirm = window.confirm(
      'Are you sure you want to lock and finalize this billing cycle? Ensure all readings for this period have been logged.'
    );
    if (!confirm) return;

    setIsClosingCycle(true);
    try {
      await closeCycle(activeCycle.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsClosingCycle(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Bills & Cycles</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Official LESCO utility bills, cycle periods, and meter reconciliation
          </p>
        </div>

        <button
          onClick={onOpenBillEntry}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Enter New Bill</span>
        </button>
      </div>

      {/* Active Cycle Focus Section */}
      {activeCycle ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Active Cycle: {activeCycle.billingPeriodStart} to {activeCycle.billingPeriodEnd}
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                In Progress
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSyncOutdoor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 transition"
              >
                <Gauge className="w-3.5 h-3.5 text-slate-500" />
                <span>Sync Outdoor Meter</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div>
              <span className="text-slate-500 block">Official Bill Reading Date</span>
              <span className="font-mono text-slate-900 font-bold block mt-1 text-sm">
                {activeCycle.officialReadingDate}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">LESCO meter reader visit</span>
            </div>

            <div>
              <span className="text-slate-500 block">Bill Base Reading</span>
              <span className="font-mono text-slate-900 font-bold block mt-1 text-sm">
                {activeCycle.currentOfficialReading} kWh
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Baseline for cycle</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Outdoor Gap</span>
                <DataBadge origin="calculated" size="sm" />
              </div>
              <span className="font-mono text-slate-900 font-bold block mt-1 text-sm">
                +{activeCycle.gapUnits !== undefined ? activeCycle.gapUnits.toFixed(2) : '0.00'} kWh
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Reconciled difference</span>
            </div>

            <div>
              <span className="text-slate-500 block">Indoor Reset Status</span>
              <span
                className={`font-semibold block mt-1 text-sm ${
                  activeCycle.indoorResetConfirmed ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {activeCycle.indoorResetConfirmed ? 'Reset (000.0)' : 'Pending Reset'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Sub-meter sync</span>
            </div>
          </div>

          {/* Details Row */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Outdoor Sync Reading:{' '}
                <strong className="text-slate-700 font-mono">
                  {activeCycle.syncOutdoorReading ? `${activeCycle.syncOutdoorReading} kWh` : 'Not synced'}
                </strong>
              </span>
              <span>
                LESCO Bill Ref:{' '}
                <strong className="text-slate-700 font-mono">
                  {activeCycle.billReference || 'None'}
                </strong>
              </span>
            </div>

            <button
              onClick={handleCloseActiveCycle}
              disabled={isClosingCycle}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition font-medium"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>{isClosingCycle ? 'Finalizing...' : 'Close & Lock Completed Cycle'}</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="p-10 text-center rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900">No active billing cycle</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your latest LESCO bill to establish your official baseline and start cycle pacing.
          </p>
          <button
            onClick={onOpenBillEntry}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            Enter Latest Bill
          </button>
        </section>
      )}

      {/* Historical Cycles List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Billing Cycles Record ({cycles.length})
        </h3>

        <div className="space-y-2.5">
          {cycles.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition text-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-900 text-sm">
                    {c.billingPeriodStart} to {c.billingPeriodEnd}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    c.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {c.status === 'active' ? 'Active' : 'Closed'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600 pt-1">
                <div>
                  <span className="text-slate-400 block text-[11px]">Billed Units</span>
                  <span className="font-mono text-slate-900 font-bold text-sm">{c.billedUnits} kWh</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Billed Amount</span>
                  <span className="font-mono text-slate-900 font-bold text-sm">
                    PKR {c.billAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Meter Readings</span>
                  <span className="font-mono text-slate-700 font-medium">
                    {c.previousOfficialReading} → {c.currentOfficialReading}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Reconciled Gap</span>
                  <span className="font-mono text-slate-700 font-medium">
                    +{c.gapUnits !== undefined ? c.gapUnits.toFixed(1) : '0.0'} kWh
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
