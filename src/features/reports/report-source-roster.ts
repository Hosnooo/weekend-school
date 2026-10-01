export type ReportSourceRosterObservation = {
  submissionId: string;
  studentId: string;
};

export function studentBelongsToReportContext(input: {
  studentId: string;
  subjectGroupId: string | null;
  selectedSourceIds: Iterable<string>;
  observations: readonly ReportSourceRosterObservation[];
  currentMembership: boolean;
}) {
  if (input.subjectGroupId === null) return true;

  const selectedSourceIds = new Set(input.selectedSourceIds);
  const sourceRoster = input.observations.filter(({submissionId}) =>
    selectedSourceIds.has(submissionId)
  );

  if (sourceRoster.length > 0) {
    return sourceRoster.some(({studentId}) => studentId === input.studentId);
  }

  return input.currentMembership;
}
