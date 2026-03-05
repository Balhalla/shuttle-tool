import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { DriverTimeline } from '../../types';

export function AdminDriverTimeline() {
  const navigate = useNavigate();
  const [data, setData] = useState<DriverTimeline[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<{ id: number; start_time: string; end_time: string; reason: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Default to today ± 1 day
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 1);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 2);

  const [rangeStart, setRangeStart] = useState(defaultStart.toISOString().slice(0, 16));
  const [rangeEnd, setRangeEnd] = useState(defaultEnd.toISOString().slice(0, 16));

  useEffect(() => {
    loadData();
  }, [rangeStart, rangeEnd]);

  const loadData = async () => {
    try {
      const result = await api.adminGetDriverTimeline({
        start: rangeStart,
        end: rangeEnd,
      });
      setData(result.drivers);
      setBlockedPeriods(result.blocked_periods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const startMs = new Date(rangeStart).getTime();
  const endMs = new Date(rangeEnd).getTime();
  const totalMs = endMs - startMs;

  const toPercent = (dateStr: string) => {
    const ms = new Date(dateStr).getTime();
    return ((ms - startMs) / totalMs) * 100;
  };

  const formatHour = (date: Date) => {
    return date.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Generate time markers
  const markers: Date[] = [];
  const markerInterval = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 8))); // ~8 markers
  const markerStep = markerInterval * 60 * 60 * 1000;
  let markerTime = new Date(Math.ceil(startMs / markerStep) * markerStep);
  while (markerTime.getTime() < endMs) {
    markers.push(new Date(markerTime));
    markerTime = new Date(markerTime.getTime() + markerStep);
  }

  if (loading) {
    return <div className="loading">Loading timeline...</div>;
  }

  return (
    <div className="admin-driver-timeline">
      <div className="page-header">
        <h1>Driver Availability Timeline</h1>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="timeline-controls">
        <div className="form-group">
          <label htmlFor="range-start">From</label>
          <input
            id="range-start"
            type="datetime-local"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="range-end">To</label>
          <input
            id="range-end"
            type="datetime-local"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="timeline-container">
        {/* Time axis */}
        <div className="timeline-axis">
          <div className="timeline-label" />
          <div className="timeline-track">
            {markers.map((m, i) => (
              <div
                key={i}
                className="timeline-marker"
                style={{ left: `${((m.getTime() - startMs) / totalMs) * 100}%` }}
              >
                <span className="marker-label">{formatHour(m)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver rows */}
        {data.map((item) => (
          <div key={item.driver.id} className="timeline-row">
            <div className="timeline-label">{item.driver.name}</div>
            <div className="timeline-track">
              {/* Blocked period blocks (red shade) */}
              {blockedPeriods.map((bp) => {
                const left = Math.max(0, toPercent(bp.start_time));
                const right = Math.min(100, toPercent(bp.end_time));
                if (right <= 0 || left >= 100) return null;
                return (
                  <div
                    key={`blocked-${bp.id}`}
                    className="timeline-block blocked"
                    style={{
                      left: `${left}%`,
                      width: `${right - left}%`,
                      backgroundColor: 'rgba(220, 53, 69, 0.2)',
                      borderTop: '2px solid #dc3545',
                      borderBottom: '2px solid #dc3545',
                      zIndex: 0,
                    }}
                    title={`Blocked: ${bp.reason || 'No reason'} (${formatHour(new Date(bp.start_time))} – ${formatHour(new Date(bp.end_time))})`}
                  />
                );
              })}
              {/* Availability blocks (light shade) */}
              {item.availabilities.map((avail) => {
                const left = Math.max(0, toPercent(avail.start_time));
                const right = Math.min(100, toPercent(avail.end_time));
                if (right <= 0 || left >= 100) return null;
                return (
                  <div
                    key={`avail-${avail.id}`}
                    className="timeline-block availability"
                    style={{
                      left: `${left}%`,
                      width: `${right - left}%`,
                    }}
                    title={`Available: ${formatHour(new Date(avail.start_time))} – ${formatHour(new Date(avail.end_time))}`}
                  />
                );
              })}
              {/* Assignment blocks (darker shade, clickable) */}
              {item.assignments.map((assign) => {
                const left = toPercent(assign.departure_time);
                if (left < 0 || left > 100) return null;
                return (
                  <div
                    key={`assign-${assign.id}`}
                    className={`timeline-block assignment${assign.is_vip ? ' vip' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: '2%',
                      minWidth: '8px',
                    }}
                    title={`${assign.origin} → ${assign.destination} (${assign.car_name})${assign.is_vip ? ' 👑 VIP' : ''}`}
                    onClick={() => navigate(`/admin/rides/${assign.ride_id}/passengers`)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <p style={{ padding: '1rem' }}>No drivers found.</p>
        )}
      </div>

      <div className="timeline-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: '#b8d4f0' }} /> Available
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: '#2b6cb0' }} /> Ride assigned
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: '#d4a017', border: '2px solid #b8860b' }} /> VIP ride
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: 'rgba(220, 53, 69, 0.2)', border: '2px solid #dc3545' }} /> Blocked period
        </span>
      </div>
    </div>
  );
}
