'use server';

import {createHash} from 'node:crypto';

import {revalidatePath} from 'next/cache';

import {isLocale, type Locale} from '@/i18n/config';
import {requireAdministrator} from '@/lib/auth/require-profile';

import {
  confirmRosterImport,
  listRosterImportCatalog
} from './roster-csv.repository';
import {
  buildRosterImportPreview,
  parseRosterCsv
} from './roster-csv.service';
import type {
  RosterImportPreview,
  RosterImportSummary
} from './roster-csv.types';

const MAX_ROSTER_FILE_BYTES = 1024 * 1024;

export type RosterImportActionState = {
  status: 'idle' | 'preview' | 'success' | 'error';
  error:
    | 'fileRequired'
    | 'fileTooLarge'
    | 'invalidCsv'
    | 'validation'
    | 'duplicateImport'
    | 'catalogUnavailable'
    | 'recordsChanged'
    | 'save'
    | null;
  preview: RosterImportPreview | null;
  sourceRows: string | null;
  summary: RosterImportSummary | null;
};


function localeFrom(formData: FormData): Locale {
  const value = String(formData.get('locale') ?? 'en');
  return isLocale(value) ? value : 'en';
}

function encodedSize(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function errorState(
  error: NonNullable<RosterImportActionState['error']>,
  options?: {
    preview?: RosterImportPreview | null;
    sourceRows?: string | null;
  }
): RosterImportActionState {
  return {
    status: 'error',
    error,
    preview: options?.preview ?? null,
    sourceRows: options?.sourceRows ?? null,
    summary: null
  };
}

function canonicalHash(preview: RosterImportPreview) {
  const canonicalRows = preview.rows
    .flatMap((row) => row.canonical ? [row.canonical] : [])
    .map(({rowNumber, classId, ...canonical}) => {
      void rowNumber;
      void classId;
      return canonical;
    })
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right))
    );

  return createHash('sha256')
    .update(JSON.stringify(canonicalRows))
    .digest('hex');
}

export async function previewRosterImportAction(
  _previousState: RosterImportActionState,
  formData: FormData
): Promise<RosterImportActionState> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return errorState('fileRequired');
  }

  if (file.size > MAX_ROSTER_FILE_BYTES) {
    return errorState('fileTooLarge');
  }

  let sourceRows: string;
  try {
    sourceRows = await file.text();
  } catch (error) {
    console.error('Unable to read roster CSV', {error});
    return errorState('invalidCsv');
  }

  if (encodedSize(sourceRows) > MAX_ROSTER_FILE_BYTES) {
    return errorState('fileTooLarge');
  }

  let parsed: ReturnType<typeof parseRosterCsv>;
  try {
    parsed = parseRosterCsv(sourceRows);
  } catch (error) {
    console.error('Unable to parse roster CSV', {error});
    return errorState('invalidCsv');
  }

  try {
    const catalog = await listRosterImportCatalog(profile.schoolId);
    const preview = buildRosterImportPreview(parsed, catalog);
    return {
      status: 'preview',
      error: null,
      preview,
      sourceRows,
      summary: null
    };
  } catch (error) {
    console.error('Unable to load roster validation data', {error});
    return errorState('catalogUnavailable', {sourceRows});
  }
}

export async function confirmRosterImportAction(
  _previousState: RosterImportActionState,
  formData: FormData
): Promise<RosterImportActionState> {
  const locale = localeFrom(formData);
  const profile = await requireAdministrator(locale);
  const sourceRows = String(formData.get('sourceRows') ?? '');

  if (!sourceRows) {
    return errorState('validation');
  }

  if (encodedSize(sourceRows) > MAX_ROSTER_FILE_BYTES) {
    return errorState('fileTooLarge');
  }

  let preview: RosterImportPreview;

  let parsed: ReturnType<typeof parseRosterCsv>;
  try {
    parsed = parseRosterCsv(sourceRows);
  } catch (error) {
    console.error('Unable to parse roster CSV before import', {error});
    return errorState('invalidCsv', {sourceRows});
  }

  try {
    // Recheck the actual live school catalog at confirmation time.
    // The browser's stored Class/Group IDs are never authoritative.
    const catalog = await listRosterImportCatalog(profile.schoolId);
    preview = buildRosterImportPreview(parsed, catalog);
  } catch (error) {
    console.error('Unable to revalidate roster against current school data', {error});
    return errorState('catalogUnavailable', {sourceRows});
  }

  if (
    preview.hasErrors ||
    preview.rows.some((row) => row.canonical === null)
  ) {
    return errorState('validation', {
      preview,
      sourceRows
    });
  }

  const canonicalRows = preview.rows.flatMap((row) =>
    row.canonical ? [row.canonical] : []
  );

  const importHash = canonicalHash(preview);

  let summary: RosterImportSummary;

  try {
    summary = await confirmRosterImport({
      importHash,
      rows: canonicalRows
    });
  } catch (error) {
    console.error('Unable to import roster CSV', {error});

    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    const reason = code === '23505'
      ? 'duplicateImport'
      : ['23503', '23514', '40001', 'P0002'].includes(code)
        ? 'recordsChanged'
        : 'save';
    return errorState(reason, {preview, sourceRows});
  }

  revalidatePath(`/${locale}/students`);
  revalidatePath(`/${locale}/classes`);
  revalidatePath(`/${locale}/guardians`);

  return {
    status: 'success',
    error: null,
    preview: null,
    sourceRows: null,
    summary
  };
}
