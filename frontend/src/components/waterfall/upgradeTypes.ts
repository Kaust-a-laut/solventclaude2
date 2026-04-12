// ─── Model upgrade types ──────────────────────────────────────────────────────

export interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

export interface UnavailableModel {
  model: string;
  provider: string;
  available: boolean;
  usedInPresets: string[];
}

export interface ModelScanResult {
  scannedAt: string;
  unavailable: UnavailableModel[];
  upgrades: UpgradeSuggestion[];
  scanErrors: string[];
}
