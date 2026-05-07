import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDefinition } from '@dbi/shared';
import { tables } from '../api/endpoints';
import { Modal } from '../components/Modal';

const TYPES: ColumnDefinition['type'][] = ['INT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATETIME', 'DATE', 'DECIMAL'];

export function TablesPage() {
  const { database = '' } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tables', database],
    queryFn: () => tables.list(database),
    enabled: Boolean(database),
  });

  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'name', type: 'VARCHAR', primaryKey: false, nullable: true, length: 255 },
  ]);

  const create = useMutation({
    mutationFn: () => tables.create({ database, table: tableName, columns }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables', database] });
      setOpen(false);
      setTableName('');
      setColumns([{ name: 'name', type: 'VARCHAR', primaryKey: false, nullable: true, length: 255 }]);
    },
  });

  const drop = useMutation({
    mutationFn: (t: string) => tables.drop(database, t),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables', database] }),
  });

  if (isLoading) return <div className="loading">Loading tables…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  const updateColumn = (idx: number, patch: Partial<ColumnDefinition>) =>
    setColumns((cols) => cols.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">{database}</h2>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + New Table
        </button>
      </div>

      {data?.tables.length ? (
        <ul className="table-list">
          {data.tables.map((t) => (
            <li key={t} className="table-list-item">
              <Link to={`/databases/${database}/tables/${t}`} className="table-link">
                {t}
              </Link>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm(`Drop table "${t}"?`)) drop.mutate(t);
                }}
              >
                Drop
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No tables yet — create one.</p>
      )}

      <Modal
        open={open}
        title="Create Table"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!tableName || columns.length === 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <label className="field-label">Table name</label>
        <input
          className="input"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="e.g. customers"
        />

        <h4 className="mt-3">Columns</h4>
        <table className="col-edit-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>PK</th>
              <th>Null</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    className="input input-sm"
                    value={col.name}
                    onChange={(e) => updateColumn(idx, { name: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    className="input input-sm"
                    value={col.type}
                    onChange={(e) => updateColumn(idx, { type: e.target.value as ColumnDefinition['type'] })}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={col.primaryKey}
                    onChange={(e) => updateColumn(idx, { primaryKey: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={col.nullable}
                    onChange={(e) => updateColumn(idx, { nullable: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setColumns((cs) => cs.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="btn btn-ghost btn-sm mt-2"
          onClick={() =>
            setColumns((cs) => [
              ...cs,
              { name: `col_${cs.length + 1}`, type: 'VARCHAR', primaryKey: false, nullable: true, length: 255 },
            ])
          }
        >
          + Add column
        </button>
        {create.isError && <p className="text-danger">{(create.error as Error).message}</p>}
      </Modal>
    </section>
  );
}
