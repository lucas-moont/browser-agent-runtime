import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Browser Agent Runtime',
  version: '0.1.0',
  description:
    'Local-first browser agent runtime using Chrome Built-in AI and page tools.',
  action: {
    default_title: 'Browser Agent Runtime',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['sidePanel', 'scripting', 'tabGroups'],
  // Side-panel clicks do not grant activeTab; page tools need host access to inject.
  // https://developer.chrome.com/docs/extensions/reference/api/sidePanel
  host_permissions: ['http://*/*', 'https://*/*'],
})
