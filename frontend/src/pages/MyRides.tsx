import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Reservation } from '../types';

export function MyRides() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showMissed, setShowMissed] = useState(false);
  const [showPast, setShowPast] = useState(false);

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

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    setCancellingId(id);
    try {
      await api.cancelMyReservation(id);
      setReservations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reservation');
    } finally {
      setCancellingId(null);
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

  // Split reservations into categories
  const upcoming: Reservation[] = [];
  const pastRides: Reservation[] = [];
  const missedRides: Reservation[] = [];

  for (const r of reservations) {
    if (r.ride.all_departed) {
      if (r.is_present) {
        pastRides.push(r);
      } else {
        missedRides.push(r);
      }
    } else {
      upcoming.push(r);
    }
  }

  if (loading) {
    return <div className="loading">Loading your rides...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const renderRideCard = (reservation: Reservation, showCancel: boolean) => (
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
      {showCancel && (
        <button
          onClick={() => handleCancel(reservation.id)}
          disabled={cancellingId === reservation.id}
          className="btn btn-danger btn-small"
        >
          {cancellingId === reservation.id ? 'Cancelling...' : 'Cancel'}
        </button>
      )}
    </div>
  );

  const hasAny = reservations.length > 0;

  return (
    <div className="my-rides">
      <h1>My Rides</h1>

      {!hasAny && (
        <div className="no-rides">
          <p>You don't have any rides.</p>
          <Link to="/" className="btn btn-primary">
            Browse Available Rides
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <h2>Upcoming ({upcoming.length})</h2>
          <div className="rides-list">
            {upcoming.map((r) => renderRideCard(r, true))}
          </div>
        </>
      )}

      {missedRides.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowMissed(!showMissed)}
          >
            <span style={{ color: '#856404' }}>Missed Rides ({missedRides.length})</span>
            <span className="collapse-icon">{showMissed ? '\u25BC' : '\u25B6'}</span>
          </button>
          {showMissed && (
            <div className="rides-list" style={{ opacity: 0.6 }}>
              {missedRides.map((r) => renderRideCard(r, false))}
            </div>
          )}
        </div>
      )}

      {pastRides.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowPast(!showPast)}
          >
            <span>Past Rides ({pastRides.length})</span>
            <span className="collapse-icon">{showPast ? '\u25BC' : '\u25B6'}</span>
          </button>
          {showPast && (
            <div className="rides-list">
              {pastRides.map((r) => renderRideCard(r, false))}
            </div>
          )}
        </div>
      )}

      {hasAny && upcoming.length === 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/" className="btn btn-primary">
            Browse Available Rides
          </Link>
        </div>
      )}
    </div>
  );
}
