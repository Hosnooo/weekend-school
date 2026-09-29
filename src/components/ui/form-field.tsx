import {cloneElement, isValidElement, type ReactNode} from 'react';

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement<{['aria-describedby']?: string; ['aria-invalid']?: boolean | 'true' | 'false'}>(children)
    ? cloneElement(children, {
        'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid']
      })
    : children;

  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? <p className="form-hint" id={hintId}>{hint}</p> : null}
      {error ? <p className="form-error" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
