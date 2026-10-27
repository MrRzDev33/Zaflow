import React, { useEffect, useState } from 'react';
import { parseCountInput, parseDecimalInput, roundTo } from '../../../utils/number.ts';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  suffix?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

function toDraft(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return String(roundTo(value, 2)).replace('.', ',');
}

/**
 * Input angka desimal yang menerima koma maupun titik.
 *
 * Nilai mentah disimpan sebagai draft lokal supaya pengguna bisa mengetik
 * "29," tanpa langsung dipotong oleh normalisasi. Sinkronisasi dari luar hanya
 * dilakukan saat field tidak sedang difokuskan.
 */
export const DecimalInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  placeholder = '0',
  suffix,
  className = '',
  disabled = false,
  ariaLabel,
}) => {
  const [draft, setDraft] = useState<string>(() => toDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(toDraft(value));
  }, [value, focused]);

  const handleChange = (raw: string) => {
    setDraft(raw);
    const parsed = parseDecimalInput(raw);

    if (parsed === null) {
      if (raw.trim() === '') onChange(min);
      return;
    }

    let next = Math.max(min, parsed);
    if (max !== undefined) next = Math.min(max, next);
    onChange(roundTo(next, 2));
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(toDraft(value));
        }}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 ${
          suffix ? 'pr-6' : ''
        } ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
};

/**
 * Input bilangan bulat (jumlah like, komentar, tayangan, dsb).
 */
export const IntegerInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  placeholder = '0',
  className = '',
  disabled = false,
  ariaLabel,
}) => {
  const [draft, setDraft] = useState<string>(() => toDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(toDraft(value));
  }, [value, focused]);

  const handleChange = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') {
      onChange(min);
      return;
    }

    const parsed = parseCountInput(raw);
    let next = Math.max(min, parsed);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDraft(toDraft(value));
      }}
      onChange={(e) => handleChange(e.target.value)}
      className={`w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 ${className}`}
    />
  );
};

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, children, className = '' }) => (
  <div className={className}>
    <label className="mb-1 block text-[11px] font-semibold text-slate-700">{label}</label>
    {children}
    {hint && <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{hint}</p>}
  </div>
);

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}

export const FieldSection: React.FC<SectionProps> = ({ title, description, children, right }) => (
  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        {description && <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{description}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);
