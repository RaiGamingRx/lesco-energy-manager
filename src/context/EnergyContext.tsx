import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppSettings,
  BillingCycle,
  CalculationSummary,
  Household,
  Meter,
  MeterReading,
  AuditRecord,
  MeterLifecycleEvent,
  OfficialBill,
} from '../types';
import { energyApplication } from '../application/container';
import { calculateCycleSummary } from '../engine/calculations';

interface EnergyContextType {
  settings: AppSettings | null;
  household: Household | null;
  meters: Meter[];
  cycles: BillingCycle[];
  bills: OfficialBill[];
  activeCycle: BillingCycle | null;
  readings: MeterReading[];
  lifecycleEvents: MeterLifecycleEvent[];
  auditLogs: AuditRecord[];
  summary: CalculationSummary;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  addReading: (reading: Omit<MeterReading, 'id' | 'entry_timestamp'>) => Promise<MeterReading>;
  updateReading: (id: string, updates: Partial<MeterReading>, reason?: string) => Promise<MeterReading>;
  deleteReading: (id: string, reason?: string) => Promise<void>;
  saveCycle: (cycle: BillingCycle, reason?: string) => Promise<BillingCycle>;
  saveCycleWithOfficialBill: (cycle: BillingCycle, bill: OfficialBill, reason?: string) => Promise<BillingCycle>;
  closeCycle: (cycleId: string, finalData?: Partial<BillingCycle>) => Promise<BillingCycle>;
  syncOutdoorMeter: (outdoorReading: number) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateHousehold: (household: Partial<Household>) => Promise<void>;
  loadScenario: (scenarioId: number) => Promise<string>;
  resetData: () => Promise<void>;
  importData: (json: string) => Promise<{ success: boolean; message: string }>;
  exportAll: () => Promise<string>;
  exportCSV: () => Promise<string>;
}

const EnergyContext = createContext<EnergyContextType | null>(null);

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [bills, setBills] = useState<OfficialBill[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<MeterLifecycleEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const snapshot = await energyApplication.loadSnapshot();

      setSettings(snapshot.settings);
      setHousehold(snapshot.household);
      setMeters(snapshot.meters);
      setCycles(snapshot.cycles);
      setBills(snapshot.bills);
      setReadings(snapshot.readings);
      setLifecycleEvents(snapshot.lifecycleEvents);
      setAuditLogs(snapshot.auditLogs);
    } catch (err) {
      setError((err as Error).message || 'Failed to load electricity records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const activeCycle = useMemo(() => {
    return cycles.find((c) => c.status === 'active') || null;
  }, [cycles]);

  const summary = useMemo(() => {
    return calculateCycleSummary(
      activeCycle,
      readings,
      settings?.trackingMode || 'indoor_cumulative',
      settings?.officialThreshold || 200,
      settings?.personalTarget || 190,
      new Date().toISOString(),
      activeCycle && household && meters.find((meter) => meter.id === activeCycle.meterId) ? { householdId: household.id, meterId: activeCycle.meterId, cycleId: activeCycle.id } : undefined,
      lifecycleEvents
    );
  }, [activeCycle, readings, settings, household, meters, lifecycleEvents]);

  const addReading = async (reading: Omit<MeterReading, 'id' | 'entry_timestamp'>) => {
    const created = await energyApplication.createReading(reading);
    await refreshData();
    return created;
  };

  const updateReading = async (id: string, updates: Partial<MeterReading>, reason?: string) => {
    const updated = await energyApplication.correctReading(id, updates, reason);
    await refreshData();
    return updated;
  };

  const deleteReading = async (id: string, reason?: string) => {
    await energyApplication.removeReading(id, reason);
    await refreshData();
  };

  const saveCycle = async (cycle: BillingCycle, reason?: string) => {
    const saved = await energyApplication.createOrUpdateCycle(cycle, reason);
    await refreshData();
    return saved;
  };

  const saveCycleWithOfficialBill = async (cycle: BillingCycle, bill: OfficialBill, reason?: string) => {
    const saved = await energyApplication.createOrUpdateCycleWithOfficialBill(cycle, bill, reason);
    await refreshData();
    return saved;
  };

  const closeCycle = async (cycleId: string, finalData?: Partial<BillingCycle>) => {
    const closed = await energyApplication.finalizeCycle(cycleId, finalData);
    await refreshData();
    return closed;
  };

  const syncOutdoorMeter = async (outdoorReading: number) => {
    if (!activeCycle) throw new Error('No active billing cycle found to synchronize outdoor meter.');
    await energyApplication.synchronizeOutdoorMeter(activeCycle, outdoorReading);
    await refreshData();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    await energyApplication.updateSettings(newSettings);
    await refreshData();
  };

  const updateHousehold = async (newHousehold: Partial<Household>) => {
    await energyApplication.updateHousehold(newHousehold);
    await refreshData();
  };

  const loadScenario = async (scenarioId: number) => {
    const message = await energyApplication.loadDevelopmentScenario(scenarioId);
    await refreshData();
    return message;
  };

  const resetData = async () => {
    await energyApplication.resetDevelopmentData();
    await refreshData();
  };

  const importData = async (json: string) => {
    const res = await energyApplication.importValidatedData(json);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const exportAll = async () => {
    return energyApplication.exportData();
  };

  const exportCSV = async () => {
    return energyApplication.exportReadings();
  };

  return (
    <EnergyContext.Provider
      value={{
        settings,
        household,
        meters,
        cycles,
        bills,
        activeCycle,
        readings,
        lifecycleEvents,
        auditLogs,
        summary,
        isLoading,
        error,
        refreshData,
        addReading,
        updateReading,
        deleteReading,
        saveCycle,
        saveCycleWithOfficialBill,
        closeCycle,
        syncOutdoorMeter,
        updateSettings,
        updateHousehold,
        loadScenario,
        resetData,
        importData,
        exportAll,
        exportCSV,
      }}
    >
      {children}
    </EnergyContext.Provider>
  );
};

export const useEnergy = () => {
  const context = useContext(EnergyContext);
  if (!context) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return context;
};
