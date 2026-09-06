import React, { useState } from 'react';
import {
  Sliders,
  Home,
  Save,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Check,
  Play,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { useEnergy } from '../../context/EnergyContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { TrackingMode } from '../../types';

export const SettingsView: React.FC = () => {
  const {
    household,
    settings,
    updateHousehold,
    updateSettings,
    loadScenario,
    exportAll,
    exportCSV,
    importData,
    resetData,
  } = useEnergy();

  // Settings State
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    settings?.trackingMode || 'indoor_cumulative'
  );
  const [personalTarget, setPersonalTarget] = useState<string>(
    settings?.personalTarget?.toString() || '190'
  );
  const [officialThreshold, setOfficialThreshold] = useState<string>(
    settings?.officialThreshold?.toString() || '200'
  );
  const [preferredTime, setPreferredTime] = useState<string>(
    settings?.preferredReadingTime || '18:00'
  );

  // Household State
  const [householdName, setHouseholdName] = useState<string>(household?.name || 'My Home');
  const [address, setAddress] = useState<string>(household?.address || '');
  const [referenceNo, setReferenceNo] = useState<string>(household?.referenceNumber || '');

  // UI status
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        trackingMode,
        personalTarget: parseFloat(personalTarget) || 190,
        officialThreshold: parseFloat(officialThreshold) || 200,
        preferredReadingTime: preferredTime,
      });

      await updateHousehold({
        name: householdName,
        address,
        referenceNumber: referenceNo,
      });

      setStatusMessage('Settings successfully saved.');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleRunScenario = async (id: number) => {
    try {
      const msg = await loadScenario(id);
      setStatusMessage(msg);
      setTimeout(() => setStatusMessage(null), 4500);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExportJSON = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesco-energy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const csv = await exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesco-meter-readings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = await importData(content);
        setStatusMessage(res.message);
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Settings & Scenarios</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure tracking modes, 200 kWh targets, test realistic scenarios, or backup data
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {/* PWA Section */}
      <div className="p-5 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-900 block">Progressive Web App</span>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Install on your mobile home screen for offline logging and instant launch.
          </span>
        </div>
        <PWAInstallButton />
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Tracking Mode Selection */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Household Meter Tracking Mode
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label
              className={`p-4 rounded-xl border cursor-pointer transition ${
                trackingMode === 'indoor_cumulative'
                  ? 'bg-slate-50 border-slate-900 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Mode A: Indoor Cumulative</span>
                <input
                  type="radio"
                  name="trackingMode"
                  checked={trackingMode === 'indoor_cumulative'}
                  onChange={() => setTrackingMode('indoor_cumulative')}
                  className="accent-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Log daily from your indoor sub-meter. At each bill, sync with the outdoor LESCO meter to account for the unlogged gap units.
              </p>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer transition ${
                  trackingMode === 'outdoor_meter'
                  ? 'bg-slate-50 border-slate-900 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Mode B: Direct Outdoor Meter</span>
                <input
                  type="radio"
                  name="trackingMode"
                  checked={trackingMode === 'outdoor_meter'}
                  onChange={() => setTrackingMode('outdoor_meter')}
                  className="accent-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                Log cumulative readings directly from the official outdoor LESCO meter. Zero reconciliation gap needed.
              </p>
            </label>
          </div>

          {/* Thresholds & Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Official Protected Ceiling
              </label>
              <input
                type="number"
                disabled
                value={officialThreshold}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2 px-3 font-mono text-xs text-slate-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Statutory limit (200 kWh)</span>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Personal Safe Target (kWh)
              </label>
              <input
                type="number"
                min="50"
                max="200"
                step="1"
                required
                value={personalTarget}
                onChange={(e) => setPersonalTarget(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-900"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Recommended safety buffer: 190</span>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-semibold block mb-1">
                Preferred Daily Check Time
              </label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 text-xs text-slate-900 outline-none focus:border-slate-900 font-medium"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Recommended ~6:00 PM</span>
            </div>
          </div>
        </div>

        {/* Household Details */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              Household Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Household / Premise Name</label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">LESCO Reference Number</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="04-11223-3445500"
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 font-mono text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-slate-700 font-semibold block mb-1">LESCO Reference Number</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="1234567"
                className="w-full rounded-xl bg-white border border-slate-300 py-2 px-3 font-mono text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Save className="w-4 h-4" />
          <span>Save Configuration</span>
        </button>
      </form>

      {/* Realistic Scenarios for Verification */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">
            Realistic Scenario Testing
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Load real-world test cases to verify pacing forecasts, tariff transitions, and safe daily limits:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleRunScenario(1)}
            className="p-4 text-left rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-400 hover:bg-white transition flex items-center justify-between group shadow-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 block group-hover:text-slate-900">
                Scenario 1: Steady 180 kWh Pace
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Consistent daily usage of ~5.8 kWh/day safely below 190.
              </span>
            </div>
            <Play className="w-4 h-4 text-slate-400 group-hover:text-slate-900 shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => handleRunScenario(2)}
            className="p-4 text-left rounded-xl bg-slate-50 border border-slate-200/80 hover:border-rose-300 hover:bg-white transition flex items-center justify-between group shadow-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 block group-hover:text-rose-700">
                Scenario 2: Heatwave Spike Risk
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Sudden AC run-rate jump to 9.2 kWh/day; projected 216 kWh.
              </span>
            </div>
            <Play className="w-4 h-4 text-rose-500 shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => handleRunScenario(3)}
            className="p-4 text-left rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-400 hover:bg-white transition flex items-center justify-between group shadow-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 block group-hover:text-slate-900">
                Scenario 3: Delayed Bill (4.2 Gap)
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Bill arrives late; accounts for outdoor gap units correctly.
              </span>
            </div>
            <Play className="w-4 h-4 text-slate-400 group-hover:text-slate-900 shrink-0 ml-2" />
          </button>

          <button
            type="button"
            onClick={() => handleRunScenario(4)}
            className="p-4 text-left rounded-xl bg-slate-50 border border-slate-200/80 hover:border-amber-300 hover:bg-white transition flex items-center justify-between group shadow-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 block group-hover:text-amber-700">
                Scenario 4: 5-Day Logging Gap
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Interval prorated evenly across the missing period.
              </span>
            </div>
            <Play className="w-4 h-4 text-amber-500 shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Backup, Export & Reset */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900">
            Data Portability & Reset
          </h3>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1 text-xs">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Readings (CSV)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={async () => {
              if (confirm('Reset all readings, cycles, and audit logs to clean initial sample state?')) {
                await resetData();
                setStatusMessage('Reset to clean initial dataset.');
                setTimeout(() => setStatusMessage(null), 3000);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold border border-rose-200 ml-auto transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
