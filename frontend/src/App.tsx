import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import People from './pages/People';
import Allocations from './pages/Allocations';
import Requests from './pages/Requests';
import ChangeRequests from './pages/ChangeRequests';
import Recruitment from './pages/Recruitment';
import Admin from './pages/Admin';
import Import from './pages/Import';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1A1A1A', color: '#fff', border: '1px solid #333' },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/projects"        element={<Projects />} />
              <Route path="/people"          element={<People />} />
              <Route path="/allocations"     element={<Allocations />} />
              <Route path="/requests"        element={<Requests />} />
              <Route path="/change-requests" element={<ChangeRequests />} />
              <Route path="/recruitment"     element={<Recruitment />} />
              <Route path="/admin"           element={<Admin />} />
              <Route path="/import"          element={<Import />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
