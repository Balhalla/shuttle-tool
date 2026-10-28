import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PhoneInput, PhoneLink } from '../components/PhoneInput';
import type { Ride } from '../types';

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reserving, setReserving] = useState(false);
  const [success, setSuccess] = useState('');
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [seatsForRoute, setSeatsForRoute] = useState(0);
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    seats: 1,
    pickup_position: 0,
    dropoff_position: 1,
  });

  useEffect(() => {
    // Pre-fill form with user info if logged in
    if (user) {
      setForm((current) => ({
        ...current,
        email: user.email,
        name: user.name || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    loadRide();
  }, [rideId]);

  const loadRide = async () => {
    if (!rideId) return;
    try {
      let data = await api.getRideDetail(parseInt(rideId));
      const pickupId = Number(searchParams.get('pickup'));
      const dropoffId = Number(searchParams.get('dropoff'));
      const pickup = data.stops.find((s) => s.location.id === pickupId)?.position ?? 0;
      const dropoff = data.stops.find((s) => s.location.id === dropoffId && s.position > pickup)?.position
        ?? data.stops.find((s) => s.position > pickup)?.position ?? 1;
      data = await api.getRideDetail(parseInt(rideId), pickup, dropoff);
      setRide(data);
      setSeatsForRoute(data.selected_seats_remaining ?? 0);
      setForm((current) => ({ ...current, pickup_position: pickup, dropoff_position: dropoff }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  const updateJourney = async (pickup_position: number, dropoff_position: number) => {
    if (!rideId) return;
    try {
      const data = await api.getRideDetail(parseInt(rideId), pickup_position, dropoff_position);
      setRide(data);
      setSeatsForRoute(data.selected_seats_remaining ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check seats');
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideId) return;

    setReserving(true);
    setError('');
    const requestedSeats = form.seats;

    try {
      const result = await api.reserveRide(parseInt(rideId), form);
      loadRide(); // Refresh ride to update seat count
      if (result.auto_confirmed) {
        setSuccess(
          `Your reservation for ${requestedSeats} ${requestedSeats === 1 ? 'seat has' : 'seats have'} been confirmed!`,
        );
        setAutoConfirmed(true);
        refreshUser(); // Refresh user to update saved phone/name
      } else {
        setSuccess(
          `Reservation for ${requestedSeats} ${requestedSeats === 1 ? 'seat' : 'seats'} created! Please check your email to confirm. Can't find it? Check your spam or junk folder.`,
        );
      }
      if (!user) {
        setForm((current) => ({ ...current, email: '', name: '', phone: '', seats: 1 }));
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
          {ride.stops.map((stop, index) => <span key={stop.position}>{index > 0 && ' → '}{stop.location.name}{stop.estimated_time ? ` (${new Date(stop.estimated_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})` : ''}</span>)}
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
          <span className="stat-value">{seatsForRoute}</span>
        </div>
        <div className="stat">
          <span className={`stat-value ${ride.is_full ? 'full' : 'available'}`}>
            {ride.is_full ? 'Full' : 'Available'}
          </span>
        </div>
      </div>

      {ride.driver_phones && ride.driver_phones.length > 0 && (
        <div className="driver-phones" style={{ margin: '1rem 0', padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>🚗 Your Driver{ride.driver_phones.length > 1 ? 's' : ''}</h3>
          {ride.driver_phones.map((dp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <strong>{dp.name}</strong>
              {dp.phone && <PhoneLink phone={dp.phone} />}
            </div>
          ))}
        </div>
      )}

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

      {ride.registration_open && seatsForRoute <= 0 && (
        <div className="error">No seats are available between these stops.</div>
      )}

      {ride.registration_open && !success && (
        <form className="reserve-form" onSubmit={handleReserve}>
          <h2>Reserve Seats</h2>
          <div className="form-group">
            <label htmlFor="pickup-stop">Pickup stop</label>
            <select id="pickup-stop" value={form.pickup_position} onChange={(e) => {
              const pickup_position = Number(e.target.value);
              const later = ride.stops.find((stop) => stop.position > pickup_position);
              const dropoff_position = later?.position ?? pickup_position + 1;
              setForm({ ...form, pickup_position, dropoff_position });
              updateJourney(pickup_position, dropoff_position);
            }}>
              {ride.stops.slice(0, -1).map((stop) => <option key={stop.position} value={stop.position}>{stop.position + 1}. {stop.location.name}{stop.estimated_time ? ` · ${new Date(stop.estimated_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dropoff-stop">Drop-off stop</label>
            <select id="dropoff-stop" value={form.dropoff_position} onChange={(e) => {
              const dropoff_position = Number(e.target.value);
              setForm({ ...form, dropoff_position });
              updateJourney(form.pickup_position, dropoff_position);
            }}>
              {ride.stops.filter((stop) => stop.position > form.pickup_position).map((stop) => <option key={stop.position} value={stop.position}>{stop.position + 1}. {stop.location.name}{stop.estimated_time ? ` · ${new Date(stop.estimated_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</option>)}
            </select>
          </div>
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
          <div className="form-group">
            <label htmlFor="seats">Number of seats</label>
            <input
              id="seats"
              type="number"
              min={1}
              max={ride.seats_remaining}
              value={form.seats}
              onChange={(e) => setForm({
                ...form,
                seats: Math.max(1, Math.min(ride.seats_remaining, Number(e.target.value))),
              })}
              required
            />
            <small style={{ color: '#666' }}>
              {ride.seats_remaining} seat{ride.seats_remaining === 1 ? '' : 's'} remaining.
            </small>
          </div>
          <p className="form-note">
            {user
              ? 'Your reservation will be confirmed immediately.'
              : 'You will receive an email with a confirmation link. Your reservation will be held for 15 minutes. Your phone number is used for a driver to contact you in case of problems. All data will be removed 2 weeks after the festival.'}
          </p>
          <button type="submit" className="btn btn-primary" disabled={reserving || seatsForRoute <= 0}>
            {reserving ? 'Reserving...' : `Reserve ${form.seats} ${form.seats === 1 ? 'Seat' : 'Seats'}`}
          </button>
        </form>
      )}
    </div>
  );
}
