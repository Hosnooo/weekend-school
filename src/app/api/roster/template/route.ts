import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';
import {listRosterImportCatalog} from '@/features/roster-csv/roster-csv.repository';
import {buildRosterTemplate} from '@/features/roster-csv/roster-csv.service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLocale = url.searchParams.get('locale') ?? 'en';
  const locale = isLocale(requestedLocale)
    ? requestedLocale
    : 'en';

  const profile = await requireAdministrator(locale);
  const catalog = await listRosterImportCatalog(
    profile.schoolId
  );

  const bytes = buildRosterTemplate(
    catalog.subjects
      .filter((subject) => subject.isActive)
      .map((subject) => ({
        id: subject.id,
        nameEn: subject.nameEn
      }))
  );

  const body = Uint8Array.from(bytes).buffer;

  return new Response(body, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        'attachment; filename="student-roster-template.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
