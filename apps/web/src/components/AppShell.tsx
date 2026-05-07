import { Outlet, Link, useNavigate, useParams } from 'react-router-dom';
import { useLogout } from '../hooks/useSession';

export function AppShell() {
  const params = useParams();
  const navigate = useNavigate();
  const logout = useLogout();

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
