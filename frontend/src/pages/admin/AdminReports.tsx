import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { ReportSummary, Location, CarKmResponse } from '../../types';

export function AdminReports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [baseLocationId, setBaseLocationId] = useState<number | ''>('');
  const [carKm, setCarKm] = useState<CarKmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [carKmLoading, setCarKmLoading] = useState(false);
  const [error, setError] = useState('');
  const [carKmError, setCarKmError] = useState('');

  useEffect(() => {
    Promise.all([api.adminGetReportSummary(), api.adminGetLocations(), api.adminGetSiteSettings()])
      .then(([data, locs, settings]) => {
        setReport(data);
        setLocations(locs);
        if (settings.base_location_id) {
          setBaseLocationId(settings.base_location_id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const handleCalculateCarKm = async () => {
    if (!baseLocationId) return;
    setCarKmLoading(true);
    setCarKmError('');
    try {
      const data = await api.adminGetCarKm(baseLocationId);
      setCarKm(data);
    } catch (err) {
      setCarKmError(err instanceof Error ? err.message : 'Failed to calculate car km');
    } finally {
      setCarKmLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading report...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!report) return null;

  return (
    <div className="admin-reports">
      <div className="page-header">
        <h1>Time &amp; KM Report</h1>
      </div>

      <h2>Driver Hours</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Based on departed rides. Travel times come from configured travel time data.
      </p>
      {report.drivers.length === 0 ? (
        <p>No departed rides found.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Email</th>
              <th>Rides</th>
              <th>Total Minutes</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {report.drivers.map((d) => (
              <tr key={d.driver_id}>
                <td>{d.name}</td>
                <td>{d.email}</td>
                <td>{d.rides}</td>
                <td>{d.total_minutes}</td>
                <td>{d.total_hours}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td>Total</td>
              <td></td>
              <td>{report.drivers.reduce((sum, d) => sum + d.rides, 0)}</td>
              <td>{report.drivers.reduce((sum, d) => sum + d.total_minutes, 0)}</td>
              <td>{(report.drivers.reduce((sum, d) => sum + d.total_minutes, 0) / 60).toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: '2rem' }}>Car Kilometers</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Select a base location to calculate distances via Google Routes API.
        Make sure a <Link to="/admin/settings">Google Routes API key</Link> is configured.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem', maxWidth: '500px' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
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
          onClick={handleCalculateCarKm}
          disabled={carKmLoading || !baseLocationId}
          className="btn btn-primary"
        >
          {carKmLoading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      {carKmError && <div className="error" style={{ marginBottom: '1rem' }}>{carKmError}</div>}

      {carKm && (
        <>
          <p style={{ color: '#666', marginBottom: '0.75rem' }}>
            Base location: <strong>{carKm.base_location.name}</strong>
          </p>
          {carKm.cars.length === 0 ? (
            <p>No car data available.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Car</th>
                  <th>License Plate</th>
                  <th>Rides</th>
                  <th>Total KM</th>
                </tr>
              </thead>
              <tbody>
                {carKm.cars.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.name}
                      {c.missing_distances && (
                        <span
                          title="Some distances could not be determined; total may be incomplete."
                          style={{ marginLeft: '0.4rem', color: '#f0a500', cursor: 'help' }}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td>{c.license_plate || '—'}</td>
                    <td>{c.rides}</td>
                    <td>{c.total_km} km</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                  <td>Total</td>
                  <td></td>
                  <td>{carKm.cars.reduce((sum, c) => sum + c.rides, 0)}</td>
                  <td>{carKm.cars.reduce((sum, c) => sum + c.total_km, 0).toFixed(1)} km</td>
                </tr>
              </tbody>
            </table>
          )}
          {carKm.cars.some((c) => c.missing_distances) && (
            <p style={{ marginTop: '0.75rem', color: '#888', fontSize: '0.9em' }}>
              ⚠ Some distances could not be determined. Add coordinates to <Link to="/admin/locations">locations</Link> to improve accuracy.
            </p>
          )}
        </>
      )}
    </div>
  );
}
