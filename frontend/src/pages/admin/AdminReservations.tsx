import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Reservation } from '../../types';

export function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPastReservations, setShowPastReservations] = useState(false);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      const data = await api.adminGetReservations();
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: number) => {
    try {
      await api.adminConfirmReservation(id);
      loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm reservation');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;

    try {
      await api.adminCancelReservation(id);
      loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel reservation');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (loading) {
    return <div className="loading">Loading reservations...</div>;
  }

  // Separate upcoming and past reservations based on ride departure time
  const now = new Date();
  const upcomingReservations = reservations.filter(
    (res) => new Date(res.ride.departure_time) >= now
  );
  const pastReservations = reservations.filter(
    (res) => new Date(res.ride.departure_time) < now
  );

  // Sort upcoming by departure time ascending, past by departure time descending
  upcomingReservations.sort(
    (a, b) => new Date(a.ride.departure_time).getTime() - new Date(b.ride.departure_time).getTime()
  );
  pastReservations.sort(
    (a, b) => new Date(b.ride.departure_time).getTime() - new Date(a.ride.departure_time).getTime()
  );

  const renderReservationRow = (res: Reservation) => (
    <tr key={res.id}>
      <td>
        <div>{res.user?.name || res.guest_name}</div>
        <small>{res.user?.email || res.guest_email}</small>
      </td>
      <td>
        <Link to={`/admin/rides/${res.ride.id}/passengers`} className="ride-link">
          <div>
            {res.ride.origin.name} &rarr; {res.ride.destination.name}
          </div>
          <small>{formatTime(res.ride.departure_time)}</small>
        </Link>
      </td>
      <td>
        <span className={`status-badge status-${res.status}`}>
          {res.status}
        </span>
      </td>
      <td>{formatTime(res.created_at)}</td>
      <td>
        {res.status === 'pending' && (
          <>
            <button onClick={() => handleConfirm(res.id)} className="btn btn-small btn-success">
              Confirm
            </button>
            <button onClick={() => handleCancel(res.id)} className="btn btn-small btn-danger">
              Cancel
            </button>
          </>
        )}
        {res.status === 'confirmed' && (
          <button onClick={() => handleCancel(res.id)} className="btn btn-small btn-danger">
            Cancel
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="admin-reservations">
      <div className="page-header">
        <h1>Reservations</h1>
      </div>

      {error && <div className="error">{error}</div>}

      <h2>Upcoming Reservations ({upcomingReservations.length})</h2>
      {upcomingReservations.length === 0 ? (
        <p>No upcoming reservations.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Ride</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>{upcomingReservations.map(renderReservationRow)}</tbody>
        </table>
      )}

      {pastReservations.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowPastReservations(!showPastReservations)}
          >
            <span>Past Reservations ({pastReservations.length})</span>
            <span className="collapse-icon">{showPastReservations ? '▼' : '▶'}</span>
          </button>
          {showPastReservations && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Ride</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{pastReservations.map(renderReservationRow)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
