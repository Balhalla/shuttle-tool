import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PhoneInput } from '../components/PhoneInput';
import type { Ride } from '../types';

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reserving, setReserving] = useState(false);
  const [success, setSuccess] = useState('');
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
  });

  useEffect(() => {
    // Pre-fill form with user info if logged in
    if (user) {
      setForm({
        email: user.email,
        name: user.name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  useEffect(() => {
    loadRide();
  }, [rideId]);

  const loadRide = async () => {
    if (!rideId) return;
    try {
      const data = await api.getRideDetail(parseInt(rideId));
      setRide(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideId) return;

    setReserving(true);
    setError('');

    try {
      const result = await api.reserveRide(parseInt(rideId), form);
      loadRide(); // Refresh ride to update seat count
      if (result.auto_confirmed) {
        setSuccess('Your reservation has been confirmed!');
        setAutoConfirmed(true);
        refreshUser(); // Refresh user to update saved phone/name
      } else {
        setSuccess('Reservation created! Please check your email to confirm. Can\'t find it? Check your spam or junk folder.');
      }
      if (!user) {
        setForm({ email: '', name: '', phone: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reserve');
    } finally {
      setReserving(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return <div className="loading">Loading ride details...</div>;
  }

  if (!ride) {
    return <div className="error">Ride not found</div>;
  }

  return (
    <div className="ride-detail">
      <button onClick={() => navigate(-1)} className="btn btn-secondary back-btn">
        &larr; Back
      </button>

      <div className="ride-header">
        <h1>
          {ride.origin.name} &rarr; {ride.destination.name}
        </h1>
        <p className="departure-time">{formatTime(ride.departure_time)}</p>
      </div>

      <div className="ride-stats">
        <div className="stat">
          <span className="stat-label">Seats</span>
          <span className="stat-value">{ride.available_seats}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Remaining</span>
          <span className="stat-value">{ride.seats_remaining}</span>
        </div>
        <div className="stat">
          <span className={`stat-value ${ride.is_full ? 'full' : 'available'}`}>
            {ride.is_full ? 'Full' : 'Available'}
          </span>
        </div>
      </div>

      {success && (
        <div className="success">
          {success}
          {autoConfirmed && (
            <div style={{ marginTop: '1rem' }}>
              <Link to="/my-rides" className="btn btn-primary">
                View My Rides
              </Link>
            </div>
          )}
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {!ride.registration_open && !ride.is_full && (
        <div className="error">
          Registration is closed for this ride (drivers have departed).
        </div>
      )}

      {ride.registration_open && !ride.is_full && !success && (
        <form className="reserve-form" onSubmit={handleReserve}>
          <h2>Reserve a Seat</h2>
          <div className="form-group">
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Enter your name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Your Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="Enter your email"
              disabled={!!user}
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Your Phone Number</label>
            <PhoneInput
              id="phone"
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
              required
            />
          </div>
          <p className="form-note">
            {user
              ? 'Your reservation will be confirmed immediately.'
              : 'You will receive an email with a confirmation link. Your reservation will be held for 15 minutes. Your phone number is used for a driver to contact you in case of problems. All data will be removed 2 weeks after the festival.'}
          </p>
          <button type="submit" className="btn btn-primary" disabled={reserving}>
            {reserving ? 'Reserving...' : 'Reserve Seat'}
          </button>
        </form>
      )}
    </div>
  );
}
