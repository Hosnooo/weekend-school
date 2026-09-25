import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {Button} from '@/components/ui/button';
import {ConfirmationDialog} from '@/components/ui/confirmation-dialog';

describe('confirmation dialog async completion', () => {
  it('stays open until an async confirmation finishes', async () => {
    const user = userEvent.setup();
    let resolveConfirmation!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    }));

    render(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Delete assignment"
        description="Delete this assignment?"
        onConfirm={onConfirm}
        title="Delete assignment"
        trigger={<Button>Open delete</Button>}
      />
    );

    await user.click(screen.getByRole('button', {name: 'Open delete'}));
    await user.click(screen.getByRole('button', {name: 'Delete assignment'}));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', {name: 'Delete assignment'})).toBeVisible();

    resolveConfirmation();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', {name: 'Delete assignment'})).not.toBeInTheDocument();
    });
  });
});
