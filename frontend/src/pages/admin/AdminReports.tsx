import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { ReportSummary } from '../../types';

export function AdminReports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await api.adminGetReportSummary();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
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

      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Summary based on departed rides only. Travel times come from configured travel time data; distances from stored distance data.
      </p>

      <h2>Driver Hours</h2>
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
      {report.cars.length === 0 ? (
        <p>No car data available.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Car</th>
              <th>License Plate</th>
              <th>Rides</th>
              <th>Total KM</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {report.cars.map((c) => (
              <tr key={c.car_id}>
                <td>{c.name}</td>
                <td>{c.license_plate || '—'}</td>
                <td>{c.rides}</td>
                <td>{c.total_km}</td>
                <td>{c.missing_distances ? '⚠️ Missing distance data' : ''}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
              <td>Total</td>
              <td></td>
              <td>{report.cars.reduce((sum, c) => sum + c.rides, 0)}</td>
              <td>{report.cars.reduce((sum, c) => sum + c.total_km, 0).toFixed(1)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
