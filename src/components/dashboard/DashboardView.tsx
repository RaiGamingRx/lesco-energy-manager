import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Clock,
  Plus,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
  Gauge,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { DataBadge } from '../common/DataBadge';
import { getRecommendedReadingTime } from '../../engine/calculations';
import { estimateBillAmount } from '../../engine/tariffs';

interface DashboardViewProps {
  onOpenAddReading: () => void;
  onOpenSyncOutdoor: () => void;
  onNavigateToBills: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenAddReading,
  onOpenSyncOutdoor,
  onNavigateToBills,
}) => {
  const { summary, activeCycle, readings, settings } = useEnergy();

  const officialCeiling = summary.officialCeiling;
  const personalTarget = summary.personalTarget;
  const currentUnits = summary.currentEstimatedCycleUnits;
  const projectedUnits = summary.projectedFinalUsage;

  // Percentage calculations
  const percentCeiling = Math.min(100, Math.max(0, (currentUnits / officialCeiling) * 100));
  const percentTarget = Math.min(100, Math.max(0, (personalTarget / officialCeiling) * 100));

  // Recommendation
  const schedule = getRecommendedReadingTime(
    readings,
    settings?.preferredReadingTime || '18:00'
  );

  // Bill projections
  const currentEstimatedBill = estimateBillAmount(currentUnits, true);
  const projectedEstimatedBill = estimateBillAmount(projectedUnits, true);

  // Recent 5 readings for mini-trend
  const cycleReadings = readings
    .filter((r) => r.cycleId === activeCycle?.id)
    .sort((a, b) => new Date(b.reading_timestamp).getTime() - new Date(a.reading_timestamp).getTime())
    .slice(0, 5);

  const latestReading = cycleReadings.length > 0 ? cycleReadings[0] : null;

  // Restrained semantic status styling for the 200 kWh threshold
  const statusConfig = {
    on_track: {
      label: 'On Track',
      description: 'Your current daily average is safely below the maximum safe rate.',
      barColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      icon: ShieldCheck,
    },
    safety_zone: {
      label: 'Approaching Target',
      description: 'Consumption is nearing your personal safety threshold.',
      barColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      icon: ShieldAlert,
    },
    very_close: {
      label: 'Near 200 Limit',
      description: 'You are very close to the official 200 kWh protected tariff ceiling.',
      barColor: 'bg-orange-500',
      badgeBg: 'bg-orange-50',
      badgeText: 'text-orange-800',
      badgeBorder: 'border-orange-200',
      icon: ShieldAlert,
    },
    exceeded: {
      label: 'Ceiling Exceeded',
      description: 'Cycle usage has crossed 200 kWh. Unprotected commercial rates apply.',
      barColor: 'bg-rose-600',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-800',
      badgeBorder: 'border-rose-200',
      icon: ShieldAlert,
    },
  }[summary.status.zone];

  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-8 pb-16">
      {/* Alert Banner: No Active Cycle */}
      {!activeCycle && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <span className="font-semibold block">No active billing cycle</span>
              <span className="text-amber-800/90">
                Enter your latest LESCO bill to activate exact daily pace calculations and ceiling tracking.
              </span>
            </div>
          </div>
          <button
            onClick={onNavigateToBills}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs whitespace-nowrap transition"
          >
            Add Bill
          </button>
        </div>
      )}

      {/* 1. HERO SECTION: Current Cycle & 200 kWh Threshold Answer */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
        {/* Cycle header & provenance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Current Cycle</span>
            <span className="font-semibold text-slate-800 text-sm">
              {activeCycle
                ? `${activeCycle.billingPeriodStart} — ${activeCycle.billingPeriodEnd}`
                : 'Cycle in progress'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">
              Day {summary.daysElapsed} of {summary.daysElapsed + summary.daysRemaining} ({summary.daysRemaining} days left)
            </span>
            <DataBadge origin="estimated" size="sm" />
          </div>
        </div>

        {/* Primary Question Answer: 142.4 / 200 kWh */}
        <div className="mt-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 font-mono">
                  {currentUnits.toFixed(1)}
                </span>
                <span className="text-2xl sm:text-3xl font-medium text-slate-400">
                  / {officialCeiling} kWh
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 font-medium">
                {summary.remainingUnitsOfficial > 0 ? (
                  <>
                    <strong className="text-slate-900 font-semibold font-mono">
                      {summary.remainingUnitsOfficial.toFixed(1)} kWh
                    </strong>{' '}
                    remaining before the 200 kWh subsidized tariff ceiling
                  </>
                ) : (
                  <span className="text-rose-700 font-semibold">
                    {(currentUnits - officialCeiling).toFixed(1)} kWh over official ceiling
                  </span>
                )}
              </p>
            </div>

            {/* Prominent Status Pill */}
            <div className="flex items-center gap-2 self-start lg:self-end">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText} ${statusConfig.badgeBorder}`}
              >
                <StatusIcon className="w-4 h-4" />
                <span>{statusConfig.label}</span>
              </div>
            </div>
          </div>

          {/* 200 kWh Progress Track with Safety Target & Official Limit */}
          <div className="mt-6 pt-2">
            <div className="relative w-full h-3.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full ${statusConfig.barColor} transition-all duration-500 rounded-full`}
                style={{ width: `${percentCeiling}%` }}
              />
            </div>

            {/* Target and Limit markers */}
            <div className="relative mt-2.5 flex justify-between text-xs text-slate-500">
              <span>0 kWh</span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Target: {personalTarget} kWh</span>
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  <span>Limit: {officialCeiling} kWh</span>
                </span>
              </div>
            </div>
          </div>

          {/* Advisory description */}
          <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {summary.status.description}
          </p>
        </div>
      </section>

      {/* 2. RISK, FORECAST & COST PROJECTION */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* End-of-Cycle Forecast */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">End-of-Cycle Forecast</span>
              <DataBadge origin="estimated" size="sm" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight">
                {projectedUnits.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">kWh projected</span>
            </div>

            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              {projectedUnits <= officialCeiling ? (
                <>
                  Projected{' '}
                  <strong className="text-emerald-700 font-semibold font-mono">
                    {(officialCeiling - projectedUnits).toFixed(1)} kWh under
                  </strong>{' '}
                  the 200 ceiling by cycle end based on{' '}
                  {summary.forecastMethod === 'recent_trend' ? 'recent 4-day pace' : 'cycle average'}.
                </>
              ) : (
                <span className="text-rose-700 font-semibold">
                  Warning: Projected {(projectedUnits - officialCeiling).toFixed(1)} units over ceiling!
                  Trim daily consumption to restore protected status.
                </span>
              )}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Forecast Method:</span>
            <span className="font-medium text-slate-700">
              {summary.forecastMethod === 'recent_trend' ? 'Recent 4-day trend' : 'Cycle daily average'}
            </span>
          </div>
        </div>

        {/* Financial Cost Estimate (PKR) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Estimated LESCO Charges (PKR)</span>
              <span className="text-[11px] font-medium text-slate-500">Prototype estimate · status unverified</span>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                  PKR {currentEstimatedBill.totalEstimated.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Accrued to date</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 self-center" />
              <div>
                <span
                  className={`text-2xl sm:text-3xl font-bold font-mono ${
                    projectedEstimatedBill.isPenaltyZone ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  PKR {projectedEstimatedBill.totalEstimated.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">Projected final</span>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600">
              {projectedEstimatedBill.isPenaltyZone ? (
                <span className="text-rose-700 font-semibold">
                  Rate jump warning: Exceeding 200 kWh triggers higher base tariff + general sales tax.
                </span>
              ) : (
                <span>Subsidized rate applied (~Rs 7.74/unit base). Staying under 200 saves ~Rs 5,000+ in penalty charges.</span>
              )}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Official Tariff Status:</span>
            <span className="font-medium text-emerald-700">Protected Tier Active</span>
          </div>
        </div>
      </section>

      {/* 3. KEY SUPPORTING NUMBERS (Clean Grouped Section) */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Pacing & Meter Fundamentals
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
          <div>
            <span className="text-slate-500 block">Safe Daily Pace</span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
              {summary.safeDailyAllowancePersonal}{' '}
              <span className="text-xs font-normal text-slate-500">kWh/day</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">To hit {personalTarget} target</span>
          </div>

          <div>
            <span className="text-slate-500 block">Current Daily Average</span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
              {summary.currentDailyAverage}{' '}
              <span className="text-xs font-normal text-slate-500">kWh/day</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Over {summary.daysElapsed} recorded days</span>
          </div>

          <div>
            <span className="text-slate-500 block">Latest Cumulative</span>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
              {latestReading ? latestReading.cumulativeKWh.toFixed(1) : '—'}{' '}
              <span className="text-xs font-normal text-slate-500">kWh</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Physical meter value</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Outdoor Gap</span>
              {activeCycle && (
                <button
                  onClick={onOpenSyncOutdoor}
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5"
                >
                  <Gauge className="w-3 h-3" />
                  <span>Sync</span>
                </button>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-slate-900 block mt-1">
              +{summary.gapUnits.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-500">kWh</span>
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">Reconciled difference</span>
          </div>
        </div>
      </section>

      {/* 4. RECOMMENDED NEXT ACTION */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5 shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Recommended Action</span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5">
              {schedule.recommendationText}
            </span>
            <p className="text-xs text-slate-600 mt-0.5">
              {schedule.isTodayRecorded
                ? "Today's reading is already logged. Consistent daily logging keeps pace forecasts accurate."
                : 'No reading recorded for today yet. Logging daily maintains continuous protected pacing.'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAddReading}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-semibold whitespace-nowrap transition shadow-xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Log Meter Reading</span>
        </button>
      </section>

      {/* 5. RECENT METER READINGS TABLE */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Meter Readings</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequential meter readings with validated interval consumption
            </p>
          </div>
          <button
            onClick={onOpenAddReading}
            className="text-xs font-semibold text-slate-900 hover:text-blue-600 transition flex items-center gap-1"
          >
            <span>+ Add Reading</span>
          </button>
        </div>

        {cycleReadings.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            No readings recorded in this billing cycle yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs mt-2">
              <thead>
                <tr className="text-slate-400 font-medium border-b border-slate-100">
                  <th className="py-2.5 font-medium">Timestamp</th>
                  <th className="py-2.5 text-right font-medium">Cumulative</th>
                  <th className="py-2.5 text-right font-medium">Interval Delta</th>
                  <th className="py-2.5 text-right font-medium">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycleReadings.map((r) => {
                  const d = new Date(r.reading_timestamp);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 text-slate-800">
                        <span className="font-semibold block text-slate-900">
                          {d.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {d.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        {r.cumulativeKWh.toFixed(1)}{' '}
                        <span className="text-[11px] font-normal text-slate-400">kWh</span>
                      </td>
                      <td className="py-3 text-right font-mono font-medium text-slate-700">
                        {r.consumptionFromPrevious !== undefined ? (
                          <span className="text-emerald-700 font-semibold">
                            +{r.consumptionFromPrevious.toFixed(2)} kWh
                          </span>
                        ) : (
                          <span className="text-slate-400">Baseline</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <DataBadge
                          origin={r.isBaseline ? 'official' : 'user_entered'}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
