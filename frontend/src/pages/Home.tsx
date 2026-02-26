import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Ride, Location } from '../types';

export function Home() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    api.getLocations().then(setLocations).catch(() => {});
    loadRides();
  }, []);

  useEffect(() => {
    loadRides();
  }, [originFilter, destinationFilter, dateFilter]);

  const loadRides = async () => {
    try {
      const params: { origin?: number; destination?: number; date?: string } = {};
      if (originFilter) params.origin = parseInt(originFilter);
      if (destinationFilter) params.destination = parseInt(destinationFilter);
      if (dateFilter) params.date = dateFilter;
      const ridesData = await api.getPublicRides(params);
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

      <div className="ride-filters">
        <div className="filter-group">
          <label htmlFor="origin-filter">From</label>
          <select
            id="origin-filter"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
          >
            <option value="">All origins</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="destination-filter">To</label>
          <select
            id="destination-filter"
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
          >
            <option value="">All destinations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="date-filter">Date</label>
          <input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        {(originFilter || destinationFilter || dateFilter) && (
          <button
            className="btn btn-secondary btn-small"
            onClick={() => { setOriginFilter(''); setDestinationFilter(''); setDateFilter(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

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
