import {isLocale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

import {
  collectRosterExportRows,
  getRosterSchoolTimezone
} from '@/features/roster-csv/roster-export.repository';
import {buildRosterExportCsv} from '@/features/roster-csv/roster-export.service';

export const runtime = 'nodejs';

function dateInTimezone(
  timeZone: string,
  instant = new Date()
) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);

  const year = parts.find(
    (part) => part.type === 'year'
  )?.value;
  const month = parts.find(
    (part) => part.type === 'month'
  )?.value;
  const day = parts.find(
    (part) => part.type === 'day'
  )?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine school date');
  }

  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const requestedLocale =
    url.searchParams.get('locale') ?? 'en';

  const locale = isLocale(requestedLocale)
    ? requestedLocale
    : 'en';

  const scope = url.searchParams.get('scope');

  if (scope !== 'SCHOOL' && scope !== 'CLASS') {
    return new Response('Unsupported roster export scope', {
      status: 400
    });
  }

  const profile = await requireAdministrator(locale);

  let exportScope:
    | {type: 'SCHOOL'}
    | {type: 'CLASS'; classId: string};

  if (scope === 'SCHOOL') {
    exportScope = {type: 'SCHOOL'};
  } else {
    const classId = url.searchParams.get('classId');

    if (!classId) {
      return new Response('Class is required', {
        status: 400
      });
    }

    exportScope = {
      type: 'CLASS',
      classId
    };
  }

  try {
    const timezone = await getRosterSchoolTimezone(
      profile.schoolId
    );

    const onDate = dateInTimezone(timezone);

    const exportData = await collectRosterExportRows(
      profile.schoolId,
      exportScope,
      onDate
    );

    const bytes = buildRosterExportCsv(
      exportData.subjects,
      exportData.rows
    );

    const body = Uint8Array.from(bytes).buffer;

    const filename =
      scope === 'SCHOOL'
        ? `weekend-school-roster-${onDate}.csv`
        : `weekend-school-class-roster-${onDate}.csv`;

    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition':
          `attachment; filename="${filename}"`,
        'Content-Type': 'text/csv; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Unable to export roster', {error});

    return new Response('The roster could not be generated. Refresh the export page and try again.', {
      status: 500,
      headers: {'Cache-Control': 'private, no-store'}
    });
  }
}
