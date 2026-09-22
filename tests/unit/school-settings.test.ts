import {describe, expect, it} from 'vitest';

import {schoolSettingsSchema} from '@/features/school-settings/school-settings.schemas';

describe('school settings validation', () => {
  it('trims names and accepts a real timezone and supported language', () => {
    expect(schoolSettingsSchema.parse({nameEn: ' Weekend School ', nameAr: ' مدرسة نهاية الأسبوع ', timezone: 'America/Edmonton', defaultLanguage: 'en'}))
      .toEqual({nameEn: 'Weekend School', nameAr: 'مدرسة نهاية الأسبوع', timezone: 'America/Edmonton', defaultLanguage: 'en'});
  });

  it('rejects empty names, invalid timezones, and unsupported language codes', () => {
    expect(schoolSettingsSchema.safeParse({nameEn: ' ', nameAr: 'Name', timezone: 'UTC', defaultLanguage: 'en'}).success).toBe(false);
    expect(schoolSettingsSchema.safeParse({nameEn: 'Name', nameAr: 'اسم', timezone: 'Mars/Phobos', defaultLanguage: 'en'}).success).toBe(false);
    expect(schoolSettingsSchema.safeParse({nameEn: 'Name', nameAr: 'اسم', timezone: 'UTC', defaultLanguage: 'fr'}).success).toBe(false);
  });
});
