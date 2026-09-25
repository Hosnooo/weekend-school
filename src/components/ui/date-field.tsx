import type {InputProps} from '@/components/ui/input';
import {Input} from '@/components/ui/input';

export function DateField(props: Omit<InputProps, 'type'>) {
  return <Input type="date" {...props} />;
}
