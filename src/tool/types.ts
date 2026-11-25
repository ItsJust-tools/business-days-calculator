export type Mode = 'count' | 'addsub';

export type AddSubOp = 'add' | 'subtract';

/** Which days of the week count as non-business days. */
export type WeekendDef = 'sat-sun' | 'fri-sat' | 'sun-only' | 'none';

export type HolidayPreset = 'none' | 'us' | 'uk' | 'de';

export interface HistoryEntry {
  /** Short human readable description of the calculation. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Active calculator mode. */
  mode: Mode;
  /** 'count' mode: range start date (yyyy-mm-dd). */
  startDate: string;
  /** 'count' mode: range end date (yyyy-mm-dd). */
  endDate: string;
  /** Whether the end date itself is included in the count. */
  inclusiveEnd: boolean;
  /** 'addsub' mode: anchor date (yyyy-mm-dd). */
  anchorDate: string;
  /** 'addsub' mode: number of business days to move. */
  addSubDays: string;
  /** 'addsub' mode: operation direction. */
  addSubOp: AddSubOp;
  /** Selected weekend definition. */
  weekend: WeekendDef;
  /** Holiday preset region. */
  holidayPreset: HolidayPreset;
  /** Free-form holiday dates (yyyy-mm-dd), one per line or comma separated. */
  customHolidays: string;
  /** Saved calculation history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  mode: 'count',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  inclusiveEnd: true,
  anchorDate: '2026-11-02',
  addSubDays: '10',
  addSubOp: 'add',
  weekend: 'sat-sun',
  holidayPreset: 'none',
  customHolidays: '',
  history: [],
};

export const MAX_HISTORY = 20;

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'count', label: 'Count', hint: 'business days between two dates' },
  { value: 'addsub', label: 'Add / subtract', hint: 'move a date by N business days' },
];

const WEEKENDS: { value: WeekendDef; label: string; days: number[] }[] = [
  { value: 'sat-sun', label: 'Sat + Sun', days: [0, 6] },
  { value: 'fri-sat', label: 'Fri + Sat', days: [5, 6] },
  { value: 'sun-only', label: 'Sun only', days: [0] },
  { value: 'none', label: 'No weekend', days: [] },
];

const PRESETS: { value: HolidayPreset; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
];

/** Parse an ISO yyyy-mm-dd date string; returns null for invalid input (no timezone shifts). */
export function parseDate(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    date.getFullYear() !== Number(m[1]) ||
    date.getMonth() !== Number(m[2]) - 1 ||
    date.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return date;
}

/** Format a Date as yyyy-mm-dd in local time. */
export function formatDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a decimal integer like 10 or -3; returns null for empty/unparseable input. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Weekday indices (0=Sunday) treated as non-business days for the given weekend definition. */
export function weekendDays(weekend: WeekendDef): number[] {
  return WEEKENDS.find((w) => w.value === weekend)?.days ?? [0, 6];
}

export function isWeekendDay(date: Date, weekend: WeekendDef): boolean {
  return weekendDays(weekend).includes(date.getDay());
}

/** Fixed-date (non-Easter-based) holiday month/day pairs per region. */
const HOLIDAY_MD: Record<Exclude<HolidayPreset, 'none'>, [number, number][]> = {
  us: [
    [1, 1],
    [6, 19],
    [7, 4],
    [11, 11],
    [12, 25],
  ],
  uk: [
    [1, 1],
    [12, 25],
    [12, 26],
  ],
  de: [
    [1, 1],
    [5, 1],
    [10, 3],
    [12, 25],
    [12, 26],
  ],
};

/** Fixed-date holiday dates (yyyy-mm-dd) inside the given year for a preset. */
export function presetHolidayDates(year: number, preset: HolidayPreset): string[] {
  if (preset === 'none') return [];
  return HOLIDAY_MD[preset].map(([m, d]) => formatDate(new Date(year, m - 1, d)));
}

/** Parse the free-form custom holidays list into sorted unique yyyy-mm-dd strings. */
export function parseCustomHolidays(input: string): string[] {
  const dates = input
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const valid = new Set<string>();
  for (const part of dates) {
    if (parseDate(part)) valid.add(part);
  }
  return [...valid].sort();
}

/** All excluded dates (preset + custom) as a Set of yyyy-mm-dd strings. */
export function holidaySet(
  state: Pick<
    ToolState,
    'holidayPreset' | 'customHolidays' | 'mode' | 'startDate' | 'endDate' | 'anchorDate'
  >
): Set<string> {
  const set = new Set<string>();
  for (const date of parseCustomHolidays(state.customHolidays)) {
    set.add(date);
  }
  if (state.holidayPreset !== 'none') {
    const years = new Set<number>();
    for (const date of parseCustomHolidays(state.customHolidays)) {
      const parsed = parseDate(date);
      if (parsed) years.add(parsed.getFullYear());
    }
    for (const date of [
      state.mode === 'count' ? state.startDate : state.anchorDate,
      state.mode === 'count' ? state.endDate : state.anchorDate,
    ]) {
      const parsed = parseDate(date);
      if (parsed) years.add(parsed.getFullYear());
    }
    for (const year of years) {
      for (const date of presetHolidayDates(year, state.holidayPreset)) {
        set.add(date);
      }
    }
  }
  return set;
}

/** True when the date is a business day: not a weekend day and not a holiday. */
export function isBusinessDay(date: Date, weekend: WeekendDef, holidays: Set<string>): boolean {
  if (isWeekendDay(date, weekend)) return false;
  return !holidays.has(formatDate(date));
}

function* eachDay(from: Date, to: Date): Generator<Date> {
  const dir = from <= to ? 1 : -1;
  const cur = new Date(from);
  while (dir === 1 ? cur <= to : cur >= to) {
    yield new Date(cur);
    cur.setDate(cur.getDate() + dir);
  }
}

export interface CountBreakdown {
  valid: boolean;
  businessDays: number;
  totalDays: number;
  weekendDaysCount: number;
  holidaysCount: number;
  reversed: boolean;
}

/**
 * Count business days in [start, end] (inclusive of both endpoints).
 * Weekend days and holiday dates are excluded from the business count.
 */
export function countBusinessDays(
  start: string,
  end: string,
  weekend: WeekendDef,
  holidays: Set<string>
): CountBreakdown {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) {
    return {
      valid: false,
      businessDays: 0,
      totalDays: 0,
      weekendDaysCount: 0,
      holidaysCount: 0,
      reversed: false,
    };
  }
  const reversed = from > to;
  const [lo, hi] = reversed ? [to, from] : [from, to];
  let business = 0;
  let weekendCount = 0;
  let holidayCount = 0;
  let total = 0;
  for (const day of eachDay(lo, hi)) {
    total += 1;
    if (isWeekendDay(day, weekend)) {
      weekendCount += 1;
    } else if (holidays.has(formatDate(day))) {
      holidayCount += 1;
    } else {
      business += 1;
    }
  }
  return {
    valid: true,
    businessDays: business,
    totalDays: total,
    weekendDaysCount: weekendCount,
    holidaysCount: holidayCount,
    reversed,
  };
}

/**
 * Move a date by N business days. Adding always lands on a business day:
 * the anchor itself only counts when it is already a business day.
 * Subtracting is symmetric. N = 0 rolls forward to the next business day.
 */
export function addBusinessDays(
  anchor: string,
  days: number,
  weekend: WeekendDef,
  holidays: Set<string>
): { valid: boolean; date: string | null } {
  const start = parseDate(anchor);
  if (!start) return { valid: false, date: null };
  const dir = days < 0 ? -1 : 1;
  const remaining = Math.abs(days);
  const cur = new Date(start);
  if (isBusinessDay(cur, weekend, holidays)) {
    if (remaining === 0) return { valid: true, date: formatDate(cur) };
    cur.setDate(cur.getDate() + dir);
  } else {
    // roll onto the next business day in the movement direction first
    while (!isBusinessDay(cur, weekend, holidays)) {
      cur.setDate(cur.getDate() + dir);
    }
    if (remaining === 0) return { valid: true, date: formatDate(cur) };
  }
  let moved = 0;
  while (moved < remaining) {
    if (isBusinessDay(cur, weekend, holidays)) {
      moved += 1;
      if (moved < remaining) cur.setDate(cur.getDate() + dir);
    } else {
      cur.setDate(cur.getDate() + dir);
    }
    if (moved === remaining) break;
  }
  return { valid: true, date: formatDate(cur) };
}

/** Human-readable result for the active mode, or null when inputs are invalid. */
export function resultText(state: ToolState): string | null {
  const holidays = holidaySet(state);
  if (state.mode === 'count') {
    const breakdown = countBusinessDays(state.startDate, state.endDate, state.weekend, holidays);
    return breakdown.valid ? String(breakdown.businessDays) : null;
  }
  const days = parseNumber(state.addSubDays);
  if (days === null) return null;
  const effective = state.addSubOp === 'subtract' ? -Math.abs(days) : Math.abs(days);
  return addBusinessDays(state.anchorDate, effective, state.weekend, holidays).date;
}

/** One line per explanation step for the active mode. */
export function stepsFor(state: ToolState): string[] {
  const holidays = holidaySet(state);
  if (state.mode === 'count') {
    const from = parseDate(state.startDate);
    const to = parseDate(state.endDate);
    if (!from || !to) {
      return ['Enter valid start and end dates (yyyy-mm-dd) to see the steps.'];
    }
    const breakdown = countBusinessDays(state.startDate, state.endDate, state.weekend, holidays);
    return [
      `Range: ${state.startDate} → ${state.endDate}${breakdown.reversed ? ' (reversed, counted lo → hi)' : ''}${state.inclusiveEnd ? '' : ' (end date excluded)'}`,
      `Total calendar days: ${breakdown.totalDays}`,
      `Weekend days skipped: ${breakdown.weekendDaysCount}`,
      `Holiday dates skipped: ${breakdown.holidaysCount}`,
      `Business days: ${breakdown.totalDays} − ${breakdown.weekendDaysCount} − ${breakdown.holidaysCount} = ${breakdown.businessDays}`,
    ];
  }
  const days = parseNumber(state.addSubDays);
  const anchor = parseDate(state.anchorDate);
  if (days === null || !anchor) {
    return ['Enter a valid anchor date and day count to see the steps.'];
  }
  const effective = state.addSubOp === 'subtract' ? -Math.abs(days) : Math.abs(days);
  const result = addBusinessDays(state.anchorDate, effective, state.weekend, holidays);
  return [
    `Anchor: ${state.anchorDate}`,
    `Move: ${effective >= 0 ? '+' : '−'}${Math.abs(effective)} business days (weekends and holidays skipped)`,
    `Result: ${result.date ?? '—'}`,
  ];
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const result = resultText(state);
  const label = MODES.find((m) => m.value === state.mode)?.label ?? state.mode;
  return result === null ? `${label}: enter valid inputs` : `${label}: ${result}`;
}

/** Build a history entry text for the current state. */
export function historyText(state: ToolState): string {
  return summaryText(state);
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.mode === 'string' && typeof v.startDate === 'string';
}

export { MODES, WEEKENDS, PRESETS };
