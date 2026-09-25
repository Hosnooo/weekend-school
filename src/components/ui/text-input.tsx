import type {InputHTMLAttributes} from 'react';

import {Input} from '@/components/ui/input';

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({className = '', ...props}: TextInputProps) {
  return <Input className={`text-input ${className}`.trim()} {...props} />;
}
