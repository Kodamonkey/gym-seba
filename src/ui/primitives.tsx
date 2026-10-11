import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

/** Componentes base accesibles: objetivos táctiles ≥ 44 px, foco visible y etiquetas. */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold hover:brightness-110',
  secondary: 'bg-surface-3 text-text hover:brightness-110',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger text-white font-semibold hover:brightness-110',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy, className = '', children, disabled, ...rest },
  ref,
) {
  const sizeCls = size === 'lg' ? 'min-h-14 px-5 text-lg' : size === 'sm' ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-4';
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${sizeCls} ${VARIANT_CLASS[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

export function Card({ children, className = '', as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <As className={`rounded-2xl border border-line bg-surface p-4 ${className}`} {...rest}>
      {children}
    </As>
  );
}

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string | null;
  suffix?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, suffix, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errId = `${inputId}-err`;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={inputId}
          className={`min-h-11 w-full min-w-0 rounded-lg border bg-surface-2 px-3 text-text ${error ? 'border-danger' : 'border-line'}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined}
          {...rest}
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export function Select({
  label,
  value,
  onChange,
  options,
  className = '',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-3 text-text">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <label htmlFor={id} className="flex flex-col">
        <span>{label}</span>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </label>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-11 accent-[var(--accent)]" />
    </div>
  );
}

/** Diálogo modal nativo (<dialog>): foco atrapado y Escape para cerrar. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-text backdrop:bg-black/60"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" className="h-10 w-10 rounded-lg hover:bg-surface-2" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-4 py-3">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line p-5">
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent'; className?: string }) {
  const toneCls = {
    neutral: 'bg-surface-3 text-text',
    ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
    accent: 'bg-accent/15 text-accent',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneCls} ${className}`}>{children}</span>;
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-4 text-muted" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-muted">{children}</h2>
      {action}
    </div>
  );
}
