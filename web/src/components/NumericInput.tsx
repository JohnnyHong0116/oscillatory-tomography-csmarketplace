import React, { useEffect, useState } from 'react';

/** Raw editing text must survive backspace, minus signs and exponent entry.
 * Empty/invalid input propagates NaN to validation, never a silent fallback. */
export function NumericInput({
  value,
  onValueChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : '');
  useEffect(() => {
    setDraft((previous) => {
      const parsed = previous.trim() === '' ? NaN : Number(previous);
      return Object.is(parsed, value) ? previous : Number.isFinite(value) ? String(value) : '';
    });
  }, [value]);
  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onValueChange(event.target.value.trim() === '' ? NaN : Number(event.target.value));
      }}
    />
  );
}
