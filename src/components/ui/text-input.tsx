import type {InputHTMLAttributes} from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

const baseClassName = [
  'text-input',
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

export function TextInput({className = '', ...props}: TextInputProps) {
  return <input className={`${baseClassName} ${className}`.trim()} {...props} />;
}
