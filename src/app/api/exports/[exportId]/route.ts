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
        actorRole: actor.role,
        actorActive: actor.isActive,
        actorSchoolId: actor.schoolId,
        exportSchoolId: stored.schoolId,
        expiresAt: stored.expiresAt,
        now: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return new Response(message.includes('expired') ? 'Export expired' : 'Not found', {
        status: message.includes('expired') ? 410 : 404
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
    return new Response('Export unavailable', {status: 500});
  }
}
