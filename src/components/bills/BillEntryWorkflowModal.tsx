import React, { useState } from 'react';
import { X, Check, AlertTriangle, ArrowRight, ShieldCheck, Gauge, RotateCcw, FileText } from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { validateBillingCycle, validateOutdoorSync } from '../../engine/validation';
import { calculateGapUnits } from '../../engine/calculations';
import { BillingCycle, BillCharges, OfficialBill } from '../../types';
import { getDefaultBillCharges } from '../../engine/tariffs';
import { DataBadge } from '../common/DataBadge';

interface BillEntryWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BillEntryWorkflowModal: React.FC<BillEntryWorkflowModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeCycle, cycles, household, settings, saveCycleWithOfficialBill, addReading } = useEnergy();

  // Multi-step wizard:
  // Step 1: Official bill data entry
  // Step 2: Verification & Comparison with previous cycle
  // Step 3: Outdoor meter synchronization (Gap units)
  // Step 4: Indoor meter reset prompt (if trackingMode === 'indoor_cumulative')
  // Step 5: Final Confirmation & Activation
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form states for official bill
  const [readingDate, setReadingDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [prevReading, setPrevReading] = useState<string>(() => {
    return activeCycle ? activeCycle.currentOfficialReading.toString() : '1500';
  });
  const [currReading, setCurrReading] = useState<string>('');
  const [billedUnits, setBilledUnits] = useState<string>('');
  const [billAmount, setBillAmount] = useState<string>('');
  const [billRef, setBillRef] = useState<string>('');
  const [charges, setCharges] = useState<BillCharges>(getDefaultBillCharges());

  // Step 3: Outdoor sync state
  const [outdoorSyncReading, setOutdoorSyncReading] = useState<string>('');
  const [confirmedUnusualGap, setConfirmedUnusualGap] = useState<boolean>(false);

  // Step 4: Indoor reset state
  const [indoorResetConfirmed, setIndoorResetConfirmed] = useState<boolean>(false);

  // Validation
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  // Step 1 submission -> validation
  const handleProceedToVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setValidationWarning(null);

    const prev = parseFloat(prevReading);
    const curr = parseFloat(currReading);
    const units = parseFloat(billedUnits);
    const amount = parseFloat(billAmount);

    if (isNaN(prev) || isNaN(curr) || isNaN(units) || isNaN(amount)) {
      setValidationError('Please complete all official bill fields with valid numbers.');
      return;
    }

    const valResult = validateBillingCycle(
      {
        officialReadingDate: readingDate,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        previousOfficialReading: prev,
        currentOfficialReading: curr,
        billedUnits: units,
        billAmount: amount,
      },
      cycles,
      household || undefined,
    );

    if (!valResult.isValid) {
      setValidationError(valResult.message || 'Invalid bill parameters');
      return;
    }

    if (valResult.status === 'warning' && valResult.message) {
      setValidationWarning(valResult.message);
    }

    // Pre-fill outdoor meter reading suggestion
    if (!outdoorSyncReading) {
      setOutdoorSyncReading(curr.toString());
    }

    setStep(2);
  };

  // Step 3 submission -> Outdoor sync check
  const handleProceedSync = () => {
    setValidationError(null);
    setValidationWarning(null);

    const curr = parseFloat(currReading);
    const sync = parseFloat(outdoorSyncReading);

    const syncVal = validateOutdoorSync(sync, curr);
    if (!syncVal.isValid) {
      setValidationError(syncVal.message || 'Outdoor reading cannot be lower than bill reading.');
      return;
    }

    if (syncVal.status === 'warning' && !confirmedUnusualGap) {
      setValidationWarning(syncVal.message || 'Large gap detected.');
      return;
    }

    if (settings?.trackingMode === 'indoor_cumulative') {
      setStep(4);
    } else {
      setStep(5);
    }
  };

  // Final confirmation
  const handleFinalizeNewCycle = async () => {
    const prev = parseFloat(prevReading);
    const curr = parseFloat(currReading);
    const units = parseFloat(billedUnits);
    const amount = parseFloat(billAmount);
    const sync = parseFloat(outdoorSyncReading);
    const gap = calculateGapUnits(sync, curr);

    const newCycleId = `cycle-${readingDate.slice(0, 7)}-${Math.random().toString(36).substr(2, 4)}`;

    const now = new Date().toISOString();
    const newCycle: BillingCycle = {
      id: newCycleId,
      householdId: household?.id || 'hh-1',
      connectionId: household?.connectionIds?.[0] || 'connection-lesco-demo',
      meterId: settings?.trackingMode === 'outdoor_meter' ? 'm-outdoor' : 'm-indoor',
      provider: 'LESCO',
      tariffCategory: settings?.tariffCategory || 'domestic_protected',
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      officialReadingDate: readingDate,
      previousOfficialReading: prev,
      currentOfficialReading: curr,
      billedUnits: units,
      billAmount: amount,
      status: 'active',
      syncOutdoorReading: sync,
      syncReadingTimestamp: now,
      gapUnits: parseFloat(gap.toFixed(2)),
      indoorResetConfirmed: indoorResetConfirmed,
      billReference: billRef.trim() || `LESCO-${readingDate}`,
      applicableCharges: charges,
      createdAt: now,
      updatedAt: now,
    };
    const officialBill: OfficialBill = {
      id: `bill-${newCycleId}`,
      householdId: newCycle.householdId,
      connectionId: newCycle.connectionId,
      billingCycleId: newCycle.id,
      billingPeriodStart: newCycle.billingPeriodStart,
      billingPeriodEnd: newCycle.billingPeriodEnd,
      provider: newCycle.provider,
      billReference: newCycle.billReference || `LESCO-${readingDate}`,
      issuedOn: readingDate,
      previousReading: prev,
      currentReading: curr,
      billedUnits: units,
      amount,
      charges,
      source: 'user_entered',
      extractionState: 'not_applicable',
      provenance: 'User-entered official bill fields; not provider-verified.',
      createdAt: now,
      finalizedAt: now,
      revisionStatus: 'finalized',
    };

    try {
      await saveCycleWithOfficialBill(newCycle, officialBill, `New cycle opened for bill period ending ${periodEnd}`);

      // If indoor meter was reset, log initial baseline reading 0.00
      if (settings?.trackingMode === 'indoor_cumulative' && indoorResetConfirmed) {
        await addReading({
          cycleId: newCycleId,
          meterId: 'm-indoor',
          householdId: household?.id || 'hh-1',
          connectionId: newCycle.connectionId,
          cumulativeKWh: 0.0,
          reading_timestamp: new Date().toISOString(),
          source: 'indoor_meter',
          notes: `Baseline reset after outdoor sync (Gap units: ${gap.toFixed(2)} kWh)`,
          validationStatus: 'valid',
        });
      }

      onClose();
    } catch (err) {
      setValidationError((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 p-6 shadow-xl text-slate-900 max-h-[94vh] overflow-y-auto">
        {/* Wizard Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Enter New LESCO Bill</h3>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 5 — Strict Data Reconciliation</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="grid grid-cols-5 gap-1.5 mt-4 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition ${
                step >= s ? 'bg-slate-900' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Official Bill Data Entry */}
        {step === 1 && (
          <form onSubmit={handleProceedToVerify} className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900">One Bill Per Cycle Mandate:</span> Enter the exact figures printed on your official LESCO electricity bill.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Official Meter Reading Date
                </label>
                <input
                  type="date"
                  required
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs text-slate-900 outline-none focus:border-blue-600 shadow-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Bill / Consumer Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. 04-11223-3445500"
                  value={billRef}
                  onChange={(e) => setBillRef(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs text-slate-900 outline-none focus:border-blue-600 shadow-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Billing Period Start
                </label>
                <input
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs text-slate-900 outline-none focus:border-blue-600 shadow-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Billing Period End
                </label>
                <input
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 text-xs text-slate-900 outline-none focus:border-blue-600 shadow-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Previous Official Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={prevReading}
                  onChange={(e) => setPrevReading(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 font-mono text-sm text-slate-900 font-bold outline-none focus:border-blue-600 shadow-xs"
                />
              </div>
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Current Official Reading (kWh)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={currReading}
                  onChange={(e) => setCurrReading(e.target.value)}
                  placeholder="e.g. 1500.0"
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 font-mono text-sm text-slate-900 font-bold outline-none focus:border-blue-600 shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-bold">
                    Billed Units (kWh)
                  </label>
                  <DataBadge origin="official" size="sm" />
                </div>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 180"
                  value={billedUnits}
                  onChange={(e) => setBilledUnits(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 font-mono text-sm text-blue-600 font-bold outline-none focus:border-blue-600 shadow-xs"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-700 font-bold">
                    Total Amount (PKR)
                  </label>
                  <DataBadge origin="official" size="sm" />
                </div>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 2640"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-200 py-2.5 px-3.5 font-mono text-sm text-slate-900 font-bold outline-none focus:border-blue-600 shadow-xs"
                />
              </div>
            </div>

            {validationError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                {validationError}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-slate-900 hover:bg-slate-800 py-3.5 text-xs font-bold text-white transition flex items-center justify-center gap-2 mt-2 shadow-xs"
            >
              <span>Validate & Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Compare with Previous Cycle */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bill Data Verification
            </h4>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">LESCO Official Billed Units:</span>
                <span className="font-mono font-bold text-slate-900">{billedUnits} kWh</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Official Bill Amount:</span>
                <span className="font-mono font-bold text-blue-600">PKR {Number(billAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Meter Delta (Current - Prev):</span>
                <span className="font-mono text-slate-900 font-bold">
                  {(parseFloat(currReading) - parseFloat(prevReading)).toFixed(1)} kWh
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Reading Date:</span>
                <span className="text-slate-800 font-semibold">{readingDate}</span>
              </div>
            </div>

            {validationWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{validationWarning}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-full bg-slate-100 hover:bg-slate-200 py-3 text-xs font-bold text-slate-700 transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <span>Confirm & Sync Outdoor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Outdoor Meter Synchronization (Gap Units) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs">
              <Gauge className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">Outdoor Meter Synchronization</span>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  The LESCO reader recorded your meter on {readingDate} at <strong className="text-slate-900">{currReading} kWh</strong>.
                  Please check your outdoor meter now to capture the units consumed between meter reading day and bill arrival day.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  Outdoor Meter Reading At Synchronization (kWh)
                </label>
                <DataBadge origin="calculated" size="sm" />
              </div>
              <input
                type="number"
                step="0.1"
                required
                value={outdoorSyncReading}
                onChange={(e) => {
                  setOutdoorSyncReading(e.target.value);
                  setConfirmedUnusualGap(false);
                }}
                className="w-full rounded-2xl bg-white border border-slate-200 py-3 px-4 font-mono text-xl text-slate-900 font-bold outline-none focus:border-blue-600 shadow-xs"
              />
            </div>

            {/* Gap Preview */}
            {outdoorSyncReading && parseFloat(outdoorSyncReading) >= parseFloat(currReading) && (
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Calculated Gap Units:</span>
                  <span className="font-mono text-base font-bold text-blue-700">
                    +{(parseFloat(outdoorSyncReading) - parseFloat(currReading)).toFixed(2)} kWh
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Formula: Outdoor ({outdoorSyncReading}) − Bill ({currReading}) ={' '}
                  {(parseFloat(outdoorSyncReading) - parseFloat(currReading)).toFixed(2)} kWh.
                  These units are accounted for in the new cycle!
                </p>
              </div>
            )}

            {validationError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                {validationError}
              </div>
            )}

            {validationWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <p>{validationWarning}</p>
                {!confirmedUnusualGap && (
                  <button
                    type="button"
                    onClick={() => setConfirmedUnusualGap(true)}
                    className="mt-2 px-3.5 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-full font-bold text-xs"
                  >
                    Confirm this Gap is correct
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-full bg-slate-100 hover:bg-slate-200 py-3 text-xs font-bold text-slate-700 transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleProceedSync}
                className="flex-1 rounded-full bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Reset Indoor Cumulative Meter to 000.0 */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Reset Indoor Meter to 000.0 kWh</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 leading-relaxed">
                  If using a Time Star or cumulative protector device, press its physical reset button now so it begins accumulating from 000.0 kWh.
                </p>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 font-bold shadow-xs">
                  <input
                    type="checkbox"
                    checked={indoorResetConfirmed}
                    onChange={(e) => setIndoorResetConfirmed(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                  />
                  <span>I have reset the indoor cumulative meter to 000.0</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-slate-100 hover:bg-slate-200 py-3 text-xs font-bold text-slate-700 transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 rounded-full bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <span>Proceed to Activate</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Final Confirmation & Activation */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <Check className="w-4 h-4" />
                <span>Ready to Begin New Tracking Cycle</span>
              </div>
              <p className="text-emerald-900 text-[11px] leading-relaxed">
                The previous billing cycle will be archived as Closed. All new meter readings will be associated with this new cycle starting with Gap Units of{' '}
                <strong className="text-emerald-950 font-bold">
                  {(parseFloat(outdoorSyncReading || '0') - parseFloat(currReading || '0')).toFixed(2)} kWh
                </strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Cycle Period:</span>
                <span className="font-mono text-slate-900 font-bold">{periodStart} to {periodEnd}</span>
              </div>
              <div className="flex justify-between">
                <span>Billed Units (Past Cycle):</span>
                <span className="font-mono text-slate-900 font-bold">{billedUnits} kWh</span>
              </div>
              <div className="flex justify-between">
                <span>Starting Base Reading:</span>
                <span className="font-mono text-slate-900 font-bold">{currReading} kWh</span>
              </div>
              <div className="flex justify-between">
                <span>Initial Gap Units:</span>
                <span className="font-mono text-blue-600 font-bold">
                  +{(parseFloat(outdoorSyncReading || '0') - parseFloat(currReading || '0')).toFixed(2)} kWh
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(settings?.trackingMode === 'indoor_cumulative' ? 4 : 3)}
                className="flex-1 rounded-full bg-slate-100 hover:bg-slate-200 py-3 text-xs font-bold text-slate-700 transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalizeNewCycle}
                className="flex-1 rounded-full bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-white shadow-xs transition"
              >
                Activate Cycle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
