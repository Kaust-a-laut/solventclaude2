export function parseGraphData(text: string) {
  const match = text.match(/<graph_data>(.*?)<\/graph_data>/s);
  if (match) {
    try {
      return JSON.parse(match[1] ?? '');
    } catch (e) {
      console.error('Failed to parse graph data:', e);
    }
  }
  return null;
}
