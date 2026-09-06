export interface PreferenceStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class BrowserPreferenceStore implements PreferenceStore {
  private readonly storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined;

  get(key: string): string | null {
    try { return this.storage?.getItem(key) ?? null; } catch { return null; }
  }

  set(key: string, value: string): void {
    try { this.storage?.setItem(key, value); } catch { /* Preferences are non-critical. */ }
  }
}

export const preferences: PreferenceStore = new BrowserPreferenceStore();
