import { useNavigate } from 'react-router-dom';
import { login } from '../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();

  function handleSignIn() {
    login();
    navigate('/dashboard', { replace: true });
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

        <div style={{ width: 40, height: 3, background: '#E31837', margin: '16px auto 24px', borderRadius: 2 }} />

        <p style={{ color: '#CCCCCC', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
          Sign in with your Equinix account to access workforce planning tools.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 0',
            background: '#E31837',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 6,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
