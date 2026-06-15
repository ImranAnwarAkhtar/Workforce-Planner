import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        background: '#F5F6FA',
        overflowY: 'auto',
        padding: 28,
      }}>
        <Outlet />
      </main>
    </div>
  );
}
