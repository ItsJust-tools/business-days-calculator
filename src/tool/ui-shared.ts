import { MODES, WEEKENDS, PRESETS, type ToolState } from './types';

export { MODES, WEEKENDS, PRESETS };

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.mode === 'string' && typeof v.startDate === 'string';
}
