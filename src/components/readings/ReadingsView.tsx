import React, { useState, useMemo } from 'react';
import { Plus, Clock, Edit2, Calendar, Filter, Zap } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { MeterReading } from '../../types';
import { DataBadge } from '../common/DataBadge';
import { calculateConsumption } from '../../engine/calculations';

interface ReadingsViewProps {
  onOpenAddReading: () => void;
  onEditReading: (reading: MeterReading) => void;
}

export const ReadingsView: React.FC<ReadingsViewProps> = ({
  onOpenAddReading,
  onEditReading,
}) => {
  const { readings, cycles, activeCycle } = useEnergy();
  const [selectedCycleId, setSelectedCycleId] = useState<string>(activeCycle?.id || 'all');

  // Filter readings
  const filteredRaw = useMemo(() => {
    if (selectedCycleId === 'all') return readings;
    return readings.filter((r) => r.cycleId === selectedCycleId);
  }, [readings, selectedCycleId]);

  // Derive calculated deltas for the filtered view
  const { processedReadings } = useMemo(() => {
    return calculateConsumption(filteredRaw);
  }, [filteredRaw]);

  // Display reversed (most recent first)
  const displayReadings = useMemo(() => {
    return [...processedReadings].reverse();
  }, [processedReadings]);

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Meter Readings Log</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical meter timestamps and sequential interval consumption
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Cycle filter dropdown */}
          <div className="relative">
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="rounded-xl bg-white border border-slate-200 py-2 px-3 text-xs text-slate-700 font-medium outline-none focus:border-slate-400 shadow-xs pr-8"
            >
              <option value="all">All Cycles ({readings.length})</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  Cycle {c.billingPeriodStart} {c.status === 'active' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenAddReading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reading</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {displayReadings.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 mx-auto flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">No meter readings recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your first physical meter reading to start calculating daily pace and interval consumption.
            </p>
          </div>
          <button
            onClick={onOpenAddReading}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            Add First Reading
          </button>
        </div>
      )}

      {/* Readings Sequence List */}
      <div className="space-y-2.5">
        {displayReadings.map((r, idx) => {
          const physDate = new Date(r.reading_timestamp);
          const entryDate = new Date(r.entry_timestamp);
          const isDelayed = Math.abs(entryDate.getTime() - physDate.getTime()) > 5 * 60 * 1000;

          return (
            <div
              key={r.id}
              className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              {/* Left Info: Cumulative Value, Delta, and Timestamps */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-mono font-semibold text-slate-600 text-xs shrink-0 mt-0.5">
                  #{displayReadings.length - idx}
                </div>
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-xl font-bold text-slate-900">
                      {r.cumulativeKWh.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">kWh</span>
                    </span>
                    {r.consumptionFromPrevious !== undefined && r.consumptionFromPrevious > 0 && (
                      <span className="font-mono text-xs font-semibold text-emerald-700">
                        +{r.consumptionFromPrevious.toFixed(2)} kWh
                      </span>
                    )}
                  </div>

                  {/* Timestamps: Physical Taken Time vs App Entry */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1.5 text-slate-800 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Taken:</span>{' '}
                      {physDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      at {physDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {isDelayed && (
                      <span className="text-slate-400 text-[11px]">
                        (Logged at: {entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}

                    {r.intervalHours !== undefined && r.intervalHours > 0 && (
                      <span className="text-slate-400 text-[11px]">
                        • {r.intervalHours.toFixed(1)}h interval
                      </span>
                    )}
                  </div>

                  {r.notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">
                      "{r.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Provenance & Correction Action */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="flex items-center gap-2">
                  <DataBadge origin={r.isBaseline ? 'official' : 'user_entered'} size="sm" />
                  {r.isCorrected && (
                    <span className="text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-medium">
                      Corrected
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onEditReading(r)}
                  className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center gap-1 text-xs font-medium transition"
                  title="Make a logged correction to this reading"
                >
                  <Edit2 className="w-3 h-3 text-slate-400" />
                  <span>Correct</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
