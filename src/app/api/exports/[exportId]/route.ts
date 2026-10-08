import {Buffer} from 'node:buffer';

import {generateExportArtifact} from '@/features/exports/export.generate';
import {
  collectExportGenerationData,
  getCurrentExportActor,
  getStoredExportRequest
} from '@/features/exports/export.repository';
import {authorizeStoredExportDownload} from '@/features/exports/export.service';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  {params}: {params: Promise<{exportId: string}>}
) {
  const {exportId} = await params;

  try {
    const actor = await getCurrentExportActor();
    if (!actor) return new Response('Not found', {status: 404});

    const stored = await getStoredExportRequest(exportId);
    if (!stored) return new Response('Not found', {status: 404});

    try {
      authorizeStoredExportDownload({
        actorIsAdministrator: actor.isAdministrator,
        actorActive: actor.isActive,
        actorSchoolId: actor.schoolId,
        exportSchoolId: stored.schoolId,
        expiresAt: stored.expiresAt,
        now: new Date().toISOString()
      });
    } catch (error) {
      const expired = error instanceof Error && error.message.includes('expired');
      return new Response(expired
        ? 'This export link has expired. Create a new export.'
        : 'This export is unavailable for your account. Sign in and create a new export.', {
        status: expired ? 410 : 404,
        headers: {'Cache-Control': 'private, no-store'}
      });
    }

    const data = await collectExportGenerationData(actor.schoolId, stored.request);
    const artifact = await generateExportArtifact(stored.request, data);
    const filename = artifact.filename.replace(/["\r\n]/g, '');

    return new Response(Buffer.from(artifact.bytes), {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': artifact.contentType,
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Unable to generate protected export', {error});
    return new Response('The export could not be generated. Return to Exports and try again.', {
      status: 500,
      headers: {'Cache-Control': 'private, no-store'}
    });
  }
}
