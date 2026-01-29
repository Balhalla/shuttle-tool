import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Reservation } from '../types';

export function MyRides() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      const data = await api.getMyReservations();
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return <div className="loading">Loading your rides...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="my-rides">
      <h1>My Rides</h1>

      {reservations.length === 0 ? (
        <div className="no-rides">
          <p>You don't have any upcoming rides.</p>
          <Link to="/" className="btn btn-primary">
            Browse Available Rides
          </Link>
        </div>
      ) : (
        <div className="rides-list">
          {reservations.map((reservation) => (
            <div key={reservation.id} className="ride-card">
              <div className="ride-details">
                <div className="ride-route">
                  {reservation.ride.origin.name}
                  <span className="arrow">&rarr;</span>
                  {reservation.ride.destination.name}
                </div>
                <div className="departure-time">
                  {formatTime(reservation.ride.departure_time)}
                </div>
                <div className="ride-info">
                  <span className={`status-badge status-${reservation.status}`}>
                    {reservation.status}
                  </span>
                  {reservation.ride.is_vip && <span className="vip-badge">VIP</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
