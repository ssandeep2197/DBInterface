import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { useLogout, useSession } from '../hooks/useSession';

export function AppShell() {
  const params = useParams();
  const navigate = useNavigate();
  const logout = useLogout();
  const session = useSession();
  const conn = session.data?.connection;

  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/databases" className="brand">
          <span className="brand-mark">◈</span> DBInterface
        </Link>
        <nav className="breadcrumb">
          <Link to="/databases">Databases</Link>
          {params.database && (
            <>
              <span className="sep">/</span>
              <Link to={`/databases/${params.database}`}>{params.database}</Link>
            </>
          )}
          {params.table && (
            <>
              <span className="sep">/</span>
              <span className="current">{params.table}</span>
            </>
          )}
        </nav>
        {conn && (
          <span className="connection-pill" title={`${conn.user}@${conn.host}:${conn.port}`}>
            ● {conn.user}@{conn.host}
            {conn.useTLS ? ' · TLS' : ''}
          </span>
        )}
        <button
          className="btn btn-ghost"
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
        >
          Logout
        </button>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
