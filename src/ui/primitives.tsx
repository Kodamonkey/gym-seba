import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeftIcon, CloseIcon } from './icons';

/** Componentes base accesibles: objetivos táctiles ≥ 44 px, foco visible y etiquetas. */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'inverse';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold active:opacity-80',
  secondary: 'bg-surface-2 text-text font-medium active:bg-surface-3',
  ghost: 'bg-transparent text-text active:bg-surface-2',
  danger: 'bg-transparent text-danger font-medium active:bg-danger/10',
  destructive: 'bg-danger text-white font-semibold active:opacity-80',
  /** Sobre fondos oscuros. */
  inverse: 'bg-bg text-text font-semibold active:opacity-80',
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
  const sizeCls = size === 'lg' ? 'min-h-14 px-6 text-[17px]' : size === 'sm' ? 'min-h-11 px-3.5 text-sm' : 'min-h-12 px-5';
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-[opacity,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${sizeCls} ${VARIANT_CLASS[variant]} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

/** Botón solo con icono: siempre con etiqueta accesible. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(function IconButton(
  { label, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full text-text transition-colors active:bg-surface-2 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Encabezado de pantalla: volver (opcional), título y acción a la derecha. */
export function PageHeader({
  back,
  title,
  subtitle,
  action,
  progress,
}: {
  back?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** 0–1: barra fina de avance bajo el encabezado. */
  progress?: number;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 flex min-h-16 items-center gap-1 border-b border-line bg-bg/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      {back ? (
        <Link to={back} aria-label="Volver" className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full active:bg-surface-2">
          <ChevronLeftIcon size={24} />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>}
        {subtitle && <p className="truncate text-[13px] text-muted tabular">{subtitle}</p>}
      </div>
      {action}
      {progress !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-2" aria-hidden>
          <div className="h-full bg-ok transition-[width] duration-300" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

export function Card({ children, className = '', as: As = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <As className={`rounded-2xl bg-surface-2 p-4 ${className}`} {...rest}>
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
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={inputId}
          className={`min-h-12 w-full min-w-0 rounded-xl border bg-surface-2 px-3.5 text-base text-text ${error ? 'border-danger' : 'border-transparent'}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined}
          {...rest}
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
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
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-12 w-full min-w-0 rounded-xl bg-surface-2 px-3 text-base text-text">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Interruptor de ajuste en una fila de lista. */
export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span className="flex flex-col">
        <span className="text-[15px]">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-7 w-12 flex-none cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-6 before:w-6 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-ok checked:before:translate-x-5"
      />
    </label>
  );
}

/**
 * Diálogo modal nativo (<dialog>) presentado como hoja inferior en el teléfono:
 * foco atrapado, Escape y toque fuera para cerrar.
 */
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="sheet mx-auto mb-0 mt-auto w-full rounded-t-3xl bg-surface p-0 text-text shadow-2xl sm:mb-auto sm:w-[min(30rem,calc(100vw-2rem))] sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col pb-[env(safe-area-inset-bottom)]">
          <header className="flex shrink-0 items-center justify-between gap-2 px-5 pb-1 pt-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <IconButton label="Cerrar" onClick={onClose} className="-mr-2 text-muted">
              <CloseIcon />
            </IconButton>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">{children}</div>
          {footer && <footer className="flex shrink-0 flex-col gap-2 px-5 pb-5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Pill({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent'; className?: string }) {
  const toneCls = {
    neutral: 'bg-surface-2 text-muted',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
    accent: 'bg-accent text-accent-ink',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneCls} ${className}`}>{children}</span>;
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
    <div className="mb-1 mt-2 flex min-h-11 items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}
