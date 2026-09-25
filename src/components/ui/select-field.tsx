import type {SelectHTMLAttributes} from 'react';

import {Select} from '@/components/ui/select';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({className = '', ...props}: SelectFieldProps) {
  return <Select className={`select-field ${className}`.trim()} {...props} />;
}
