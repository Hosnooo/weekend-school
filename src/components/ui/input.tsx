import type {InputHTMLAttributes} from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({className = '', ...props}: InputProps) {
  return <input className={`input ${className}`.trim()} {...props} />;
}
