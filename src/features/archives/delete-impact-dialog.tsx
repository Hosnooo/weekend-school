import type {DeleteImpact} from './archive.types';

export type DeleteImpactLabels = {
  deleteImpact: string;
  memberships: string;
  attendanceObservations: string;
  attendanceResolutions: string;
  comments: string;
  reports: string;
  emailDeliveries: string;
};

export function DeleteImpactDialog({
  impact,
  labels
}: {
  impact: DeleteImpact;
  labels: DeleteImpactLabels;
}) {
  return (
    <section className="archive-impact" aria-label={labels.deleteImpact}>
      <strong>{labels.deleteImpact}</strong>
      <ul>
        <li>{labels.memberships}: {impact.counts.memberships}</li>
        <li>{labels.attendanceObservations}: {impact.counts.attendanceObservations}</li>
        <li>{labels.attendanceResolutions}: {impact.counts.attendanceResolutions}</li>
        <li>{labels.comments}: {impact.counts.comments}</li>
        <li>{labels.reports}: {impact.counts.reports}</li>
        <li>{labels.emailDeliveries}: {impact.counts.emailDeliveries}</li>
      </ul>
    </section>
  );
}
