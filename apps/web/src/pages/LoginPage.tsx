import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin, useSession } from '../hooks/useSession';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const session = useSession();

  if (session.data?.authenticated) {
    navigate('/databases', { replace: true });
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(password, { onSuccess: () => navigate('/databases', { replace: true }) });
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1 className="auth-title">DBInterface</h1>
        <p className="auth-sub">Sign in with your MySQL root password</p>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {login.isError && (
          <p className="text-danger mt-2">
            {(login.error as Error)?.message ?? 'Login failed'}
          </p>
        )}
        <button className="btn btn-primary mt-3 w-full" disabled={login.isPending} type="submit">
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
