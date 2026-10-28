import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Ride, Location } from '../types';

export function Home() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [availableOrigins, setAvailableOrigins] = useState<Location[]>([]);
  const [availableDestinations, setAvailableDestinations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickupFilter, setPickupFilter] = useState('');
  const [dropoffFilter, setDropoffFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    // Load unfiltered rides once to derive available filter options
    api.getPublicRides().then((allRides) => {
      const stopsMap = new Map<number, Location>();
      allRides.forEach((r) => {
        r.stops.forEach((s) => stopsMap.set(s.location.id, s.location));
      });
      setAvailableOrigins([...stopsMap.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableDestinations([...stopsMap.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => {});
    loadRides();
  }, []);

  useEffect(() => {
    loadRides();
  }, [pickupFilter, dropoffFilter, dateFilter]);

  const loadRides = async () => {
    try {
      const params: { pickup?: number; dropoff?: number; date?: string } = {};
      if (pickupFilter) params.pickup = parseInt(pickupFilter);
      if (dropoffFilter) params.dropoff = parseInt(dropoffFilter);
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
            <label htmlFor="origin-filter">Pickup</label>
          <select
            id="origin-filter"
            value={pickupFilter}
            onChange={(e) => setPickupFilter(e.target.value)}
          >
            <option value="">Choose pickup</option>
            {availableOrigins.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
            <label htmlFor="destination-filter">Drop-off</label>
          <select
            id="destination-filter"
            value={dropoffFilter}
            onChange={(e) => setDropoffFilter(e.target.value)}
          >
            <option value="">Choose drop-off</option>
            {availableDestinations.map((loc) => (
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
        {(pickupFilter || dropoffFilter || dateFilter) && (
          <button
            className="btn btn-secondary btn-small"
            onClick={() => { setPickupFilter(''); setDropoffFilter(''); setDateFilter(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="ride-list">
        {!pickupFilter || !dropoffFilter ? (
          <p>Choose your pickup and drop-off stops to find rides.</p>
        ) : rides.length === 0 ? (
          <p>No rides available at the moment.</p>
        ) : (
          rides.map((ride) => (
            <div key={ride.id} className={`ride-card ${ride.seats_remaining <= 0 ? 'full' : ''}`}>
              <div className="ride-route">
                {ride.stops.map((stop, index) => <span key={stop.position}>
                  {index > 0 && <span className="arrow"> &rarr; </span>}
                  <span className={index === 0 ? 'origin' : 'destination'}>{stop.location.name}</span>
                </span>)}
              </div>
              <div className="ride-info">
                <span className="time">{formatTime(ride.departure_time)}</span>
                <span className="seats">
                  {!ride.registration_open
                    ? 'Bookings closed'
                    : ride.seats_remaining <= 0
                    ? 'Full'
                    : `${ride.seats_remaining} seat${ride.seats_remaining !== 1 ? 's' : ''} left`}
                </span>
              </div>
              <Link
                to={`/ride/${ride.id}?pickup=${pickupFilter}&dropoff=${dropoffFilter}`}
                className={`btn ${!ride.registration_open || ride.seats_remaining <= 0 ? 'btn-secondary' : 'btn-primary'}`}
              >
                {!ride.registration_open || ride.seats_remaining <= 0 ? 'View' : 'Reserve'}
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
