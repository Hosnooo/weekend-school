import {ProtectedDownloadForm, type ProtectedDownloadAction} from '@/features/exports/protected-download-form';

import type {DeleteImpact} from './archive.types';
import {DeleteImpactDialog, type DeleteImpactLabels} from './delete-impact-dialog';

type FormAction = (formData: FormData) => void | Promise<void>;

export type ArchivePanelLabels = DeleteImpactLabels & {
  title: string;
  empty: string;
  restore: string;
  viewHistory: string;
  downloadData: string;
  downloadFirst: string;
  permanentDelete: string;
  confirmation: string;
};

export type ArchivedStudentItem = {
  id: string;
  name: string;
  impact: DeleteImpact;
};

export function ArchivePanel({
  labels,
  locale,
  students,
  restoreAction,
  downloadAction,
  permanentDeleteAction
}: {
  labels: ArchivePanelLabels;
  locale: string;
  students: readonly ArchivedStudentItem[];
  restoreAction?: FormAction;
  downloadAction?: ProtectedDownloadAction;
  permanentDeleteAction?: FormAction;
}) {
  return (
    <section className="admin-card-stack" aria-label={labels.title}>
      <h2>{labels.title}</h2>
      {students.length === 0 ? <p className="empty-state">{labels.empty}</p> : students.map((student) => (
        <article className="admin-card" key={student.id}>
          <h3>{student.name}</h3>
          <div className="row-actions">
            <form action={restoreAction}>
              <input name="locale" type="hidden" value={locale}/>
              <input name="id" type="hidden" value={student.id}/>
              <button className="button button-secondary" type="submit">{labels.restore}</button>
            </form>
            <a href={`/${locale}/students/${student.id}/edit`}>{labels.viewHistory}</a>
            <ProtectedDownloadForm action={downloadAction}>
              <input name="locale" type="hidden" value={locale}/>
              <input name="id" type="hidden" value={student.id}/>
              <button className="button button-secondary" type="submit">{labels.downloadData}</button>
            </ProtectedDownloadForm>
          </div>

          <p>{labels.downloadFirst}</p>
          <DeleteImpactDialog impact={student.impact} labels={labels}/>

          <form action={permanentDeleteAction} className="period-form">
            <input name="locale" type="hidden" value={locale}/>
            <input name="id" type="hidden" value={student.id}/>
            <label>
              {labels.confirmation}
              <input
                autoComplete="off"
                name="confirmation"
                placeholder={`DELETE ${student.id}`}
                required
                type="text"
              />
            </label>
            <button className="button button-danger" type="submit">{labels.permanentDelete}</button>
          </form>
        </article>
      ))}
    </section>
  );
}
