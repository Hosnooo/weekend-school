import fs from 'node:fs';
import path from 'node:path';

import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {SchoolSettingsForm} from '@/features/school-settings/school-settings-form';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`
}));

vi.mock('@/features/school-settings/school-settings.actions', () => ({
  updateSchoolSettingsAction: async (state: unknown) => state
}));

const repoRoot = process.cwd();

function source(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('School Settings canonical surface', () => {
  it('keeps Settings limited to school configuration', () => {
    const page = source(
      'src/app/[locale]/(protected)/(admin)/settings/page.tsx'
    );

    expect(page).not.toContain('SecondaryLink');
    expect(page).not.toContain('/administrators');
    expect(page).not.toContain('/archives');
    expect(page).not.toContain('/exports');
  });

  it('shows only school configuration fields with explicit Save and Cancel actions', () => {
    render(
      <SchoolSettingsForm
        locale="en"
        saved={false}
        settings={{
          nameEn: 'MCE Weekend School',
          nameAr: 'مدرسة نهاية الأسبوع',
          timezone: 'America/Edmonton',
          defaultLanguage: 'en'
        }}
      />
    );

    expect(screen.getByRole('textbox', {name: 'schoolSettings.nameEn'})).toBeVisible();
    expect(screen.getByRole('textbox', {name: 'schoolSettings.nameAr'})).toBeVisible();
    expect(screen.getByRole('combobox', {name: 'schoolSettings.timezone'})).toBeVisible();
    expect(screen.getByRole('combobox', {name: 'schoolSettings.defaultLanguage'})).toBeVisible();

    expect(screen.getByRole('button', {name: 'common.save'})).toBeVisible();
    expect(screen.getByRole('button', {name: 'common.cancel'})).toBeVisible();
  });

  it('keeps legacy URLs as locale-preserving canonical redirects', () => {
    const redirects = [
      [
        'src/app/[locale]/(protected)/(admin)/settings/administrators/page.tsx',
        'administrators'
      ],
      [
        'src/app/[locale]/(protected)/(admin)/settings/archives/page.tsx',
        'archives'
      ],
      [
        'src/app/[locale]/(protected)/(admin)/groups/page.tsx',
        'classes'
      ],
      [
        'src/app/[locale]/(protected)/(teacher)/my-groups/page.tsx',
        'my-teaching'
      ]
    ] as const;

    for (const [file, destination] of redirects) {
      const route = source(file);
      expect(route).toContain(`redirect(\`/\${locale}/${destination}\`)`);
    }
  });
});
