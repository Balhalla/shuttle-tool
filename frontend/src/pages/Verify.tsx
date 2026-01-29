import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Verify() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const verifyingRef = useRef(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid verification link');
        return;
      }

      // Prevent double-calling due to React Strict Mode
      if (verifyingRef.current) {
        return;
      }
      verifyingRef.current = true;

      try {
        const result = await api.verifyToken(token);
        login(result.token, result.user);

        // Redirect based on role
        switch (result.user.role) {
          case 'admin':
            navigate('/admin');
            break;
          case 'driver':
            navigate('/driver');
            break;
          default:
            navigate('/');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify token');
      }
    };

    verifyToken();
  }, [token, login, navigate]);

  if (error) {
    return (
      <div className="verify-page">
        <div className="error-box">
          <h1>Verification Failed</h1>
          <p>{error}</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      <div className="loading">Verifying your login...</div>
    </div>
  );
}
