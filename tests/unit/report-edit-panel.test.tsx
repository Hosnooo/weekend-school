import {act, render} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';

import {ReportEditPanel} from '@/features/reports/report-edit-panel';

const editorId = 'report-edit-subject-whole';

function goToHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event('hashchange'));
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/en/reports/workspace/local-report');
});

describe('ReportEditPanel', () => {
  it('opens the draft editor immediately from its hash link and closes on Cancel', () => {
    const {container} = render(
      <ReportEditPanel id={editorId}>
        <p>Report form</p>
      </ReportEditPanel>
    );
    const panel = container.querySelector('.report-source-editor');

    expect(panel).toHaveAttribute('hidden');
    goToHash(editorId);
    expect(panel).not.toHaveAttribute('hidden');
    goToHash('report-edit-closed');
    expect(panel).toHaveAttribute('hidden');
  });

  it('opens a guarded server-reopened report even without a usable URL fragment', () => {
    const {container} = render(
      <ReportEditPanel id={editorId} openOnArrival>
        <p>Report form</p>
      </ReportEditPanel>
    );
    const panel = container.querySelector('.report-source-editor');

    expect(panel).not.toHaveAttribute('hidden');
    goToHash('report-edit-closed');
    expect(panel).toHaveAttribute('hidden');
  });

  it('recovers from a stale closed hash after a guarded reopen', () => {
    window.location.hash = 'report-edit-closed';
    const {container} = render(
      <ReportEditPanel id={editorId} openOnArrival>
        <p>Report form</p>
      </ReportEditPanel>
    );
    const panel = container.querySelector('.report-source-editor');

    expect(panel).not.toHaveAttribute('hidden');
    expect(window.location.hash).toBe(`#${editorId}`);
    goToHash('report-edit-closed');
    expect(panel).toHaveAttribute('hidden');
  });

  it('keeps unrelated editors closed when a different editor is selected', () => {
    const {container} = render(
      <>
        <ReportEditPanel id={editorId}>
          <p>First form</p>
        </ReportEditPanel>
        <ReportEditPanel id="report-edit-other-whole">
          <p>Second form</p>
        </ReportEditPanel>
      </>
    );

    const panels = container.querySelectorAll('.report-source-editor');
    goToHash('report-edit-other-whole');
    expect(panels[0]).toHaveAttribute('hidden');
    expect(panels[1]).not.toHaveAttribute('hidden');
  });
});
