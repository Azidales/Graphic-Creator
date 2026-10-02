import { useId, type ReactNode } from 'react';
import { isHexColor } from '../chart/palettes';

export function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {children}
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function Segmented<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  const body = (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  return label ? <Field label={label}>{body}</Field> : body;
}

export function Toggle({ label, checked, onChange, id }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; id?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label className="toggle" htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  help,
  id,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  help?: ReactNode;
  id?: string;
}) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className="field">
      <label className="label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="select"
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  id,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="slider">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={inputId}>{format(value)}</output>
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="field">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  placeholder,
  id,
  allowEmpty = true,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  id?: string;
  allowEmpty?: boolean;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="field">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="input"
        inputMode="decimal"
        placeholder={placeholder}
        defaultValue={value === null ? '' : String(value).replace('.', ',')}
        key={value === null ? 'empty' : String(value)}
        onBlur={(e) => commitNumber(e.target.value, onChange, allowEmpty)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitNumber((e.target as HTMLInputElement).value, onChange, allowEmpty);
        }}
      />
    </div>
  );
}

function commitNumber(raw: string, onChange: (v: number | null) => void, allowEmpty: boolean) {
  const t = raw.trim();
  if (t === '') {
    if (allowEmpty) onChange(null);
    return;
  }
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  if (Number.isFinite(n)) onChange(n);
}

export function ColorInput({ label, value, onChange, id }: { label?: string; value: string; onChange: (v: string) => void; id?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const body = (
    <div className="color-field">
      <span className="swatch" style={{ background: value }}>
        <input id={inputId} type="color" value={isHexColor(value) && value.length === 7 ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={label ?? 'Cor'} />
      </span>
      <input
        className="input"
        aria-label={`${label ?? 'Cor'} em hexadecimal`}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (isHexColor(v)) onChange(v.toLowerCase());
          else e.target.value = value;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        key={value}
        defaultValue={value}
      />
    </div>
  );
  return label ? <Field label={label}>{body}</Field> : body;
}

export function Swatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <span className="swatch" style={{ background: value }} title={label}>
      <input type="color" value={isHexColor(value) && value.length === 7 ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    </span>
  );
}
