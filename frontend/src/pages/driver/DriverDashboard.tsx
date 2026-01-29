import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Ride } from '../../types';

export function DriverDashboard() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPastRides, setShowPastRides] = useState(false);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      const data = await api.getDriverRides();
      setRides(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rides');
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

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  const upcomingRides = rides.filter((ride) => new Date(ride.departure_time) >= cutoffTime);
  const pastRides = rides.filter((ride) => new Date(ride.departure_time) < cutoffTime);

  // Sort upcoming rides by departure time (ascending)
  upcomingRides.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
  // Sort past rides by departure time (descending - most recent first)
  pastRides.sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());

  const renderRideCard = (ride: Ride) => (
    <div key={ride.id} className="ride-card">
      <div className="ride-route">
        <span className="origin">{ride.origin.name}</span>
        <span className="arrow">&rarr;</span>
        <span className="destination">{ride.destination.name}</span>
      </div>
      <div className="ride-info">
        <span className="time">{formatTime(ride.departure_time)}</span>
        <span className="seats">
          {ride.reserved_seats}/{ride.available_seats} passengers
        </span>
        {ride.is_vip && <span className="vip-badge">VIP</span>}
      </div>
      <Link to={`/driver/ride/${ride.id}`} className="btn btn-primary">
        View Details
      </Link>
    </div>
  );

  if (loading) {
    return <div className="loading">Loading your rides...</div>;
  }

  return (
    <div className="driver-dashboard">
      <h1>My Assigned Rides</h1>

      {error && <div className="error">{error}</div>}

      <h2>Upcoming Rides ({upcomingRides.length})</h2>
      <div className="ride-list">
        {upcomingRides.length === 0 ? (
          <p>You have no upcoming rides assigned.</p>
        ) : (
          upcomingRides.map(renderRideCard)
        )}
      </div>

      {pastRides.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowPastRides(!showPastRides)}
          >
            <span>Past Rides ({pastRides.length})</span>
            <span className="collapse-icon">{showPastRides ? '▼' : '▶'}</span>
          </button>
          {showPastRides && (
            <div className="ride-list">
              {pastRides.map(renderRideCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
