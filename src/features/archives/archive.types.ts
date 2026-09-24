export type ArchiveEntityType = 'STUDENT';

export type DeleteImpactCounts = {
  memberships: number;
  attendanceObservations: number;
  attendanceResolutions: number;
  comments: number;
  reports: number;
  emailDeliveries: number;
};

export type DeleteImpact = {
  entityType: ArchiveEntityType;
  entityId: string;
  isArchived: boolean;
  counts: DeleteImpactCounts;
};
