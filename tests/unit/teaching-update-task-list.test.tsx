import {render, screen} from '@testing-library/react';
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';

import arabic from '../../messages/ar.json';
import english from '../../messages/en.json';
import {TeachingUpdateTaskList} from '@/features/teaching-updates/teaching-update-task-list';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({locale}: {locale: 'en' | 'ar'}) => (key: string) => {
    const messages = locale === 'ar' ? arabic.teachingUpdates : english.teachingUpdates;
    return key === 'status.OPEN' ? messages.status.OPEN : messages[key as keyof typeof messages];
  }
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({href, children, ...props}: {href: string; children: ReactNode}) =>
    <a href={href} {...props}>{children}</a>
}));

const contexts = [{
  classSubjectId: 'subject-1',
  subjectGroupId: null,
  classNameEn: 'Foundations',
  classNameAr: 'التمهيدي',
  subjectNameEn: 'Faith & Character',
  subjectNameAr: 'الإيمان والأخلاق',
  groupNameEn: null,
  groupNameAr: null
}];

const updates = [{
  id: 'update-1',
  classSubjectId: 'subject-1',
  subjectGroupId: null,
  requestSetId: 'request-1',
  coverageKind: 'RANGE' as const,
  periodStart: '2026-09-01',
  periodEnd: '2026-09-05'
}];

describe('Teacher open Teaching Update tasks', () => {
  it('shows the covered range in English and one continuation action', async () => {
    render(await TeachingUpdateTaskList({contexts, locale: 'en', updates}));

    expect(screen.getByText('Sep 1, 2026 – Sep 5, 2026')).toBeVisible();
    expect(screen.getByText('Requested by an Administrator')).toBeVisible();
    expect(screen.getByRole('link', {name: 'Continue update'}))
      .toHaveAttribute('href', '/my-teaching/update?submissionId=update-1');
  });

  it('shows the covered range in Arabic with the same task identity', async () => {
    render(await TeachingUpdateTaskList({contexts, locale: 'ar', updates}));

    expect(screen.getByText('١ سبتمبر ٢٠٢٦ – ٥ سبتمبر ٢٠٢٦')).toBeVisible();
    expect(screen.getByText('مطلوب من الإدارة')).toBeVisible();
    expect(screen.getByRole('link', {name: 'متابعة التحديث'}))
      .toHaveAttribute('href', '/my-teaching/update?submissionId=update-1');
  });
});
