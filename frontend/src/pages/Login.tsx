import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../hooks/useAuth';

const ROLES = [
  'Workforce Planning',
  'PMO',
  'Department Lead',
  'Function Lead',
  'Head of Commercial',
  'Head of Department',
  'EVP',
];

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [nameError, setNameError] = useState('');

  function handleContinue() {
    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    const trimmed = name.trim();
    const email = trimmed.toLowerCase().replace(/\s+/g, '.') + '@equinix.com';
    login({ name: trimmed, email, role });
    navigate('/dashboard', { replace: true });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleContinue();
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 400,
        background: '#111111',
        borderRadius: 12,
        padding: '48px 40px',
        textAlign: 'center',
        border: '1px solid #333333',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Logo */}
        <div style={{
          color: '#E31837',
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          marginBottom: 12,
        }}>
          Equinix
        </div>

        <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: '0 0 8px' }}>
          GDC Workforce<br />Planning Platform
        </h1>

        <div style={{ width: 40, height: 3, background: '#E31837', margin: '16px auto 28px', borderRadius: 2 }} />

        {/* Your Name */}
        <div style={{ marginBottom: 14, textAlign: 'left' }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: '#888888',
            marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
          }}>
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Imran Akhtar"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 13px',
              background: '#1A1A1A',
              border: `1px solid ${nameError ? '#E31837' : '#333333'}`,
              borderRadius: 6,
              color: '#FFFFFF',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box' as const,
            }}
          />
          {nameError && (
            <span style={{ fontSize: 11, color: '#E31837', marginTop: 4, display: 'block' }}>
              {nameError}
            </span>
          )}
        </div>

        {/* Role */}
        <div style={{ marginBottom: 28, textAlign: 'left' }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: '#888888',
            marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
          }}>
            Role
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 13px',
              background: '#1A1A1A',
              border: '1px solid #333333',
              borderRadius: 6,
              color: '#FFFFFF',
              fontSize: 14,
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box' as const,
            }}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          style={{
            display: 'block',
            width: '100%',
            padding: '13px 0',
            background: '#E31837',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
