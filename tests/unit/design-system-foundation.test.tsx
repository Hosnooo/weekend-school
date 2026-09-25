import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {Button} from '@/components/ui/button';
import {FormField} from '@/components/ui/form-field';

describe('design-system foundation contracts', () => {
  it('applies the compact size contract without leaking the size prop to the DOM', () => {
    render(<Button size="compact">Save</Button>);

    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toHaveClass('button-compact');
    expect(button).not.toHaveAttribute('size');
  });

  it('renders field errors as an accessible alert tied to the field', () => {
    render(
      <FormField htmlFor="email" label="Email" error="Enter a valid email address.">
        <input id="email" />
      </FormField>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error');
  });
});
