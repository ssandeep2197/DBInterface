import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnSchema } from '@dbi/shared';
import { rows, tables } from '../api/endpoints';
import { Modal } from '../components/Modal';

type Row = Record<string, unknown>;

function inferKey(schema: ColumnSchema[], row: Row): Row {
  const pk = schema.find((c) => c.Key === 'PRI');
  if (pk) return { [pk.Field]: row[pk.Field] };
  // No PK — fall back to a composite WHERE on every column. Safer to require user
  // to define a PK in real use, but matches the legacy behavior.
  return Object.fromEntries(schema.map((c) => [c.Field, row[c.Field]]));
}

export function TableDetailPage() {
  const { database = '', table = '' } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['rows', database, table],
    queryFn: () => rows.list(database, table),
    enabled: Boolean(database && table),
  });

  const [searchCol, setSearchCol] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [insertOpen, setInsertOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row>({});

  const schema = data?.schema ?? [];
  const visibleRows = data?.rows ?? [];

  const blankDraft = useMemo<Row>(() => Object.fromEntries(schema.map((c) => [c.Field, ''])), [schema]);

  const insert = useMutation({
    mutationFn: () => rows.insert({ database, table, values: draft }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rows', database, table] });
      setInsertOpen(false);
      setDraft({});
    },
  });

  const update = useMutation({
    mutationFn: () =>
      rows.update({ database, table, values: draft, where: inferKey(schema, editing!) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rows', database, table] });
      setEditing(null);
      setDraft({});
    },
  });

  const del = useMutation({
    mutationFn: (row: Row) => rows.delete({ database, table, where: inferKey(schema, row) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rows', database, table] }),
  });

  const search = useMutation({
    mutationFn: () =>
      rows.search({ database, table, column: searchCol || schema[0]?.Field || '', query: searchVal }),
    onSuccess: (resp) => qc.setQueryData(['rows', database, table], { schema, rows: resp.rows }),
  });

  const truncate = useMutation({
    mutationFn: () => tables.truncate(database, table),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rows', database, table] }),
  });

  if (isLoading) return <div className="loading">Loading rows…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2 className="section-title">{table}</h2>
          <p className="section-sub">{visibleRows.length} rows</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => { setDraft(blankDraft); setInsertOpen(true); }}>
            + Insert Row
          </button>
          <button
            className="btn btn-danger btn-ghost"
            onClick={() => {
              if (confirm(`Truncate "${table}"? All rows will be deleted.`)) truncate.mutate();
            }}
          >
            Truncate
          </button>
        </div>
      </div>

      <div className="search-row">
        <select className="input input-sm" value={searchCol} onChange={(e) => setSearchCol(e.target.value)}>
          <option value="">— column —</option>
          {schema.map((c) => (
            <option key={c.Field} value={c.Field}>
              {c.Field}
            </option>
          ))}
        </select>
        <input
          className="input input-sm"
          placeholder="search…"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => search.mutate()} disabled={!searchVal}>
          Search
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearchVal('');
            qc.invalidateQueries({ queryKey: ['rows', database, table] });
          }}
        >
          Reset
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {schema.map((c) => (
                <th key={c.Field}>
                  {c.Field}
                  {c.Key === 'PRI' && <span className="pk-tag">PK</span>}
                </th>
              ))}
              <th>actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i}>
                {schema.map((c) => (
                  <td key={c.Field}>{String(row[c.Field] ?? '')}</td>
                ))}
                <td className="row-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(row);
                      setDraft({ ...row });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm('Delete this row?')) del.mutate(row);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={insertOpen}
        title="Insert row"
        onClose={() => setInsertOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setInsertOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={insert.isPending} onClick={() => insert.mutate()}>
              {insert.isPending ? 'Inserting…' : 'Insert'}
            </button>
          </>
        }
      >
        <RowForm schema={schema} draft={draft} setDraft={setDraft} />
        {insert.isError && <p className="text-danger">{(insert.error as Error).message}</p>}
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit row"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={update.isPending} onClick={() => update.mutate()}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <RowForm schema={schema} draft={draft} setDraft={setDraft} />
        {update.isError && <p className="text-danger">{(update.error as Error).message}</p>}
      </Modal>
    </section>
  );
}

function RowForm({
  schema,
  draft,
  setDraft,
}: {
  schema: ColumnSchema[];
  draft: Row;
  setDraft: (row: Row) => void;
}) {
  return (
    <div className="row-form">
      {schema.map((c) => (
        <label key={c.Field} className="field">
          <span className="field-label">
            {c.Field} <span className="field-type">{c.Type}</span>
          </span>
          <input
            className="input"
            value={String(draft[c.Field] ?? '')}
            onChange={(e) => setDraft({ ...draft, [c.Field]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
