import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PhoneInput, PhoneLink } from '../../components/PhoneInput';
import type { Ride, Passenger } from '../../types';

export function AdminRidePassengers() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
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
      if (editingPassenger) {
        await api.adminEditPassenger(parseInt(rideId), editingPassenger.id, {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
      } else {
        await api.adminAddPassenger(parseInt(rideId), {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
        });
      }
      setForm({ name: '', email: '', phone: '' });
      setShowForm(false);
      setEditingPassenger(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save passenger');
    }
  };

  const handleEditPassenger = (passenger: Passenger) => {
    setForm({
      name: passenger.name,
      email: passenger.email || '',
      phone: passenger.phone || '',
    });
    setEditingPassenger(passenger);
    setShowForm(true);
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

      {ride.assignments && ride.assignments.length > 0 && (
        <div className="driver-details-section">
          <h2>Drivers</h2>
          <div className="driver-cards">
            {ride.assignments.map((assignment) => (
              <div key={assignment.id} className="driver-card">
                <div className="driver-card-name">{assignment.driver.name}</div>
                <div className="driver-card-info">
                  <span>{assignment.car.name} ({assignment.car.capacity} seats)</span>
                  {assignment.driver.phone && (
                    <span><PhoneLink phone={assignment.driver.phone} className="phone-link" /></span>
                  )}
                </div>
                {assignment.has_departed && (
                  <span className="departed-badge">Departed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <h2>{editingPassenger ? 'Edit Passenger' : 'Add Passenger'}</h2>
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
              <div className="form-group">
                <label htmlFor="phone">Phone (optional)</label>
                <PhoneInput
                  id="phone"
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: value })}
                />
              </div>
              {!editingPassenger && (
                <p className="form-note">
                  Passengers added by admin are automatically confirmed and do not need to confirm via email.
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPassenger(null);
                    setForm({ name: '', email: '', phone: '' });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPassenger ? 'Save' : 'Add Passenger'}
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
                    onClick={() => handleEditPassenger(passenger)}
                    className="btn btn-small"
                  >
                    Edit
                  </button>
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
