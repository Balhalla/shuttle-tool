import { useState } from 'react';
import { api } from '../api/client';

export function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.requestMagicLink(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="success-box">
          <h1>Check Your Email</h1>
          <p>We've sent a magic link to <strong>{email}</strong></p>
          <p>Click the link in the email to log in.</p>
          <p><small>Can't find it? Check your spam or junk folder.</small></p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Login</h1>
      <p>Enter your email to receive a magic link.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    </div>
  );
}
