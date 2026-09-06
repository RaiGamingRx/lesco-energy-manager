import React, { useState, useMemo } from 'react';
import { History, TrendingDown, TrendingUp, BarChart2, ShieldCheck, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { DataBadge } from '../common/DataBadge';

export const HistoryView: React.FC = () => {
  const { cycles, auditLogs } = useEnergy();
  const [activeTab, setActiveTab] = useState<'cycles' | 'audit'>('cycles');

  const closedCycles = useMemo(() => {
    return cycles.filter((c) => c.status === 'closed' || c.status === 'locked');
  }, [cycles]);

  // Historical aggregate metrics
  const analytics = useMemo(() => {
    const valid = closedCycles.filter((c) => c.billedUnits > 0);
    if (valid.length === 0) return null;

    const totalUnits = valid.reduce((acc, c) => acc + c.billedUnits, 0);
    const totalBills = valid.reduce((acc, c) => acc + c.billAmount, 0);

    const highest = [...valid].sort((a, b) => b.billedUnits - a.billedUnits)[0];
    const lowest = [...valid].sort((a, b) => a.billedUnits - b.billedUnits)[0];

    return {
      averageUnits: Math.round(totalUnits / valid.length),
      averageBill: Math.round(totalBills / valid.length),
      highestCycle: highest,
      lowestCycle: lowest,
      completedCount: valid.length,
    };
  }, [closedCycles]);

  return (
    <div className="space-y-6 pb-16">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">History & Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-cycle comparison, ceiling performance, and audit verification
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-xl bg-slate-100 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('cycles')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'cycles'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Closed Cycles ({closedCycles.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'cycles' && (
        <>
          {/* Comparison Stats Section */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                <span className="text-xs text-slate-500 block">Average Usage</span>
                <span className="font-mono text-2xl font-bold text-slate-900 block mt-1">
                  {analytics.averageUnits}{' '}
                  <span className="text-xs font-normal text-slate-500">kWh</span>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Across {analytics.completedCount} closed cycles
                </span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                <span className="text-xs text-slate-500 block">Average Bill</span>
                <span className="font-mono text-2xl font-bold text-slate-900 block mt-1">
                  PKR {analytics.averageBill.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Protected domestic rates
                </span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                <span className="text-xs text-slate-500 block">Lowest Cycle</span>
                <span className="font-mono text-2xl font-bold text-emerald-700 block mt-1">
                  {analytics.lowestCycle.billedUnits}{' '}
                  <span className="text-xs font-normal text-slate-500">kWh</span>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Ended {analytics.lowestCycle.billingPeriodEnd}
                </span>
              </div>

              <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs">
                <span className="text-xs text-slate-500 block">Highest Cycle</span>
                <span className="font-mono text-2xl font-bold text-slate-900 block mt-1">
                  {analytics.highestCycle.billedUnits}{' '}
                  <span className="text-xs font-normal text-slate-500">kWh</span>
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Ended {analytics.highestCycle.billingPeriodEnd}
                </span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {closedCycles.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 mx-auto flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Your completed cycles will appear here</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once an active billing cycle ends and you confirm the subsequent LESCO bill, full cycle reconciliation and comparison metrics are locked here.
              </p>
            </div>
          )}

          {/* Closed Cycles List */}
          <div className="space-y-3">
            {closedCycles.map((c) => {
              const isUnderTarget = c.billedUnits <= 190;
              const isUnderCeiling = c.billedUnits <= 200;

              return (
                <div
                  key={c.id}
                  className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs space-y-4 text-xs transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {c.billingPeriodStart} to {c.billingPeriodEnd}
                        </span>
                        <DataBadge origin="official" size="sm" />
                      </div>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Official Reading Date: {c.officialReadingDate}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xl font-bold text-slate-900 block">
                        {c.billedUnits} <span className="text-xs font-normal text-slate-400">kWh</span>
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        PKR {c.billAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Meter Readings</span>
                      <span className="font-mono text-slate-800 font-medium">
                        {c.previousOfficialReading} → {c.currentOfficialReading}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Outdoor Gap</span>
                      <span className="font-mono text-slate-800 font-medium">
                        +{c.gapUnits !== undefined ? c.gapUnits.toFixed(1) : '0.0'} kWh
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">200 Ceiling</span>
                      <span
                        className={`font-semibold ${
                          isUnderCeiling ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isUnderCeiling ? '✓ Preserved' : '✗ Exceeded'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">190 Safety Target</span>
                      <span
                        className={`font-semibold ${
                          isUnderTarget ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isUnderTarget ? '✓ Achieved' : 'Exceeded Target'}
                      </span>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      Note: {c.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 block">Local Audit History</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every creation, user correction, or cycle finalization is permanently recorded to guarantee data provenance and prevent silent overwrites.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {log.entityType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {log.reason || 'No description provided'}
                  </p>
                </div>

                <div className="text-left sm:text-right font-mono text-[11px] text-slate-400">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
