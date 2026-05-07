import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { TablesPage } from './pages/TablesPage';
import { TableDetailPage } from './pages/TableDetailPage';
import { RequireAuth } from './components/RequireAuth';
import { AppShell } from './components/AppShell';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/databases" element={<DatabasesPage />} />
        <Route path="/databases/:database" element={<TablesPage />} />
        <Route path="/databases/:database/tables/:table" element={<TableDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/databases" replace />} />
    </Routes>
  );
}
