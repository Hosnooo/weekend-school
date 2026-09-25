import type {InputProps} from '@/components/ui/input';
import {Input} from '@/components/ui/input';

export function SearchInput({className = '', ...props}: Omit<InputProps, 'type'>) {
  return <Input {...props} className={`search-input ${className}`.trim()} type="search" />;
}
