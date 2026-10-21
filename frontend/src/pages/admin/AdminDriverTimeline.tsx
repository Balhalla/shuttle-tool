import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { DriverTimeline } from '../../types';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateAtDayChange(value: string, dayChangeTime: string) {
  const date = parseDateInput(value);
  const [hours, minutes] = dayChangeTime.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function AdminDriverTimeline() {
  const navigate = useNavigate();
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DriverTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dayChangeTime, setDayChangeTime] = useState('06:00');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Default to today ± 1 day
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 1);
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + 2);

  const [rangeStart, setRangeStart] = useState(formatDateInput(defaultStart));
  const [rangeEnd, setRangeEnd] = useState(formatDateInput(defaultEnd));

  useEffect(() => {
    api.adminGetSiteSettings()
      .then((settings) => setDayChangeTime(settings.day_change_time || '06:00'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (settingsLoaded) loadData();
  }, [rangeStart, rangeEnd, dayChangeTime, settingsLoaded]);

  const loadData = async () => {
    try {
      setError('');
      if (!rangeStart || !rangeEnd) return;

      const selectedStart = dateAtDayChange(rangeStart, dayChangeTime);
      const selectedEnd = dateAtDayChange(rangeEnd, dayChangeTime);
      const dayAfterEnd = new Date(selectedEnd);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);

      if (dayAfterEnd <= selectedStart) {
        setData([]);
        setError('End date must be on or after the start date.');
        return;
      }

      const result = await api.adminGetDriverTimeline({
        start: selectedStart.toISOString(),
        end: dayAfterEnd.toISOString(),
      });
      setData(result.drivers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const startMs = dateAtDayChange(rangeStart, dayChangeTime).getTime();
  const endDate = dateAtDayChange(rangeEnd, dayChangeTime);
  endDate.setDate(endDate.getDate() + 1);
  const endMs = endDate.getTime();
  const totalMs = endMs - startMs;
  const selectedDayCount = Number.isFinite(totalMs)
    ? Math.max(1, Math.ceil(totalMs / (24 * 60 * 60 * 1000)))
    : 1;
  const timelineHeight = Math.max(1440, Math.min(10080, selectedDayCount * 1440));
  const timelineMinWidth = `${140 + data.length * 240}px`;

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

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-GB', {
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

  // Add 30-minute guidelines across the complete selected date range.
  const guidelines: Date[] = [];
  const halfHourMs = 30 * 60 * 1000;
  let guidelineTime = new Date(Math.ceil(startMs / halfHourMs) * halfHourMs);
  while (guidelineTime.getTime() < endMs) {
    guidelines.push(new Date(guidelineTime));
    guidelineTime = new Date(guidelineTime.getTime() + halfHourMs);
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
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="range-end">To</label>
          <input
            id="range-end"
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
          />
        </div>
        <small className="timeline-day-boundary">
          Each selected day runs from {dayChangeTime} until {dayChangeTime} the following day.
        </small>
      </div>

      <div className="timeline-container">
        <div className="timeline-header-scroll" ref={headerScrollRef}>
          <div className="timeline-header" style={{ minWidth: timelineMinWidth }}>
            <div className="timeline-corner">Time</div>
            {data.map((item) => (
              <div key={`header-${item.driver.id}`} className="timeline-driver-header">
                {item.driver.name}
              </div>
            ))}
          </div>
        </div>

        <div
          className="timeline-body-scroll"
          onScroll={(event) => {
            if (headerScrollRef.current) {
              headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
        >
          <div
            className="timeline-body"
            style={{ minWidth: timelineMinWidth, height: `${timelineHeight}px` }}
          >
            {/* Vertical time axis */}
            <div className="timeline-axis">
              {guidelines.map((time, i) => (
                <div
                  key={`axis-guideline-${i}`}
                  className={`timeline-gridline${time.getMinutes() === 0 ? ' hour' : ''}`}
                  style={{ top: `${((time.getTime() - startMs) / totalMs) * 100}%` }}
                />
              ))}
              {markers.map((m, i) => (
                <div
                  key={i}
                  className="timeline-marker"
                  style={{ top: `${((m.getTime() - startMs) / totalMs) * 100}%` }}
                >
                  <span className="marker-label">{formatHour(m)}</span>
                </div>
              ))}
            </div>

            {/* Driver columns */}
            {data.map((item) => (
              <div key={item.driver.id} className="timeline-track">
                {guidelines.map((time, i) => (
                  <div
                    key={`grid-${i}`}
                    className={`timeline-gridline${time.getMinutes() === 0 ? ' hour' : ''}`}
                    style={{ top: `${((time.getTime() - startMs) / totalMs) * 100}%` }}
                  />
                ))}

                {/* Blocked period blocks (red shade) */}
                {item.blocked_periods.map((bp) => {
                  const top = Math.max(0, toPercent(bp.start_time));
                  const bottom = Math.min(100, toPercent(bp.end_time));
                  if (bottom <= 0 || top >= 100) return null;
                  return (
                    <div
                      key={`blocked-${bp.id}`}
                      className="timeline-block blocked"
                      style={{
                        top: `${top}%`,
                        height: `${bottom - top}%`,
                      }}
                      title={`Blocked: ${bp.reason || 'No reason'} (${formatHour(new Date(bp.start_time))} – ${formatHour(new Date(bp.end_time))})`}
                    />
                  );
                })}
                {/* Availability blocks (light shade) */}
                {item.availabilities.map((avail) => {
                  const top = Math.max(0, toPercent(avail.start_time));
                  const bottom = Math.min(100, toPercent(avail.end_time));
                  if (bottom <= 0 || top >= 100) return null;
                  return (
                    <div
                      key={`avail-${avail.id}`}
                      className="timeline-block availability"
                      style={{
                        top: `${top}%`,
                        height: `${bottom - top}%`,
                      }}
                      title={`Available: ${formatHour(new Date(avail.start_time))} – ${formatHour(new Date(avail.end_time))}`}
                    />
                  );
                })}
                {/* Assignment blocks (darker shade, clickable) */}
                {item.assignments.map((assign) => {
                  const top = toPercent(assign.departure_time);
                  if (top < 0 || top > 100) return null;
                  const departure = new Date(assign.departure_time);
                  return (
                    <button
                      type="button"
                      key={`assign-${assign.id}`}
                      className={`timeline-block assignment${assign.is_vip ? ' vip' : ''}${assign.has_departed ? ' departed' : ''}`}
                      style={{ top: `${top}%` }}
                      title={`${formatHour(departure)} · ${assign.origin} → ${assign.destination} · ${assign.car_name}${assign.is_vip ? ' · VIP' : ''}`}
                      onClick={() => navigate(`/admin/rides/${assign.ride_id}/passengers`)}
                    >
                      <span className="timeline-assignment-time">{formatTime(departure)}</span>
                      <span className="timeline-assignment-route">
                        {assign.origin} → {assign.destination}
                      </span>
                      <span className="timeline-assignment-meta">
                        {assign.car_name}
                        {assign.is_vip ? ' · VIP' : ''}
                        {assign.has_departed ? ' · Departed' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

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
