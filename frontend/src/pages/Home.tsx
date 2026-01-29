import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Ride } from '../types';

export function Home() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      const ridesData = await api.getPublicRides();
      setRides(ridesData);
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

  if (loading) {
    return <div className="loading">Loading rides...</div>;
  }

  return (
    <div className="home">
      <h1>Available Shuttle Rides</h1>

      {error && <div className="error">{error}</div>}

      <div className="ride-list">
        {rides.length === 0 ? (
          <p>No rides available at the moment.</p>
        ) : (
          rides.map((ride) => (
            <div key={ride.id} className={`ride-card ${ride.is_full ? 'full' : ''}`}>
              <div className="ride-route">
                <span className="origin">{ride.origin.name}</span>
                <span className="arrow">&rarr;</span>
                <span className="destination">{ride.destination.name}</span>
              </div>
              <div className="ride-info">
                <span className="time">{formatTime(ride.departure_time)}</span>
                <span className="seats">
                  {ride.is_full
                    ? 'Full'
                    : `${ride.seats_remaining} seat${ride.seats_remaining !== 1 ? 's' : ''} left`}
                </span>
              </div>
              <Link
                to={`/ride/${ride.id}`}
                className={`btn ${ride.is_full ? 'btn-secondary' : 'btn-primary'}`}
              >
                {ride.is_full ? 'View' : 'Reserve'}
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
