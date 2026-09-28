import type {ManagedArchivedRecord} from './archive.repository';

type FormAction =
  (formData: FormData) => void | Promise<void>;

export type ManagedArchiveTableLabels = {
  sectionTitle: string;
  empty: string;
  type: string;
  name: string;
  dependencies: string;
  status: string;
  actions: string;
  safe: string;
  blocked: string;
  destructive: string;
  restore: string;
  permanentDelete: string;
  confirmation: string;
  blockedReason: string;
  dependencyLabels: Record<string, string>;
};

function visibleDependencies(
  record: ManagedArchivedRecord,
  labels: ManagedArchiveTableLabels
) {
  return Object.entries(record.impact.dependencies ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      key,
      label: labels.dependencyLabels[key] ?? key,
      count
    }));
}

export function ManagedArchiveTable({
  labels,
  locale,
  records,
  restoreAction,
  permanentDeleteAction
}: {
  labels: ManagedArchiveTableLabels;
  locale: string;
  records: readonly ManagedArchivedRecord[];
  restoreAction?: FormAction;
  permanentDeleteAction?: FormAction;
}) {
  return (
    <section
      className="subsection"
      aria-label={labels.sectionTitle}
    >
      <h2>{labels.sectionTitle}</h2>

      {records.length === 0 ? (
        <p className="empty-state">{labels.empty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{labels.type}</th>
                <th>{labels.name}</th>
                <th>{labels.dependencies}</th>
                <th>{labels.status}</th>
                <th>{labels.actions}</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => {
                const dependencyItems =
                  visibleDependencies(record, labels);
                const blocked = !record.impact.isArchived;
                const destructive =
                  record.impact.dependencyCount > 0;

                return (
                  <tr
                    key={`${record.entityType}:${record.id}`}
                  >
                    <td>{record.entityType}</td>

                    <td>
                      <strong>{record.name}</strong>
                    </td>

                    <td>
                      {record.impact.dependencyCount}

                      {dependencyItems.length > 0 ? (
                        <ul className="form-help">
                          {dependencyItems.map((item) => (
                            <li key={item.key}>
                              {item.label}: {item.count}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {blocked &&
                      dependencyItems.length === 0 ? (
                        <p className="form-help">
                          {labels.blockedReason}
                        </p>
                      ) : null}
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          blocked || destructive
                            ? 'status-inactive'
                            : 'status-active'
                        }`}
                      >
                        {blocked
                          ? labels.blocked
                          : destructive
                            ? labels.destructive
                            : labels.safe}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        <form action={restoreAction}>
                          <input
                            name="locale"
                            type="hidden"
                            value={locale}
                          />
                          <input
                            name="entityType"
                            type="hidden"
                            value={record.entityType}
                          />
                          <input
                            name="id"
                            type="hidden"
                            value={record.id}
                          />

                          <button
                            className="button button-secondary"
                            type="submit"
                          >
                            {labels.restore}
                          </button>
                        </form>

                        <form
                          action={permanentDeleteAction}
                          className="inline-delete-form"
                        >
                          <input
                            name="locale"
                            type="hidden"
                            value={locale}
                          />
                          <input
                            name="entityType"
                            type="hidden"
                            value={record.entityType}
                          />
                          <input
                            name="id"
                            type="hidden"
                            value={record.id}
                          />
                          <input
                            name="expectedConfirmation"
                            type="hidden"
                            value={record.name}
                          />

                          <input
                            aria-label={labels.confirmation}
                            disabled={blocked}
                            name="confirmation"
                            placeholder={record.name}
                            required={!blocked}
                          />

                          <button
                            className="button button-danger"
                            disabled={blocked}
                            type="submit"
                          >
                            {labels.permanentDelete}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
