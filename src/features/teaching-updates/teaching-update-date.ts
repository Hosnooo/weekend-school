export function formatTeachingUpdateDate(value: string, locale: 'en' | 'ar') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-arab' : 'en', {
    dateStyle: locale === 'ar' ? 'long' : 'medium',
    timeZone: 'UTC'
  }).format(new Date(`${value}T12:00:00Z`));
}

export function formatTeachingUpdateRange(start: string, end: string, locale: 'en' | 'ar') {
  const formattedStart = formatTeachingUpdateDate(start, locale);
  if (start === end) return formattedStart;
  return `${formattedStart} – ${formatTeachingUpdateDate(end, locale)}`;
}
