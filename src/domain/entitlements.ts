export interface FeatureEntitlements {
  canAddHouseholds: boolean;
  canAddConnections: boolean;
  canUseMeterLifecycleEvents: boolean;
  canImportData: boolean;
}

export interface ProductEntitlements {
  maxHouseholds: number;
  maxConnectionsPerHousehold: number;
  maxMeters: number;
  features: FeatureEntitlements;
}

export const DEFAULT_FREE_ENTITLEMENTS: ProductEntitlements = {
  maxHouseholds: 1,
  maxConnectionsPerHousehold: 1,
  maxMeters: 2,
  features: {
    canAddHouseholds: false,
    canAddConnections: false,
    canUseMeterLifecycleEvents: true,
    canImportData: true,
  },
};

export interface AccountPlan {
  id: string;
  name: string;
  entitlements: ProductEntitlements;
}

export function canAddMeter(currentMeterCount: number, plan: AccountPlan): boolean {
  return currentMeterCount < plan.entitlements.maxMeters;
}