import React, { useState } from 'react';
import {
  LayoutDashboard,
  Zap,
  FileText,
  History,
  Settings as SettingsIcon,
  Plus,
  Shield,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { EnergyProvider, useEnergy } from './context/EnergyContext';
import { DashboardView } from './components/dashboard/DashboardView';
import { ReadingsView } from './components/readings/ReadingsView';
import { BillsView } from './components/bills/BillsView';
import { HistoryView } from './components/history/HistoryView';
import { SettingsView } from './components/settings/SettingsView';
import { AddReadingModal } from './components/readings/AddReadingModal';
import { EditReadingModal } from './components/readings/EditReadingModal';
import { BillEntryWorkflowModal } from './components/bills/BillEntryWorkflowModal';
import { OutdoorSyncModal } from './components/bills/OutdoorSyncModal';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { PWAInstallButton } from './components/common/PWAInstallButton';
import { MeterReading } from './types';

type Tab = 'dashboard' | 'readings' | 'bills' | 'history' | 'settings';

function MainApp() {
  const { household, settings, activeCycle, summary, isLoading } = useEnergy();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isAddReadingOpen, setIsAddReadingOpen] = useState<boolean>(false);
  const [isBillEntryOpen, setIsBillEntryOpen] = useState<boolean>(false);
  const [isSyncOutdoorOpen, setIsSyncOutdoorOpen] = useState<boolean>(false);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse border border-blue-100">
          <Zap className="w-5 h-5 fill-current" />
        </div>
        <span className="text-xs font-mono font-bold tracking-wider text-slate-500">
          INITIALIZING LESCO ENERGY MANAGER...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-800">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand & Household Context */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  LESCO Energy
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                  <Shield className="w-3 h-3 text-slate-500" />
                  200 kWh Protected Tier
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {activeCycle ? (
                  <span>
                    Cycle {activeCycle.billingPeriodStart} to {activeCycle.billingPeriodEnd}
                  </span>
                ) : (
                  <span>No active cycle</span>
                )}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <PWAInstallButton compact />

            <button
              onClick={() => setIsAddReadingOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log Reading</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden sm:flex max-w-6xl mx-auto items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'dashboard'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('readings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'readings'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Readings</span>
          </button>

          <button
            onClick={() => setActiveTab('bills')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'bills'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Bills & Cycles</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === 'history'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ml-auto ${
              activeTab === 'settings'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 mb-16 sm:mb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenAddReading={() => setIsAddReadingOpen(true)}
            onOpenSyncOutdoor={() => setIsSyncOutdoorOpen(true)}
            onNavigateToBills={() => setActiveTab('bills')}
          />
        )}

        {activeTab === 'readings' && (
          <ReadingsView
            onOpenAddReading={() => setIsAddReadingOpen(true)}
            onEditReading={(r) => setEditingReading(r)}
          />
        )}

        {activeTab === 'bills' && (
          <BillsView
            onOpenBillEntry={() => setIsBillEntryOpen(true)}
            onOpenSyncOutdoor={() => setIsSyncOutdoorOpen(true)}
          />
        )}

        {activeTab === 'history' && <HistoryView />}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-md">
        <div className="grid grid-cols-5 gap-1 text-[11px]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              activeTab === 'dashboard'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('readings')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              activeTab === 'readings'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span>Readings</span>
          </button>

          <button
            onClick={() => setIsAddReadingOpen(true)}
            className="flex flex-col items-center justify-center py-1 text-slate-900 font-semibold active:scale-95 transition"
          >
            <div className="w-9 h-9 -mt-4 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Plus className="w-4 h-4" />
            </div>
            <span className="mt-0.5">Log</span>
          </button>

          <button
            onClick={() => setActiveTab('bills')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              activeTab === 'bills'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span>Bills</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg transition ${
              activeTab === 'settings'
                ? 'text-slate-900 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <SettingsIcon className="w-4 h-4 mb-0.5" />
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Modals */}
      <AddReadingModal
        isOpen={isAddReadingOpen}
        onClose={() => setIsAddReadingOpen(false)}
      />

      <EditReadingModal
        reading={editingReading}
        onClose={() => setEditingReading(null)}
      />

      <BillEntryWorkflowModal
        isOpen={isBillEntryOpen}
        onClose={() => setIsBillEntryOpen(false)}
      />

      <OutdoorSyncModal
        isOpen={isSyncOutdoorOpen}
        onClose={() => setIsSyncOutdoorOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <EnergyProvider>
      <MainApp />
    </EnergyProvider>
  );
}
