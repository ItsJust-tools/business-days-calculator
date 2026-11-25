'use client';

import React from 'react';
import { resultText, stepsFor } from '../tool-definition';
import {
  countBusinessDays,
  formatDate,
  holidaySet,
  parseCustomHolidays,
  parseDate,
  presetHolidayDates,
  MODES,
  WEEKENDS,
  PRESETS,
  type ToolState,
  type AddSubOp,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function DateField({
  label,
  value,
  onChangeState,
  testid,
}: {
  label: string;
  value: string;
  onChangeState: (next: string) => void;
  testid: string;
}) {
  const valid = parseDate(value) !== null;
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChangeState(e.target.value)}
        data-testid={testid}
        className={`${inputClass} ${valid ? '' : 'border-red-400'}`}
      />
    </label>
  );
}

function TodayButton({
  onClickState,
  testid,
}: {
  onClickState: (v: string) => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={() => onClickState(formatDate(new Date()))}
      className="mt-1 text-xs text-violet-600 hover:underline dark:text-violet-400"
    >
      Today
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const result = resultText(state);
  const steps = stepsFor(state);
  const holidays = holidaySet(state);
  const breakdown = countBusinessDays(state.startDate, state.endDate, state.weekend, holidays);

  const inputsByMode = (() => {
    switch (state.mode) {
      case 'count':
        return (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="count-inputs">
            <div>
              <DateField
                label="Start date"
                value={state.startDate}
                onChangeState={(v) => update({ startDate: v })}
                testid="input-start-date"
              />
              <TodayButton onClickState={(v) => update({ startDate: v })} testid="start-today" />
            </div>
            <div>
              <DateField
                label="End date"
                value={state.endDate}
                onChangeState={(v) => update({ endDate: v })}
                testid="input-end-date"
              />
              <TodayButton onClickState={(v) => update({ endDate: v })} testid="end-today" />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={state.inclusiveEnd}
                onChange={(e) => update({ inclusiveEnd: e.target.checked })}
                data-testid="input-inclusive-end"
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Include the end date in the count
            </label>
          </div>
        );
      case 'addsub':
        return (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="addsub-inputs">
            <div>
              <DateField
                label="Anchor date"
                value={state.anchorDate}
                onChangeState={(v) => update({ anchorDate: v })}
                testid="input-anchor-date"
              />
              <TodayButton onClickState={(v) => update({ anchorDate: v })} testid="anchor-today" />
            </div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Business days
              <input
                type="text"
                inputMode="numeric"
                value={state.addSubDays}
                onChange={(e) => update({ addSubDays: e.target.value })}
                data-testid="input-addsub-days"
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <div className="flex gap-2" role="group" aria-label="Operation">
                {(['add', 'subtract'] as const).map((op: AddSubOp) => (
                  <button
                    key={op}
                    type="button"
                    role="tab"
                    aria-selected={state.addSubOp === op}
                    data-testid={`addsub-${op}`}
                    onClick={() => update({ addSubOp: op })}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                      state.addSubOp === op
                        ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
                    }`}
                  >
                    {op === 'add' ? 'Add business days' : 'Subtract business days'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
    }
  })();

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="business-days-canvas">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Calculator mode"
        data-testid="mode-tabs"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={state.mode === mode.value}
            data-testid={`mode-tab-${mode.value}`}
            title={mode.hint}
            onClick={() => onChange?.({ ...state, mode: mode.value })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              state.mode === mode.value
                ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {inputsByMode}

      <div className="grid gap-4 sm:grid-cols-2" data-testid="exclusion-inputs">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Weekend definition
          <select
            value={state.weekend}
            onChange={(e) => update({ weekend: e.target.value as ToolState['weekend'] })}
            data-testid="input-weekend"
            className={inputClass}
          >
            {WEEKENDS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Holiday preset
          <select
            value={state.holidayPreset}
            onChange={(e) =>
              update({ holidayPreset: e.target.value as ToolState['holidayPreset'] })
            }
            data-testid="input-holiday-preset"
            className={inputClass}
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
          Custom holiday dates (one per line or comma separated, yyyy-mm-dd)
          <textarea
            value={state.customHolidays}
            onChange={(e) => update({ customHolidays: e.target.value })}
            data-testid="input-custom-holidays"
            rows={2}
            className={`${inputClass} font-mono h-20`}
            placeholder={'2026-12-24, 2026-12-31'}
          />
          <span
            className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400"
            data-testid="custom-holidays-count"
          >
            {parseCustomHolidays(state.customHolidays).length} valid custom holiday date(s)
          </span>
        </label>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Result
        </span>
        <span className="flex items-center justify-center gap-2">
          <span className="block font-mono text-3xl font-bold" data-testid="result-main">
            {result ?? '—'}
          </span>
          {result ? <CopyButton value={result} testid="copy-result" /> : null}
        </span>
        {state.mode === 'count' && breakdown.valid ? (
          <span
            className="mt-2 block text-xs text-gray-600 dark:text-gray-300"
            data-testid="count-breakdown"
          >
            {breakdown.totalDays} total days · {breakdown.weekendDaysCount} weekend ·{' '}
            {breakdown.holidaysCount} holiday
            {breakdown.reversed ? ' · range reversed (counted forward)' : ''}
          </span>
        ) : null}
        <span
          className="mt-2 block text-xs text-gray-600 dark:text-gray-300"
          data-testid="result-summary"
        >
          {result === null ? 'Enter valid inputs' : 'Copy the result or save it below.'}
        </span>
        {result ? (
          <button
            type="button"
            data-testid="btn-save-history"
            onClick={() => onSaveHistory?.(result)}
            className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Save to history
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Step-by-step
        </h3>
        <ol className="space-y-1 text-xs text-gray-700 dark:text-gray-300" data-testid="steps-list">
          {steps.map((step, i) => (
            <li key={i} className="font-mono">
              {step}
            </li>
          ))}
        </ol>
      </div>

      {state.holidayPreset !== 'none' ? (
        <p
          className="text-center text-xs text-gray-500 dark:text-gray-400"
          data-testid="preset-hint"
        >
          Preset holidays applied:{' '}
          {presetHolidayDates(new Date().getFullYear(), state.holidayPreset).join(', ')}
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved calculations yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="text-gray-700 dark:text-gray-300">{entry.text}</span>
                <CopyButton value={entry.text} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All calculations run locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
