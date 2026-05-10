import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { EmployeesPage } from './pages/EmployeesPage';
import { GeoMigrationPage } from './pages/GeoMigrationPage';
import { LoginPage } from './pages/LoginPage';
import { PlanningPage } from './pages/PlanningPage';
import { PublicEmployeeSchedulePage } from './pages/PublicEmployeeSchedulePage';
import { AreasPage } from './pages/AreasPage';
import { RolesPage } from './pages/RolesPage';
import { TimeSlotsPage } from './pages/TimeSlotsPage';
import { UsersPage } from './pages/UsersPage';
import { WeeklyOverviewPage } from './pages/WeeklyOverviewPage';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/schedule/:employeeId" element={<PublicEmployeeSchedulePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/planning/weekly-overview" element={<WeeklyOverviewPage />} />
          <Route path="/geo-migration" element={<GeoMigrationPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings/timeslots" element={<TimeSlotsPage />} />
          <Route path="*" element={<Navigate to="/planning" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
