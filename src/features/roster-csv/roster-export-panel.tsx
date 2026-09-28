'use client';

import type {Locale} from '@/i18n/config';

export type RosterExportClassOption = {
  id: string;
  label: string;
};

export function RosterExportPanel({
  locale,
  classes,
  labels
}: {
  locale: Locale;
  classes: RosterExportClassOption[];
  labels: {
    title: string;
    description: string;
    schoolRoster: string;
    classRosters: string;
    downloadSchool: string;
    downloadClass: string;
  };
}) {
  return (
    <section className="record-form">
      <div>
        <h2>{labels.title}</h2>
        <p>{labels.description}</p>
      </div>

      <div>
        <h3>{labels.schoolRoster}</h3>

        <a
          className="button button-secondary action-link"
          href={`/api/roster/export?scope=SCHOOL&locale=${locale}`}
        >
          {labels.downloadSchool}
        </a>
      </div>

      <div>
        <h3>{labels.classRosters}</h3>

        {classes.length === 0 ? (
          <p>{labels.classRosters}</p>
        ) : (
          <div className="action-list">
            {classes.map((classOption) => (
              <a
                className="button button-secondary action-link"
                href={`/api/roster/export?scope=CLASS&classId=${encodeURIComponent(
                  classOption.id
                )}&locale=${locale}`}
                key={classOption.id}
              >
                {labels.downloadClass}: {classOption.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
