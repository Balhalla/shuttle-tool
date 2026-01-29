import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Reservation } from '../types';

export function Confirm() {
  const { token } = useParams<{ token: string }>();
  const { login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const confirmingRef = useRef(false);

  useEffect(() => {
    const confirmReservation = async () => {
      if (!token) {
        setError('Invalid confirmation link');
        setLoading(false);
        return;
      }

      // Prevent double-calling due to React Strict Mode
      if (confirmingRef.current) {
        return;
      }
      confirmingRef.current = true;

      try {
        const result = await api.confirmReservation(token);
        setReservation(result.reservation);

        // Log the user in with the session token
        if (result.token && result.user) {
          login(result.token, result.user);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to confirm reservation');
      } finally {
        setLoading(false);
      }
    };

    confirmReservation();
  }, [token, login]);

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
    return <div className="loading">Confirming your reservation...</div>;
  }

  if (error) {
    return (
      <div className="confirm-page">
        <div className="error-box">
          <h1>Confirmation Failed</h1>
          <p>{error}</p>
          <Link to="/" className="btn btn-primary">
            Browse Rides
          </Link>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <div className="confirm-page">
      <div className="success-box">
        <h1>Reservation Confirmed!</h1>
        <p>Your seat has been reserved.</p>

        <div className="reservation-details">
          <h2>Ride Details</h2>
          <p>
            <strong>From:</strong> {reservation.ride.origin.name}
          </p>
          <p>
            <strong>To:</strong> {reservation.ride.destination.name}
          </p>
          <p>
            <strong>Departure:</strong> {formatTime(reservation.ride.departure_time)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/my-rides" className="btn btn-primary">
            View My Rides
          </Link>
          <Link to="/" className="btn btn-secondary">
            Browse More Rides
          </Link>
        </div>
      </div>
    </div>
  );
}
