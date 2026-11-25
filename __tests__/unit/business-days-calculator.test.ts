import { describe, it, expect } from 'vitest';
import {
  parseDate,
  formatDate,
  parseNumber,
  weekendDays,
  isWeekendDay,
  presetHolidayDates,
  parseCustomHolidays,
  holidaySet,
  isBusinessDay,
  countBusinessDays,
  addBusinessDays,
  resultText,
  stepsFor,
  summaryText,
  DEFAULT_STATE,
  MAX_HISTORY,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  businessDaysCalculatorTool,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('parseDate', () => {
  it('parses valid ISO dates without timezone shift', () => {
    const d = parseDate('2026-11-02');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(10);
    expect(d?.getDate()).toBe(2);
  });

  it('rejects invalid formats and impossible dates', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('2026-11-2')).toBeNull();
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
    expect(parseDate('2026-1-02')).toBeNull();
  });
});

describe('formatDate', () => {
  it('zero-pads month and day', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('parseNumber', () => {
  it('parses signed integers and rejects other input', () => {
    expect(parseNumber('10')).toBe(10);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('+7')).toBe(7);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1.5')).toBeNull();
    expect(parseNumber('12,5')).toBeNull();
  });
});

describe('weekends', () => {
  it('maps weekend definitions to correct weekday indices', () => {
    expect(weekendDays('sat-sun')).toEqual([0, 6]);
    expect(weekendDays('fri-sat')).toEqual([5, 6]);
    expect(weekendDays('sun-only')).toEqual([0]);
    expect(weekendDays('none')).toEqual([]);
  });

  it('classifies individual days', () => {
    // 2026-11-14 is a Saturday
    const sat = parseDate('2026-11-14') as Date;
    const sun = parseDate('2026-11-15') as Date;
    const fri = parseDate('2026-11-13') as Date;
    expect(sat.getDay()).toBe(6);
    expect(sun.getDay()).toBe(0);
    expect(fri.getDay()).toBe(5);
    expect(isWeekendDay(sat, 'sat-sun')).toBe(true);
    expect(isWeekendDay(sun, 'sat-sun')).toBe(true);
    expect(isWeekendDay(fri, 'sat-sun')).toBe(false);
    expect(isWeekendDay(fri, 'fri-sat')).toBe(true);
    expect(isWeekendDay(sat, 'none')).toBe(false);
  });
});

describe('presetHolidayDates', () => {
  it('returns fixed-date holidays for a year', () => {
    const us = presetHolidayDates(2026, 'us');
    expect(us).toContain('2026-01-01');
    expect(us).toContain('2026-07-04');
    expect(us).toContain('2026-12-25');
    expect(presetHolidayDates(2026, 'de')).toContain('2026-10-03');
    expect(presetHolidayDates(2026, 'uk')).toContain('2026-12-26');
    expect(presetHolidayDates(2026, 'none')).toEqual([]);
  });
});

describe('parseCustomHolidays', () => {
  it('parses comma and newline separated dates, drops invalid ones, dedupes and sorts', () => {
    expect(parseCustomHolidays('2026-12-24, 2026-12-31')).toEqual(['2026-12-24', '2026-12-31']);
    expect(parseCustomHolidays('2026-12-24\n2026-12-24\n2026-02-30')).toEqual(['2026-12-24']);
    expect(parseCustomHolidays('')).toEqual([]);
    expect(parseCustomHolidays('garbage')).toEqual([]);
  });
});

describe('holidaySet', () => {
  it('merges custom dates and preset dates for relevant years', () => {
    const set = holidaySet(state({ holidayPreset: 'de', customHolidays: '2026-12-24' }));
    expect(set.has('2026-12-24')).toBe(true);
    expect(set.has('2026-10-03')).toBe(true);
    expect(set.has('2027-10-03')).toBe(false);
  });

  it('is empty without preset or custom dates', () => {
    expect(holidaySet(state()).size).toBe(0);
  });
});

describe('countBusinessDays', () => {
  it('counts a single week correctly', () => {
    const b = countBusinessDays('2026-11-02', '2026-11-06', 'sat-sun', new Set());
    // Mon-Fri = 5
    expect(b.businessDays).toBe(5);
    expect(b.totalDays).toBe(5);
    expect(b.weekendDaysCount).toBe(0);
  });

  it('spans weekend boundaries across multiple weeks', () => {
    const b = countBusinessDays('2026-11-02', '2026-11-13', 'sat-sun', new Set());
    // Mon 2 → Fri 13: 12 calendar days, Sat 7 + Sun 8 are weekend, 10 business days
    expect(b.totalDays).toBe(12);
    expect(b.weekendDaysCount).toBe(2);
    expect(b.businessDays).toBe(10);
  });

  it('handles reversed ranges by counting forward', () => {
    const a = countBusinessDays('2026-11-13', '2026-11-02', 'sat-sun', new Set());
    expect(a.reversed).toBe(true);
    expect(a.businessDays).toBe(10);
  });

  it('honors custom weekend definitions', () => {
    const satSun = countBusinessDays('2026-11-09', '2026-11-15', 'sat-sun', new Set());
    const friSat = countBusinessDays('2026-11-09', '2026-11-15', 'fri-sat', new Set());
    const sunOnly = countBusinessDays('2026-11-09', '2026-11-15', 'sun-only', new Set());
    // one week
    expect(satSun.businessDays).toBe(5);
    // Mon-Thu open, Fri+Sat off, Sun open => 5 business days too (Mon, Tue, Wed, Thu, Sun)
    expect(friSat.businessDays).toBe(5);
    // only Sunday off => 6 business days
    expect(sunOnly.businessDays).toBe(6);
  });

  it('excludes holidays from the count and reports the breakdown', () => {
    const holidays = new Set(['2026-11-03', '2026-11-04']);
    const b = countBusinessDays('2026-11-02', '2026-11-06', 'sat-sun', holidays);
    expect(b.businessDays).toBe(3);
    expect(b.holidaysCount).toBe(2);
  });

  it('returns invalid for malformed dates', () => {
    expect(countBusinessDays('bad', '2026-11-06', 'sat-sun', new Set()).valid).toBe(false);
    expect(countBusinessDays('2026-11-02', 'x', 'sat-sun', new Set()).valid).toBe(false);
  });

  it('counts single-day ranges', () => {
    expect(countBusinessDays('2026-11-02', '2026-11-02', 'sat-sun', new Set()).businessDays).toBe(
      1
    );
    expect(countBusinessDays('2026-11-14', '2026-11-14', 'sat-sun', new Set()).businessDays).toBe(
      0
    );
  });
});

describe('addBusinessDays', () => {
  const noHolidays = new Set<string>();

  it('adds days and lands on a business day', () => {
    // Mon 2026-11-02 + 5 business days = Mon 2026-11-09
    expect(addBusinessDays('2026-11-02', 5, 'sat-sun', noHolidays).date).toBe('2026-11-09');
    // Fri 2026-11-13 + 1 = Mon 2026-11-16
    expect(addBusinessDays('2026-11-13', 1, 'sat-sun', noHolidays).date).toBe('2026-11-16');
  });

  it('subtracts days symmetrically', () => {
    expect(addBusinessDays('2026-11-09', -5, 'sat-sun', noHolidays).date).toBe('2026-11-02');
    expect(addBusinessDays('2026-11-16', -1, 'sat-sun', noHolidays).date).toBe('2026-11-13');
  });

  it('zero stays on a business day and rolls forward from a weekend day', () => {
    expect(addBusinessDays('2026-11-13', 0, 'sat-sun', noHolidays).date).toBe('2026-11-13');
    expect(addBusinessDays('2026-11-14', 0, 'sat-sun', noHolidays).date).toBe('2026-11-16');
    expect(addBusinessDays('2026-11-15', 0, 'sat-sun', noHolidays).date).toBe('2026-11-16');
    expect(addBusinessDays('2026-11-02', 0, 'sat-sun', noHolidays).date).toBe('2026-11-02');
  });

  it('skips holidays', () => {
    const holidays = new Set(['2026-11-03']);
    // Mon 2 + 1 business day skips Tuesday holiday => Wed 4
    expect(addBusinessDays('2026-11-02', 1, 'sat-sun', holidays).date).toBe('2026-11-04');
  });

  it('honors custom weekend definitions', () => {
    // Fri 13 is a weekend day under Fri+Sat: roll forward to the next open day, Sun 15
    const r = addBusinessDays('2026-11-13', 1, 'fri-sat', noHolidays);
    expect(r.date).toBe('2026-11-15');
  });

  it('returns invalid for malformed anchors', () => {
    expect(addBusinessDays('nope', 1, 'sat-sun', noHolidays).valid).toBe(false);
  });
});

describe('isBusinessDay', () => {
  it('rejects weekends and holidays, accepts other days', () => {
    const sat = parseDate('2026-11-14') as Date;
    const mon = parseDate('2026-11-16') as Date;
    expect(isBusinessDay(sat, 'sat-sun', new Set())).toBe(false);
    expect(isBusinessDay(mon, 'sat-sun', new Set(['2026-11-16']))).toBe(false);
    expect(isBusinessDay(mon, 'sat-sun', new Set())).toBe(true);
  });
});

describe('resultText', () => {
  it('returns business day counts in count mode', () => {
    const expected = countBusinessDays(
      DEFAULT_STATE.startDate,
      DEFAULT_STATE.endDate,
      DEFAULT_STATE.weekend,
      holidaySet(DEFAULT_STATE)
    ).businessDays;
    expect(resultText(state())).toBe(String(expected));
    expect(expected).toBe(10);
  });

  it('returns dates in addsub mode', () => {
    expect(
      resultText(
        state({ mode: 'addsub', anchorDate: '2026-11-02', addSubDays: '5', addSubOp: 'add' })
      )
    ).toBe('2026-11-09');
    expect(
      resultText(
        state({ mode: 'addsub', anchorDate: '2026-11-09', addSubDays: '5', addSubOp: 'subtract' })
      )
    ).toBe('2026-11-02');
  });

  it('returns null for invalid input', () => {
    expect(resultText(state({ mode: 'addsub', addSubDays: 'x' }))).toBeNull();
    expect(resultText(state({ mode: 'count', startDate: 'bad' }))).toBeNull();
  });
});

describe('stepsFor and summaryText', () => {
  it('explains count mode', () => {
    const steps = stepsFor(state());
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((s) => s.includes('Business days'))).toBe(true);
    expect(summaryText(state())).toContain('Count:');
  });

  it('explains invalid input gracefully', () => {
    expect(stepsFor(state({ startDate: 'oops' }))[0]).toContain('valid start and end dates');
    expect(summaryText(state({ mode: 'addsub', addSubDays: '' }))).toContain('enter valid inputs');
  });
});

describe('serialize/deserialize', () => {
  it('round-trips full state', () => {
    const s = state({ history: [{ text: 'Count: 8', createdAt: '2026-11-25T00:00:00.000Z' }] });
    expect(roundTrips(s)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (!restored.success) throw new Error('expected success');
    expect(restored.data).toEqual(s);
  });

  it('repairs invalid payloads with defaults', () => {
    const r = deserializeState({ nope: true });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error('expected success');
    expect(r.data.mode).toBe(DEFAULT_STATE.mode);
    expect(r.data.weekend).toBe('sat-sun');
  });

  it('falls back on invalid enum values', () => {
    const r = deserializeState({
      mode: 'bogus',
      weekend: 'bogus',
      holidayPreset: 'xx',
      addSubOp: 'sideways',
    });
    expect(r.success).toBe(true);
    if (!r.success) throw new Error('expected success');
    expect(r.data.mode).toBe('count');
    expect(r.data.weekend).toBe('sat-sun');
    expect(r.data.holidayPreset).toBe('none');
    expect(r.data.addSubOp).toBe('add');
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState('json').success).toBe(false);
  });

  it('caps history at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
      s = withHistory(s, `entry-${i}`, new Date(2026, 0, 1, 0, 0, 0, i));
    }
    expect(s.history.length).toBe(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry-${MAX_HISTORY + 4}`);
  });
});

describe('tool definition', () => {
  it('exposes the registered tool identity', () => {
    expect(businessDaysCalculatorTool.id).toBe('business-days-calculator');
    expect(businessDaysCalculatorTool.name).toBe('Business Days Calculator');
    expect(businessDaysCalculatorTool.initialState).toEqual(DEFAULT_STATE);
  });

  it('declares four exporters', () => {
    expect(businessDaysCalculatorTool.exporters).toHaveLength(4);
  });
});
