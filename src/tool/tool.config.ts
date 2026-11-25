import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'business-days-calculator',
  name: 'Business Days Calculator',
  description:
    'Calculate the number of business days between two dates, or add/subtract business days from a date, with custom weekend definitions, holiday exclusion presets and shareable URL state.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentSubtle: 'rgba(139, 92, 246, 0.12)',
    brand: 'Business Days Calculator',
    icon: '📅',
  },
  shortcuts: [
    {
      title: 'Business Days Calculator',
      shortcuts: [
        { keys: 'T', label: 'Count mode', description: 'switch to count business days mode' },
        {
          keys: 'A',
          label: 'Add/subtract mode',
          description: 'switch to add/subtract business days mode',
        },
        {
          keys: 'Y',
          label: 'Copy result',
          description: 'copy the current result to the clipboard',
        },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
