import { describe, it, expect } from 'vitest';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  businessDaysCalculatorTool,
} from '@/tool/tool-definition';
import { DEFAULT_STATE, MAX_HISTORY, type ToolState } from '@/tool/types';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tool identity', () => {
  it('matches the tool config', () => {
    expect(businessDaysCalculatorTool.id).toBe('business-days-calculator');
    expect(businessDaysCalculatorTool.name).toBe('Business Days Calculator');
  });
});

describe('serialize', () => {
  it('serializes all fields', () => {
    const json = businessDaysCalculatorTool.serialize(state());
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.mode).toBe('count');
    expect(parsed.startDate).toBe(DEFAULT_STATE.startDate);
    expect(parsed.weekend).toBe('sat-sun');
  });

  it('keeps history entries', () => {
    const s = state({ history: [{ text: 'Count: 8', createdAt: '2026-11-25T00:00:00.000Z' }] });
    expect(serializeState(s)).toContain('"Count: 8"');
  });
});

describe('deserialize', () => {
  it('validates round-trips', () => {
    const json = businessDaysCalculatorTool.serialize(state());
    expect(businessDaysCalculatorTool.deserialize(JSON.parse(json)).success).toBe(true);
  });

  it('repairs garbage payloads', () => {
    const repaired = businessDaysCalculatorTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (!repaired.success) throw new Error('expected success');
    expect(repaired.data.weekend).toBe('sat-sun');
  });

  it('caps restored history', () => {
    const history = Array.from({ length: MAX_HISTORY + 3 }, (_, i) => ({
      text: `t${i}`,
      createdAt: '2026-11-25T00:00:00.000Z',
    }));
    const r = businessDaysCalculatorTool.deserialize({ ...DEFAULT_STATE, history });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error('expected success');
    expect(r.data.history.length).toBe(MAX_HISTORY);
  });
});

describe('withHistory and roundTrips', () => {
  it('appends newest first and caps', () => {
    let s = state();
    s = withHistory(s, 'a', new Date(2026, 0, 1, 0, 0, 0, 1));
    s = withHistory(s, 'b', new Date(2026, 0, 1, 0, 0, 0, 2));
    expect(s.history[0]?.text).toBe('b');
    expect(s.history.length).toBe(2);
  });

  it('roundTrips verifies serialization', () => {
    expect(roundTrips(state({ weekend: 'fri-sat' }))).toBe(true);
    expect(roundTrips({ ...state(), inclusiveEnd: false })).toBe(true);
  });
});
