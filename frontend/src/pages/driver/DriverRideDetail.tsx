import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { PhoneLink } from '../../components/PhoneInput';
import type { Ride, DriverPassenger } from '../../types';

const POLL_INTERVAL = 5000; // 5 seconds

export function DriverRideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [passengers, setPassengers] = useState<DriverPassenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [departing, setDeparting] = useState(false);

  const loadData = useCallback(async (isPolling = false) => {
    if (!rideId) return;
    const id = parseInt(rideId);
    try {
      const [rideData, passengersData] = await Promise.all([
        api.getDriverRideDetail(id),
        api.getDriverRidePassengers(id),
      ]);
      setRide(rideData);
      setPassengers(passengersData);
      if (!isPolling) {
        setError('');
      }
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : 'Failed to load ride');
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  }, [rideId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleTogglePresent = async (passengerId: number, currentStatus: boolean) => {
    if (!rideId) return;
    setUpdating(passengerId);
    setError('');

    try {
      const updated = await api.markPassengerPresent(
        parseInt(rideId),
        passengerId,
        !currentStatus
      );
      setPassengers((prev) =>
        prev.map((p) => (p.id === passengerId ? updated : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update presence');
    } finally {
      setUpdating(null);
    }
  };

  const handleDepart = async () => {
    if (!rideId || !confirm('Are you sure you want to mark yourself as departed? This cannot be undone.')) return;

    setDeparting(true);
    setError('');

    try {
      await api.driverDepart(parseInt(rideId));
      loadData(); // Reload to get updated assignment status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record departure');
    } finally {
      setDeparting(false);
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

  const getPresenceStatus = (passenger: DriverPassenger): 'absent' | 'present-self' | 'present-other' => {
    if (!passenger.is_present) {
      return 'absent';
    }
    if (passenger.marked_present_by_id === user?.id) {
      return 'present-self';
    }
    return 'present-other';
  };

  const presentCount = passengers.filter((p) => p.is_present).length;

  // Find current driver's assignment
  const myAssignment = ride?.assignments?.find(a => a.driver.id === user?.id);
  const hasDeparted = myAssignment?.has_departed ?? false;

  // Find other drivers on this ride
  const otherDrivers = ride?.assignments?.filter(a => a.driver.id !== user?.id) || [];

  if (loading) {
    return <div className="loading">Loading ride details...</div>;
  }

  if (!ride) {
    return <div className="error">Ride not found</div>;
  }

  return (
    <div className="driver-ride-detail">
      <button onClick={() => navigate('/driver')} className="btn btn-secondary back-btn">
        &larr; Back to Dashboard
      </button>

      <div className="ride-header">
        <h1>
          {ride.origin.name} &rarr; {ride.destination.name}
        </h1>
        <p className="departure-time">{formatTime(ride.departure_time)}</p>
        {ride.is_vip && <span className="vip-badge">VIP Ride</span>}
        {hasDeparted && <span className="departed-badge">Departed</span>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="ride-stats">
        <div className="stat">
          <span className="stat-label">Total Seats</span>
          <span className="stat-value">{ride.available_seats}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Reserved</span>
          <span className="stat-value">{ride.reserved_seats}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Available</span>
          <span className="stat-value">{ride.seats_remaining}</span>
        </div>
      </div>

      {otherDrivers.length > 0 && (
        <div className="other-drivers-section">
          <h2>Other Drivers on this Ride</h2>
          <div className="other-drivers-list">
            {otherDrivers.map((assignment) => (
              <div key={assignment.id} className="other-driver-card">
                <div className="driver-info">
                  <span className="driver-name">{assignment.driver.name}</span>
                  <span className="driver-car">{assignment.car.name} ({assignment.car.capacity} seats)</span>
                </div>
                <div className="driver-contact">
                  <PhoneLink phone={assignment.driver.phone} className="phone-link" />
                </div>
                {assignment.has_departed && (
                  <span className="departed-badge">Departed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasDeparted && (
        <div className="depart-section">
          <button
            onClick={handleDepart}
            className="btn btn-primary btn-depart"
            disabled={departing}
          >
            {departing ? 'Recording...' : "I'm Leaving Now"}
          </button>
          <p className="depart-note">
            Click when you are about to depart. This will close registration if no other drivers remain.
          </p>
        </div>
      )}

      {hasDeparted && myAssignment?.departed_at && (
        <div className="departed-info">
          Departed at {formatTime(myAssignment.departed_at)}
        </div>
      )}

      <div className="passengers-section">
        <h2>
          Passenger List ({passengers.length})
          {passengers.length > 0 && (
            <span className="present-count"> - {presentCount} present</span>
          )}
        </h2>
        {passengers.length === 0 ? (
          <p>No confirmed passengers yet.</p>
        ) : (
          <table className="passengers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Present</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((passenger, index) => {
                const status = getPresenceStatus(passenger);
                return (
                  <tr key={passenger.id} className={passenger.is_present ? 'present' : ''}>
                    <td>{index + 1}</td>
                    <td>{passenger.name}</td>
                    <td><PhoneLink phone={passenger.phone} className="phone-link" /></td>
                    <td>
                      <button
                        className={`presence-btn ${status}`}
                        onClick={() => handleTogglePresent(passenger.id, passenger.is_present)}
                        disabled={updating === passenger.id || status === 'present-other'}
                        title={
                          status === 'present-other'
                            ? 'Marked present by another driver'
                            : passenger.is_present
                            ? 'Mark as absent'
                            : 'Mark as present'
                        }
                      >
                        {updating === passenger.id ? '...' : passenger.is_present ? '✓' : '✗'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
