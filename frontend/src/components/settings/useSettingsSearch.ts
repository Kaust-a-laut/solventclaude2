import { useState, useMemo } from 'react';
import { SETTINGS_REGISTRY, type SettingsEntry } from './settingsDefaults';

export function useSettingsSearch() {
  const [query, setQuery] = useState('');

  const results = useMemo<SettingsEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return SETTINGS_REGISTRY
      .map(entry => {
        const labelMatch = entry.label.toLowerCase().includes(q);
        const descMatch = entry.description.toLowerCase().includes(q);
        const kwMatch = entry.keywords.some(k => k.includes(q));
        const score = (labelMatch ? 3 : 0) + (descMatch ? 2 : 0) + (kwMatch ? 1 : 0);
        return { entry, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.entry);
  }, [query]);

  return { query, setQuery, results };
}
