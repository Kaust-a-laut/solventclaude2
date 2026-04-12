import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/config';
import type { UnavailableModel, UpgradeSuggestion, ModelScanResult } from './upgradeTypes';

export function useModelAvailability() {
  const [unavailableModels, setUnavailableModels] = useState<UnavailableModel[]>([]);
  const [upgradeSuggestions, setUpgradeSuggestions] = useState<UpgradeSuggestion[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/models`)
      .then(res => res.ok ? res.json() : null)
      .then((data: ModelScanResult | null) => {
        if (data?.unavailable) setUnavailableModels(data.unavailable);
        if (data?.upgrades) setUpgradeSuggestions(data.upgrades);
      })
      .catch(() => {});
  }, []);

  return { unavailableModels, upgradeSuggestions };
}
