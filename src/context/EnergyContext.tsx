import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppSettings,
  BillingCycle,
  CalculationSummary,
  Household,
  Meter,
  MeterReading,
  AuditRecord,
} from '../types';
import { repository } from '../storage/repository';
import { calculateCycleSummary } from '../engine/calculations';

interface EnergyContextType {
  settings: AppSettings | null;
  household: Household | null;
  meters: Meter[];
  cycles: BillingCycle[];
  activeCycle: BillingCycle | null;
  readings: MeterReading[];
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
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [s, h, m, c, r, a] = await Promise.all([
        repository.getSettings(),
        repository.getHousehold(),
        repository.getMeters(),
        repository.getBillingCycles(),
        repository.getMeterReadings(),
        repository.getAuditRecords(),
      ]);

      setSettings(s);
      setHousehold(h);
      setMeters(m);
      setCycles(c);
      setReadings(r);
      setAuditLogs(a);
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
      settings?.personalTarget || 190
    );
  }, [activeCycle, readings, settings]);

  const addReading = async (reading: Omit<MeterReading, 'id' | 'entry_timestamp'>) => {
    const created = await repository.addMeterReading(reading);
    await refreshData();
    return created;
  };

  const updateReading = async (id: string, updates: Partial<MeterReading>, reason?: string) => {
    const updated = await repository.updateMeterReading(id, updates, reason);
    await refreshData();
    return updated;
  };

  const deleteReading = async (id: string, reason?: string) => {
    await repository.deleteMeterReading(id, reason);
    await refreshData();
  };

  const saveCycle = async (cycle: BillingCycle, reason?: string) => {
    const saved = await repository.saveBillingCycle(cycle, reason);
    await refreshData();
    return saved;
  };

  const closeCycle = async (cycleId: string, finalData?: Partial<BillingCycle>) => {
    const closed = await repository.closeBillingCycle(cycleId, finalData);
    await refreshData();
    return closed;
  };

  const syncOutdoorMeter = async (outdoorReading: number) => {
    if (!activeCycle) throw new Error('No active billing cycle found to synchronize outdoor meter.');
    const gap = Math.max(0, outdoorReading - activeCycle.currentOfficialReading);
    const updated: BillingCycle = {
      ...activeCycle,
      syncOutdoorReading: outdoorReading,
      syncReadingTimestamp: new Date().toISOString(),
      gapUnits: parseFloat(gap.toFixed(2)),
      indoorResetConfirmed: true,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveBillingCycle(
      updated,
      `Outdoor meter sync: Reading ${outdoorReading} vs bill ${activeCycle.currentOfficialReading} = Gap ${gap.toFixed(2)} kWh`
    );
    await refreshData();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    await repository.updateSettings(newSettings);
    await refreshData();
  };

  const updateHousehold = async (newHousehold: Partial<Household>) => {
    await repository.updateHousehold(newHousehold);
    await refreshData();
  };

  const loadScenario = async (scenarioId: number) => {
    const message = await repository.loadScenario(scenarioId);
    await refreshData();
    return message;
  };

  const resetData = async () => {
    await repository.resetToDefaultData();
    await refreshData();
  };

  const importData = async (json: string) => {
    const res = await repository.importData(json);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const exportAll = async () => {
    return repository.exportAllData();
  };

  const exportCSV = async () => {
    return repository.exportReadingsCSV();
  };

  return (
    <EnergyContext.Provider
      value={{
        settings,
        household,
        meters,
        cycles,
        activeCycle,
        readings,
        auditLogs,
        summary,
        isLoading,
        error,
        refreshData,
        addReading,
        updateReading,
        deleteReading,
        saveCycle,
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
