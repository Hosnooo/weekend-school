import type {ReactNode} from 'react';

export function FormField({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}
