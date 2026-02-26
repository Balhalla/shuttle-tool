import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PhoneLink } from '../../components/PhoneInput';
import type { PassengerOverview } from '../../types';

export function AdminPassengers() {
  const [passengers, setPassengers] = useState<PassengerOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.adminGetPassengers();
      setPassengers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passengers');
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

  const filtered = passengers.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  });

  if (loading) {
    return <div className="loading">Loading passengers...</div>;
  }

  return (
    <div className="admin-passengers">
      <div className="page-header">
        <h1>Passengers ({passengers.length})</h1>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '400px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
        />
      </div>

      {filtered.length === 0 ? (
        <p>No passengers found.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Rides</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((passenger) => (
              <>
                <tr
                  key={passenger.key}
                  onClick={() => setExpandedKey(expandedKey === passenger.key ? null : passenger.key)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{passenger.name}</td>
                  <td>{passenger.email || '-'}</td>
                  <td><PhoneLink phone={passenger.phone} className="phone-link" /></td>
                  <td>{passenger.rides.length}</td>
                  <td>{expandedKey === passenger.key ? '▼' : '▶'}</td>
                </tr>
                {expandedKey === passenger.key && (
                  <tr key={`${passenger.key}-detail`}>
                    <td colSpan={5} style={{ padding: '0.5rem 1rem', backgroundColor: '#f8f9fa' }}>
                      <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                          <tr>
                            <th>Route</th>
                            <th>Departure</th>
                            <th>Status</th>
                            <th>VIP</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {passenger.rides.map((ride) => (
                            <tr key={ride.reservation_id}>
                              <td>{ride.origin} → {ride.destination}</td>
                              <td>{formatTime(ride.departure_time)}</td>
                              <td>
                                <span className={`status-badge status-${ride.status}`}>
                                  {ride.status}
                                </span>
                              </td>
                              <td>{ride.is_vip ? '👑' : ''}</td>
                              <td>
                                <Link to={`/admin/rides/${ride.ride_id}/passengers`} className="btn btn-small">
                                  View Ride
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
