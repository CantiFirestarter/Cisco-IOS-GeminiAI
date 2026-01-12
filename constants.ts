
export const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex Reasoning & Search' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Speed Synthesis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Ultra-Low Latency' }
];

export const STORAGE_KEY = 'cisco_cli_history';
export const SUGGESTIONS_KEY = 'cisco_cli_suggestions';
export const SYNC_FILE_NAME = 'cisco_expert_sync.json';

export const DEFAULT_SUGGESTIONS = [
  'BGP neighbor configuration',
  'OSPF areas on IOS XR',
  'VLAN interface setup',
  'Show spanning-tree details'
];
