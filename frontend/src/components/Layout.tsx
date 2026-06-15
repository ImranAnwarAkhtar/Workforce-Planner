import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Spacer reserves layout space for the fixed sidebar */}
      <div style={{
        width: collapsed ? 56 : 240,
        flexShrink: 0,
        transition: 'width 0.25s ease',
      }} />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
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
