import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <Link to="/" className="logo" onClick={closeMenu}>{config?.title || 'Shuttle'}</Link>
          <button
            className="hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
            <Link to="/" onClick={closeMenu}>Rides</Link>
            {user && <Link to="/my-rides" onClick={closeMenu}>My Rides</Link>}
            {(user?.role === 'driver' || user?.role === 'admin') && (
              <Link to="/driver" onClick={closeMenu}>Driver</Link>
            )}
            {user?.role === 'admin' && <Link to="/admin" onClick={closeMenu}>Admin</Link>}
            {user ? (
              <>
                <span className="user-email">{user.email}</span>
                <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary" onClick={closeMenu}>Login</Link>
            )}
          </div>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
