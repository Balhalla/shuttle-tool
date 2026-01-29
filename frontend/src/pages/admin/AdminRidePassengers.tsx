import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PhoneLink } from '../../components/PhoneInput';
import type { Ride, Passenger } from '../../types';

export function AdminRidePassengers() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    loadData();
  }, [rideId]);

  const loadData = async () => {
    if (!rideId) return;
    const id = parseInt(rideId);
    try {
      const [ridesData, passengersData] = await Promise.all([
        api.adminGetRides(),
        api.adminGetRidePassengers(id),
      ]);
      const foundRide = ridesData.find(r => r.id === id);
      setRide(foundRide || null);
      setPassengers(passengersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideId) return;
    setError('');

    try {
      await api.adminAddPassenger(parseInt(rideId), {
        name: form.name,
        email: form.email || undefined,
      });
      setForm({ name: '', email: '' });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add passenger');
    }
  };

  const handleRemovePassenger = async (reservationId: number) => {
    if (!rideId) return;
    if (!confirm('Are you sure you want to remove this passenger?')) return;

    try {
      await api.adminRemovePassenger(parseInt(rideId), reservationId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove passenger');
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
    return <div className="loading">Loading ride details...</div>;
  }

  if (!ride) {
    return <div className="error">Ride not found</div>;
  }

  const confirmedCount = passengers.filter(p => p.status === 'confirmed').length;

  return (
    <div className="admin-ride-passengers">
      <button onClick={() => navigate('/admin/rides')} className="btn btn-secondary back-btn">
        &larr; Back to Rides
      </button>

      <div className="ride-header">
        <h1>Manage Passengers</h1>
        <p className="ride-info-summary">
          {ride.origin.name} &rarr; {ride.destination.name}
          <br />
          <span className="departure-time">{formatTime(ride.departure_time)}</span>
          {ride.is_vip && <span className="vip-badge">VIP</span>}
        </p>
      </div>

      <div className="ride-stats">
        <div className="stat">
          <span className="stat-label">Total Seats</span>
          <span className="stat-value">{ride.available_seats}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Confirmed</span>
          <span className="stat-value">{confirmedCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Available</span>
          <span className="stat-value">{ride.available_seats - confirmedCount}</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="page-header">
        <h2>Passengers ({passengers.length})</h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          Add Passenger
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Passenger</h2>
            <form onSubmit={handleAddPassenger}>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Passenger name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email (optional)</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="passenger@email.com"
                />
              </div>
              <p className="form-note">
                Passengers added by admin are automatically confirmed and do not need to confirm via email.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm({ name: '', email: '' });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Passenger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passengers.length === 0 ? (
        <p>No passengers yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((passenger, index) => (
              <tr key={passenger.id}>
                <td>{index + 1}</td>
                <td>{passenger.name}</td>
                <td><PhoneLink phone={passenger.phone} className="phone-link" /></td>
                <td>{passenger.email || '-'}</td>
                <td>
                  <span className={`status-badge status-${passenger.status}`}>
                    {passenger.status}
                  </span>
                </td>
                <td>
                  {passenger.added_by_admin ? (
                    <span className="source-badge admin">Admin</span>
                  ) : (
                    <span className="source-badge self">Self-registered</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => handleRemovePassenger(passenger.id)}
                    className="btn btn-small btn-danger"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
