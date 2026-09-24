import type {SelectHTMLAttributes} from 'react';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement>;

const baseClassName = [
  'select-field',
  'min-h-12',
  'w-full',
  'rounded-lg',
  'border',
  'border-[var(--border)]',
  'bg-[var(--surface)]',
  'px-3.5',
  'text-[var(--text)]',
  'shadow-sm',
  'transition',
  'focus-visible:border-[var(--focus)]',
  'disabled:cursor-not-allowed',
  'disabled:opacity-60'
].join(' ');

export function SelectField({className = '', ...props}: SelectFieldProps) {
  return <select className={`${baseClassName} ${className}`.trim()} {...props} />;
}
