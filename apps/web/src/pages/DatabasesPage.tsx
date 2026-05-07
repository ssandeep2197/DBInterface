import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { databases } from '../api/endpoints';
import { Modal } from '../components/Modal';

export function DatabasesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['databases'], queryFn: databases.list });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: (n: string) => databases.create({ name: n }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] });
      setOpen(false);
      setName('');
    },
  });

  const drop = useMutation({
    mutationFn: (n: string) => databases.drop(n),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  });

  if (isLoading) return <div className="loading">Loading databases…</div>;
  if (error) return <div className="error">{(error as Error).message}</div>;

  return (
    <section>
      <div className="section-header">
        <div>
          <h2 className="section-title">Your Databases</h2>
          <p className="section-sub">Click a database to explore its tables</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + New Database
        </button>
      </div>

      {data?.user.length ? (
        <div className="db-grid">
          {data.user.map((db) => (
            <div key={db} className="db-card-wrap">
              <Link to={`/databases/${db}`} className="db-card">
                <div className="db-card-name">{db}</div>
                <span className="badge badge-user">User</span>
              </Link>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm(`Drop database "${db}"? This cannot be undone.`)) drop.mutate(db);
                }}
              >
                Drop
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>No user databases yet.</p>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Create your first database
          </button>
        </div>
      )}

      <details className="sys-details">
        <summary>System Databases ({data?.system.length ?? 0})</summary>
        <ul className="sys-db-list">
          {data?.system.map((db) => <li key={db}>{db}</li>)}
        </ul>
      </details>

      <Modal
        open={open}
        title="Create New Database"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!name || create.isPending}
              onClick={() => create.mutate(name)}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <label className="field-label">Database name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. my_project_db"
          autoFocus
        />
        <p className="text-muted">Letters, numbers, and underscores only.</p>
        {create.isError && <p className="text-danger">{(create.error as Error).message}</p>}
      </Modal>
    </section>
  );
}
