import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { DriverTimeline, FestivalProgramItem } from '../../types';

const PROGRAM_TRACK_WIDTH = 280;
const PROGRAM_CLICK_INCREMENT_MS = 15 * 60 * 1000;

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

function formatDateTimeLocal(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function layoutProgramItems(
  items: FestivalProgramItem[],
  startMs: number,
  endMs: number,
) {
  type ProgramEntry = {
    item: FestivalProgramItem;
    start: number;
    end: number;
    column: number;
  };

  const visibleItems = items
    .map((item) => ({
      item,
      start: new Date(item.start_time).getTime(),
      end: new Date(item.end_time).getTime(),
    }))
    .filter((item) => item.start < endMs && item.end > startMs)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const layout: Array<ProgramEntry & { top: number; height: number; columnCount: number }> = [];
  let cluster: ProgramEntry[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    const columnCount = columnEnds.length;
    for (const entry of cluster) {
      const visibleStart = Math.max(entry.start, startMs);
      const visibleEnd = Math.min(entry.end, endMs);
      layout.push({
        ...entry,
        top: ((visibleStart - startMs) / (endMs - startMs)) * 100,
        height: Math.max(((visibleEnd - visibleStart) / (endMs - startMs)) * 100, 0.1),
        columnCount,
      });
    }
  };

  for (const item of visibleItems) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flushCluster();
      cluster = [];
      columnEnds = [];
      clusterEnd = -Infinity;
    }

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }

    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();

  return layout;
}

export function AdminDriverTimeline() {
  const navigate = useNavigate();
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DriverTimeline[]>([]);
  const [programItems, setProgramItems] = useState<FestivalProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);
  const [programForm, setProgramForm] = useState({
    title: '',
    location: '',
    description: '',
    start_time: '',
    end_time: '',
  });
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
      setProgramItems(result.program_items || []);
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
  const timelineMinWidth = `${140 + PROGRAM_TRACK_WIDTH + data.length * 240}px`;

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

  const programLayout = layoutProgramItems(programItems, startMs, endMs);

  const openCreateProgramForm = (selectedStart?: Date) => {
    const start = selectedStart
      ? new Date(selectedStart)
      : dateAtDayChange(rangeStart, dayChangeTime);
    if (!selectedStart) start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setProgramForm({
      title: '',
      location: '',
      description: '',
      start_time: formatDateTimeLocal(start),
      end_time: formatDateTimeLocal(end),
    });
    setEditingProgramId(null);
    setFormError('');
    setShowProgramForm(true);
  };

  const handleProgramContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.min(
      Math.max((event.clientY - bounds.top) / bounds.height, 0),
      1,
    );
    const clickedMs = startMs + position * totalMs;
    const selectedMs = Math.round(clickedMs / PROGRAM_CLICK_INCREMENT_MS)
      * PROGRAM_CLICK_INCREMENT_MS;
    openCreateProgramForm(new Date(selectedMs));
  };

  const openEditProgramForm = (item: FestivalProgramItem) => {
    setProgramForm({
      title: item.title,
      location: item.location,
      description: item.description,
      start_time: formatDateTimeLocal(item.start_time),
      end_time: formatDateTimeLocal(item.end_time),
    });
    setEditingProgramId(item.id);
    setFormError('');
    setShowProgramForm(true);
  };

  const closeProgramForm = () => {
    setShowProgramForm(false);
    setEditingProgramId(null);
    setFormError('');
  };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!programForm.title.trim()) {
      setFormError('Please enter a title');
      return;
    }

    const start = new Date(programForm.start_time);
    const end = new Date(programForm.end_time);
    if (
      Number.isNaN(start.getTime())
      || Number.isNaN(end.getTime())
      || start >= end
    ) {
      setFormError('End time must be after start time');
      return;
    }

    const payload = {
      title: programForm.title.trim(),
      location: programForm.location.trim(),
      description: programForm.description.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };

    try {
      if (editingProgramId) {
        await api.adminUpdateFestivalProgramItem(editingProgramId, payload);
      } else {
        await api.adminCreateFestivalProgramItem(payload);
      }
      closeProgramForm();
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save program item');
    }
  };

  const handleProgramDelete = async () => {
    if (!editingProgramId || !confirm('Delete this festival program item?')) return;

    try {
      await api.adminDeleteFestivalProgramItem(editingProgramId);
      closeProgramForm();
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete program item');
    }
  };

  if (loading) {
    return <div className="loading">Loading timeline...</div>;
  }

  return (
    <div className="admin-driver-timeline">
      <div className="page-header">
        <h1>Driver &amp; Festival Timeline</h1>
        <button type="button" className="btn btn-primary" onClick={() => openCreateProgramForm()}>
          Add Program Item
        </button>
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
        <small className="timeline-program-hint">
          Right-click the Festival program lane to add an item at that time.
        </small>
      </div>

      {showProgramForm && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="program-form-title">
            <h2 id="program-form-title">
              {editingProgramId ? 'Edit Festival Program Item' : 'Add Festival Program Item'}
            </h2>
            <form onSubmit={handleProgramSubmit}>
              {formError && <div className="error">{formError}</div>}
              <div className="form-group">
                <label htmlFor="program-title">Title</label>
                <input
                  id="program-title"
                  type="text"
                  value={programForm.title}
                  onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                  placeholder="e.g. Opening concert"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="program-location">Stage / Location</label>
                <input
                  id="program-location"
                  type="text"
                  value={programForm.location}
                  onChange={(e) => setProgramForm({ ...programForm, location: e.target.value })}
                  placeholder="e.g. Main stage"
                />
              </div>
              <div className="form-group">
                <label htmlFor="program-start">Start Time</label>
                <input
                  id="program-start"
                  type="datetime-local"
                  value={programForm.start_time}
                  onChange={(e) => setProgramForm({ ...programForm, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="program-end">End Time</label>
                <input
                  id="program-end"
                  type="datetime-local"
                  value={programForm.end_time}
                  onChange={(e) => setProgramForm({ ...programForm, end_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="program-description">Description</label>
                <textarea
                  id="program-description"
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                {editingProgramId && (
                  <button
                    type="button"
                    className="btn btn-danger program-delete-button"
                    onClick={handleProgramDelete}
                  >
                    Delete
                  </button>
                )}
                <button type="button" onClick={closeProgramForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProgramId ? 'Update' : 'Add to Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="timeline-container">
        <div className="timeline-header-scroll" ref={headerScrollRef}>
          <div className="timeline-header" style={{ minWidth: timelineMinWidth }}>
            <div className="timeline-corner">Time</div>
            <div className="timeline-program-header">Festival program</div>
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

            {/* Global festival program lane */}
            <div
              className="timeline-track program-track"
              onContextMenu={handleProgramContextMenu}
            >
              {guidelines.map((time, i) => (
                <div
                  key={`program-grid-${i}`}
                  className={`timeline-gridline${time.getMinutes() === 0 ? ' hour' : ''}`}
                  style={{ top: `${((time.getTime() - startMs) / totalMs) * 100}%` }}
                />
              ))}
              {programLayout.map(({ item, top, height, column, columnCount }) => {
                const start = new Date(item.start_time);
                const end = new Date(item.end_time);
                const widthPercent = 100 / columnCount;
                const leftPercent = column * widthPercent;
                return (
                  <button
                    type="button"
                    key={`program-${item.id}`}
                    className="timeline-block program-item"
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                      right: 'auto',
                    }}
                    title={`${item.title}${item.location ? ` · ${item.location}` : ''} · ${formatHour(start)} – ${formatHour(end)}${item.description ? `\n${item.description}` : ''}`}
                    onClick={() => openEditProgramForm(item)}
                  >
                    <span className="timeline-program-time">
                      {formatTime(start)}–{formatTime(end)}
                    </span>
                    <span className="timeline-program-title">{item.title}</span>
                    {item.location && (
                      <span className="timeline-program-location">{item.location}</span>
                    )}
                  </button>
                );
              })}
              {programItems.length === 0 && (
                <span className="timeline-empty-track">Right-click to add a program item</span>
              )}
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
          <span className="legend-swatch" style={{ backgroundColor: '#7c3aed' }} /> Festival program
        </span>
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
