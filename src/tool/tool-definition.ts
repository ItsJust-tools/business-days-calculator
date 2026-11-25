import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  parseNumber,
  resultText,
  stepsFor,
  summaryText,
  type AddSubOp,
  type HolidayPreset,
  type HistoryEntry,
  type Mode,
  type ToolState,
  type WeekendDef,
} from './types';

const VALID_MODES: Mode[] = ['count', 'addsub'];
const VALID_OPS: AddSubOp[] = ['add', 'subtract'];
const VALID_WEEKENDS: WeekendDef[] = ['sat-sun', 'fri-sat', 'sun-only', 'none'];
const VALID_PRESETS: HolidayPreset[] = ['none', 'us', 'uk', 'de'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    mode: state.mode,
    startDate: state.startDate,
    endDate: state.endDate,
    inclusiveEnd: state.inclusiveEnd,
    anchorDate: state.anchorDate,
    addSubDays: state.addSubDays,
    addSubOp: state.addSubOp,
    weekend: state.weekend,
    holidayPreset: state.holidayPreset,
    customHolidays: state.customHolidays,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected business days calculator state object',
    };
  }
  const v = data as Record<string, unknown>;
  const mode: Mode = VALID_MODES.includes(v.mode as Mode) ? (v.mode as Mode) : DEFAULT_STATE.mode;
  const addSubOp: AddSubOp = VALID_OPS.includes(v.addSubOp as AddSubOp)
    ? (v.addSubOp as AddSubOp)
    : DEFAULT_STATE.addSubOp;
  const weekend: WeekendDef = VALID_WEEKENDS.includes(v.weekend as WeekendDef)
    ? (v.weekend as WeekendDef)
    : DEFAULT_STATE.weekend;
  const holidayPreset: HolidayPreset = VALID_PRESETS.includes(v.holidayPreset as HolidayPreset)
    ? (v.holidayPreset as HolidayPreset)
    : DEFAULT_STATE.holidayPreset;
  const state: ToolState = {
    mode,
    startDate: stringOr(v.startDate, DEFAULT_STATE.startDate),
    endDate: stringOr(v.endDate, DEFAULT_STATE.endDate),
    inclusiveEnd: boolOr(v.inclusiveEnd, DEFAULT_STATE.inclusiveEnd),
    anchorDate: stringOr(v.anchorDate, DEFAULT_STATE.anchorDate),
    addSubDays: stringOr(v.addSubDays, DEFAULT_STATE.addSubDays),
    addSubOp,
    weekend,
    holidayPreset,
    customHolidays: stringOr(v.customHolidays, DEFAULT_STATE.customHolidays),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

const numberOrNull = (value: string): number | null => parseNumber(value);

export const businessDaysCalculatorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { numberOrNull, resultText, stepsFor, summaryText };
