import {
  ProtectedDownloadForm,
  type ProtectedDownloadAction
} from './protected-download-form';

export type ExportPanelLabels = {
  title: string;
  period: string;
  thisWeek: string;
  lastWeek: string;
  thisMonth: string;
  lastMonth: string;
  custom: string;
  allHistory: string;
  start: string;
  end: string;
  scope: string;
  school: string;
  class: string;
  subject: string;
  group: string;
  student: string;
  teacher: string;
  datasets: string;
  students: string;
  memberships: string;
  attendance: string;
  comments: string;
  reports: string;
  deliveries: string;
  csv: string;
  pdfs: string;
  fileOptions: string;
  submit: string;
};

export type ExportPanelOptions = {
  classes: readonly {id: string; label: string}[];
  subjects: readonly {
    id: string;
    label: string;
    classId: string;
  }[];
  groups: readonly {
    id: string;
    label: string;
    classSubjectId: string;
  }[];
  students: readonly {id: string; label: string}[];
  teachers: readonly {id: string; label: string}[];
};

export function ExportPanel({
  labels,
  locale,
  options,
  action
}: {
  labels: ExportPanelLabels;
  locale: string;
  options: ExportPanelOptions;
  action?: ProtectedDownloadAction;
}) {
  const datasets = [
    ['STUDENTS', labels.students, true],
    ['MEMBERSHIPS', labels.memberships, false],
    ['ATTENDANCE', labels.attendance, false],
    ['COMMENTS', labels.comments, false],
    ['REPORTS', labels.reports, false],
    ['DELIVERIES', labels.deliveries, false]
  ] as const;

  return (
    <section className="detail-section export-panel" aria-label={labels.title}>
      <h2>{labels.title}</h2>

      <ProtectedDownloadForm action={action} className="form-stack export-workflow">
        <input name="locale" type="hidden" value={locale} />

        <fieldset>
          <legend>{labels.period}</legend>

          <label>
            <select aria-label={labels.period} defaultValue="THIS_MONTH" name="periodPreset">
              <option value="THIS_WEEK">{labels.thisWeek}</option>
              <option value="LAST_WEEK">{labels.lastWeek}</option>
              <option value="THIS_MONTH">{labels.thisMonth}</option>
              <option value="LAST_MONTH">{labels.lastMonth}</option>
              <option value="CUSTOM">{labels.custom}</option>
              <option value="ALL_HISTORY">{labels.allHistory}</option>
            </select>
          </label>

          <div className="form-grid">
            <label>
              {labels.start}
              <input name="customStart" type="date" />
            </label>

            <label>
              {labels.end}
              <input name="customEnd" type="date" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{labels.scope}</legend>

          <label>
            <select aria-label={labels.scope} defaultValue="SCHOOL" name="scopeType">
              <option value="SCHOOL">{labels.school}</option>
              <option value="CLASS">{labels.class}</option>
              <option value="SUBJECT">{labels.subject}</option>
              <option value="GROUP">{labels.group}</option>
              <option value="STUDENT">{labels.student}</option>
              <option value="TEACHER">{labels.teacher}</option>
            </select>
          </label>

          <div className="form-grid">
            <label>
              {labels.class}
              <select name="classId" defaultValue="">
                <option value="">—</option>
                {options.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {labels.subject}
              <select name="classSubjectId" defaultValue="">
                <option value="">—</option>
                {options.subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {labels.group}
              <select name="subjectGroupId" defaultValue="">
                <option value="">—</option>
                {options.groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {labels.student}
              <select name="studentId" defaultValue="">
                <option value="">—</option>
                {options.students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {labels.teacher}
              <select name="teacherId" defaultValue="">
                <option value="">—</option>
                {options.teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{labels.datasets}</legend>

          <div className="form-grid">
            {datasets.map(([value, label, checked]) => (
              <label key={value}>
                <input
                  defaultChecked={checked}
                  name="datasets"
                  type="checkbox"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{labels.fileOptions}</legend>

          <div className="form-grid">
            <label>
              <input name="includeCsv" type="checkbox" />
              {labels.csv}
            </label>

            <label>
              <input
                name="includeFinalizedReportPdfs"
                type="checkbox"
              />
              {labels.pdfs}
            </label>
          </div>
        </fieldset>

        <button className="button button-primary" type="submit">
          {labels.submit}
        </button>
      </ProtectedDownloadForm>
    </section>
  );
}
