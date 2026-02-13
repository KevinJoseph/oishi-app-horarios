import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EmployeesPage } from './pages/EmployeesPage';
import { PlanningPage } from './pages/PlanningPage';
import { RolesPage } from './pages/RolesPage';
import { TimeSlotsPage } from './pages/TimeSlotsPage';
import { WeeklyOverviewPage } from './pages/WeeklyOverviewPage';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/planning/weekly-overview" element={<WeeklyOverviewPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/settings/timeslots" element={<TimeSlotsPage />} />
        <Route path="*" element={<Navigate to="/planning" replace />} />
      </Route>
    </Routes>
  );
}
