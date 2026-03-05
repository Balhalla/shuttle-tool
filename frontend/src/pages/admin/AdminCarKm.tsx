import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Location, CarKmResponse } from '../../types';

export function AdminCarKm() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [baseLocationId, setBaseLocationId] = useState<number | ''>('');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [result, setResult] = useState<CarKmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.adminGetSiteSettings(), api.adminGetLocations()])
      .then(([settings, locs]) => {
        setLocations(locs);
        if (settings.base_location_id) {
          setBaseLocationId(settings.base_location_id);
        }
        setHasApiKey(!!settings.google_routes_api_key);
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setInitLoading(false));
  }, []);

  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.adminGetCarKm(baseLocationId ? baseLocationId : undefined);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to calculate km.');
    } finally {
      setLoading(false);
    }
  };

  const locationsWithoutCoords = locations.filter(
    (loc) => loc.latitude == null || loc.longitude == null
  );

  if (initLoading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-car-km">
      <div className="page-header">
        <h1>Car KM Overview</h1>
      </div>

      {!hasApiKey && (
        <div className="info-banner" style={{ background: '#fff3cd', border: '1px solid #ffc107', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          No Google Routes API key configured. Distances will only be fetched from saved Travel Time records.{' '}
          <Link to="/admin/settings">Configure in Site Settings</Link>.
        </div>
      )}

      {locationsWithoutCoords.length > 0 && (
        <div className="info-banner" style={{ background: '#e8f4fd', border: '1px solid #90caf9', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          The following locations have no coordinates (Google API cannot fetch distances for them):{' '}
          {locationsWithoutCoords.map((l) => l.name).join(', ')}.{' '}
          <Link to="/admin/locations">Edit Locations</Link>.
        </div>
      )}

      <div style={{ maxWidth: '600px', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label htmlFor="base-location">Base location</label>
          <select
            id="base-location"
            value={baseLocationId}
            onChange={(e) => setBaseLocationId(e.target.value ? parseInt(e.target.value) : '')}
            style={{ width: '100%' }}
          >
            <option value="">Select base location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCalculate}
          disabled={loading || !baseLocationId}
          className="btn btn-primary"
        >
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {result && (
        <div>
          <p style={{ color: '#666', marginBottom: '0.75rem' }}>
            Base location: <strong>{result.base_location.name}</strong>
          </p>
          {result.cars.length === 0 ? (
            <p>No cars with non-empty rides found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Car</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>License Plate</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Rides</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total KM</th>
                </tr>
              </thead>
              <tbody>
                {result.cars.map((car) => (
                  <tr key={car.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>
                      {car.name}
                      {car.missing_distances && (
                        <span
                          title="Some distances could not be determined; total may be incomplete."
                          style={{ marginLeft: '0.4rem', color: '#f0a500', cursor: 'help' }}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{car.license_plate || '—'}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{car.rides}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{car.total_km} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.cars.some((c) => c.missing_distances) && (
            <p style={{ marginTop: '0.75rem', color: '#888', fontSize: '0.9em' }}>
              ⚠ One or more cars have missing distances. Add travel times or coordinates to locations to improve accuracy.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
