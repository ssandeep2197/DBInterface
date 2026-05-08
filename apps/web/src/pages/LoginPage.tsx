import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConnectionOptions } from '@dbi/shared';
import { useLogin, useSession } from '../hooks/useSession';

const PRESETS: { label: string; partial: Partial<ConnectionOptions> }[] = [
  { label: 'Local MySQL', partial: { host: '127.0.0.1', port: 3306, user: 'root' } },
  { label: 'PlanetScale', partial: { host: 'aws.connect.psdb.cloud', port: 3306, useTLS: true } },
  { label: 'TiDB Cloud', partial: { host: 'gateway01.us-west-2.prod.aws.tidbcloud.com', port: 4000, useTLS: true } },
  { label: 'AWS RDS', partial: { host: '', port: 3306, useTLS: true } },
];

export function LoginPage() {
  const [form, setForm] = useState<ConnectionOptions>({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: '',
    useTLS: false,
  });
  const login = useLogin();
  const navigate = useNavigate();
  const session = useSession();

  if (session.data?.authenticated) {
    navigate('/databases', { replace: true });
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ConnectionOptions = { ...form, database: form.database || undefined };
    login.mutate(payload, { onSuccess: () => navigate('/databases', { replace: true }) });
  };

  const update = <K extends keyof ConnectionOptions>(key: K, value: ConnectionOptions[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const applyPreset = (partial: Partial<ConnectionOptions>) =>
    setForm((f) => ({ ...f, ...partial }));

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="auth-title">DBInterface</h1>
        <p className="auth-sub">Connect to any MySQL — local, hosted, or cloud</p>

        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              className="btn btn-ghost btn-sm"
              onClick={() => applyPreset(p.partial)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field-label">Host</span>
            <input
              className="input"
              autoComplete="off"
              value={form.host}
              onChange={(e) => update('host', e.target.value)}
              placeholder="127.0.0.1 or db.example.com"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Port</span>
            <input
              className="input"
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => update('port', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field-label">User</span>
            <input
              className="input"
              autoComplete="username"
              value={form.user}
              onChange={(e) => update('user', e.target.value)}
              placeholder="root"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Database (optional)</span>
            <input
              className="input"
              autoComplete="off"
              value={form.database ?? ''}
              onChange={(e) => update('database', e.target.value)}
              placeholder="my_db"
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.useTLS}
            onChange={(e) => update('useTLS', e.target.checked)}
          />
          <span>Use TLS (required by most hosted MySQL providers)</span>
        </label>

        {login.isError && (
          <p className="text-danger mt-2">
            {(login.error as Error)?.message ?? 'Connection failed'}
          </p>
        )}
        <button className="btn btn-primary mt-3 w-full" disabled={login.isPending} type="submit">
          {login.isPending ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
