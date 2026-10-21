import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { DriverTimeline, FestivalProgramItem } from '../../types';

type TimelineBlockedPeriod = DriverTimeline['blocked_periods'][number];
type TimelineAssignment = DriverTimeline['assignments'][number];
type DraggedRideAssignment = {
  assignment: TimelineAssignment;
  sourceDriverId: number;
};

const PROGRAM_TRACK_WIDTH = 280;
const PROGRAM_CLICK_INCREMENT_MS = 15 * 60 * 1000;
const PROGRAM_DRAG_TYPE = 'application/x-shuttle-program-item';
const RIDE_ASSIGNMENT_DRAG_TYPE = 'application/x-shuttle-ride-assignment';

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
  const [notice, setNotice] = useState('');
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
  const [timelineRange, setTimelineRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [draggedProgramItemId, setDraggedProgramItemId] = useState<number | null>(null);
  const [dragOverDriverId, setDragOverDriverId] = useState<number | null>(null);
  const [savingBlockDriverId, setSavingBlockDriverId] = useState<number | null>(null);
  const [deletingBlockedPeriodId, setDeletingBlockedPeriodId] = useState<number | null>(null);
  const [draggedRideAssignment, setDraggedRideAssignment] = useState<DraggedRideAssignment | null>(null);
  const [dragOverRideAction, setDragOverRideAction] = useState<'move' | 'add'>('move');
  const [savingRideDriverId, setSavingRideDriverId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.adminGetSiteSettings(),
      api.adminGetDriverTimeline(),
    ])
      .then(([settings, timeline]) => {
        setDayChangeTime(settings.day_change_time || '06:00');
        setTimelineRange(timeline.range);
        setData(timeline.drivers);
        setProgramItems(timeline.program_items || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
      })
      .finally(() => setLoading(false));
  }, []);

  const loadData = async () => {
    try {
      setError('');
      const result = await api.adminGetDriverTimeline();
      setTimelineRange(result.range);
      setData(result.drivers);
      setProgramItems(result.program_items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const draggedProgramItem = programItems.find(
    (item) => item.id === draggedProgramItemId,
  );

  const handleProgramDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    item: FestivalProgramItem,
  ) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PROGRAM_DRAG_TYPE, String(item.id));
    event.dataTransfer.setData('text/plain', item.title);
    setDraggedProgramItemId(item.id);
    setDraggedRideAssignment(null);
    setNotice('');
  };

  const handleProgramDragEnd = () => {
    setDraggedProgramItemId(null);
    setDragOverDriverId(null);
  };

  const handleAssignmentDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    assignment: TimelineAssignment,
    sourceDriverId: number,
  ) => {
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData(
      RIDE_ASSIGNMENT_DRAG_TYPE,
      `${sourceDriverId}:${assignment.id}`,
    );
    event.dataTransfer.setData(
      'text/plain',
      `ride:${sourceDriverId}:${assignment.id}`,
    );
    setDraggedProgramItemId(null);
    setDraggedRideAssignment({ assignment, sourceDriverId });
    setNotice('');
  };

  const handleAssignmentDragEnd = () => {
    setDraggedRideAssignment(null);
    setDragOverDriverId(null);
  };

  const handleDriverDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const isRideDrag = Boolean(
      draggedRideAssignment || dragTypes.includes(RIDE_ASSIGNMENT_DRAG_TYPE),
    );
    const isProgramDrag = Boolean(
      draggedProgramItem
      || dragTypes.includes(PROGRAM_DRAG_TYPE),
    );
    if (!isRideDrag && !isProgramDrag) return;

    event.preventDefault();
    const addMode = Boolean(isRideDrag && event.ctrlKey);
    event.dataTransfer.dropEffect = isRideDrag ? (addMode ? 'copy' : 'move') : 'copy';
    setDragOverDriverId(driverId);
    setDragOverRideAction(addMode ? 'add' : 'move');
  };

  const handleDriverDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setDragOverDriverId(null);
  };

  const handleProgramDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    const rawId = event.dataTransfer.getData(PROGRAM_DRAG_TYPE);
    const item = programItems.find(
      (programItem) => programItem.id === Number(rawId),
    ) ?? draggedProgramItem;
    const driver = data.find((entry) => entry.driver.id === driverId);
    if (!item || !driver) return;

    const startMs = new Date(item.start_time).getTime();
    const endMs = new Date(item.end_time).getTime();
    const alreadyBlocked = driver.blocked_periods.some(
      (blockedPeriod) => (
        blockedPeriod.reason === item.title
        && new Date(blockedPeriod.start_time).getTime() === startMs
        && new Date(blockedPeriod.end_time).getTime() === endMs
      ),
    );
    if (alreadyBlocked) {
      setNotice(`${item.title} is already blocked for ${driver.driver.name}.`);
      return;
    }

    setSavingBlockDriverId(driverId);
    setError('');
    setNotice('');
    try {
      await api.adminCreateBlockedPeriod({
        driver_id: driverId,
        start_time: item.start_time,
        end_time: item.end_time,
        reason: item.title,
      });
      await loadData();
      setNotice(`Blocked ${driver.driver.name} for ${item.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block driver time');
    } finally {
      setSavingBlockDriverId(null);
      setDraggedProgramItemId(null);
    }
  };

  const handleAssignmentDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    const plainText = event.dataTransfer.getData('text/plain');
    const rawAssignment = event.dataTransfer.getData(RIDE_ASSIGNMENT_DRAG_TYPE)
      || (plainText.startsWith('ride:') ? plainText.slice(5) : '');
    const [rawSourceDriverId, rawAssignmentId] = rawAssignment.split(':').map(Number);
    const sourceDriver = data.find((entry) => entry.driver.id === rawSourceDriverId);
    const assignment = draggedRideAssignment?.assignment
      ?? sourceDriver?.assignments.find((entry) => entry.id === rawAssignmentId);
    const targetDriver = data.find((entry) => entry.driver.id === driverId);
    const addMode = event.ctrlKey;
    if (!assignment || !targetDriver) {
      setError('Could not identify the dropped ride assignment.');
      return;
    }

    const sourceDriverId = draggedRideAssignment?.sourceDriverId ?? rawSourceDriverId;
    if (sourceDriverId === driverId) {
      setNotice(`This ride is already assigned to ${targetDriver.driver.name}.`);
      return;
    }
    if (targetDriver.assignments.some((entry) => entry.ride_id === assignment.ride_id)) {
      setNotice(`${targetDriver.driver.name} is already assigned to this ride.`);
      return;
    }

    setSavingRideDriverId(driverId);
    setError('');
    setNotice('');
    try {
      if (addMode) {
        await api.adminAddRideAssignment(assignment.ride_id, driverId);
      } else {
        await api.adminReassignRideAssignment(
          assignment.ride_id,
          assignment.id,
          driverId,
        );
      }
      await loadData();
      setNotice(
        addMode
          ? `Added ${targetDriver.driver.name} and their default car to the ride.`
          : `Moved the ride to ${targetDriver.driver.name} and their default car.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ride assignment');
    } finally {
      setSavingRideDriverId(null);
      setDraggedRideAssignment(null);
    }
  };

  const handleDriverDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    event.preventDefault();
    setDragOverDriverId(null);
    const plainText = event.dataTransfer.getData('text/plain');
    if (
      draggedRideAssignment
      || event.dataTransfer.getData(RIDE_ASSIGNMENT_DRAG_TYPE)
      || plainText.startsWith('ride:')
    ) {
      await handleAssignmentDrop(event, driverId);
      return;
    }
    await handleProgramDrop(event, driverId);
  };

  const handleBlockedPeriodRemove = async (
    blockedPeriod: TimelineBlockedPeriod,
    driverName: string,
  ) => {
    if (!confirm(`Remove the blocked period "${blockedPeriod.reason || 'Blocked'}" from ${driverName}?`)) {
      return;
    }

    setDeletingBlockedPeriodId(blockedPeriod.id);
    setError('');
    setNotice('');
    try {
      await api.adminDeleteBlockedPeriod(blockedPeriod.id);
      await loadData();
      setNotice(`Removed the blocked period from ${driverName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove blocked period');
    } finally {
      setDeletingBlockedPeriodId(null);
    }
  };

  const startMs = timelineRange ? new Date(timelineRange.start).getTime() : 0;
  const endMs = timelineRange ? new Date(timelineRange.end).getTime() : 0;
  const totalMs = endMs - startMs;
  const remainingDayCount = timelineRange && Number.isFinite(totalMs)
    ? Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)))
    : 1;
  const timelineHeight = Math.max(1440, Math.min(10080, remainingDayCount * 1440));
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

  const formatFestivalDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const firstVisibleDate = timelineRange ? new Date(timelineRange.start) : null;
  const lastVisibleDate = timelineRange ? new Date(timelineRange.end) : null;
  if (lastVisibleDate) {
    lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);
  }

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
      : new Date(timelineRange?.start ?? Date.now());
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

  if (!timelineRange) {
    return (
      <div className="admin-driver-timeline">
        <div className="page-header">
          <h1>Driver &amp; Festival Timeline</h1>
        </div>
        {error && <div className="error">{error}</div>}
        {!error && (
          <div className="timeline-no-dates">
            All festival dates have passed. Update the festival dates in Site Settings
            to show an upcoming festival.
          </div>
        )}
      </div>
    );
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
      {notice && <div className="success">{notice}</div>}

      <div className="timeline-controls">
        <div className="timeline-festival-summary">
          <strong>Remaining festival dates</strong>
          <span>
            {firstVisibleDate && lastVisibleDate
              ? `${formatFestivalDate(firstVisibleDate)} – ${formatFestivalDate(lastVisibleDate)} (${remainingDayCount} ${remainingDayCount === 1 ? 'day' : 'days'})`
              : 'No upcoming dates'}
          </span>
        </div>
        <small className="timeline-day-boundary">
          Each festival day runs from {dayChangeTime} until {dayChangeTime} the following day.
        </small>
        <small className="timeline-program-hint">
          Drag a program item to block a driver. Drag a ride to reassign it, or
          Ctrl-drag to add the driver. Right-click the program lane to add an item.
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
              <div
                key={`header-${item.driver.id}`}
                className={`timeline-driver-header${dragOverDriverId === item.driver.id ? ' drag-over' : ''}`}
                onDragEnter={(event) => handleDriverDragOver(event, item.driver.id)}
                onDragOver={(event) => handleDriverDragOver(event, item.driver.id)}
                onDragLeave={handleDriverDragLeave}
                onDrop={(event) => handleDriverDrop(event, item.driver.id)}
              >
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
                    draggable
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                      right: 'auto',
                    }}
                    title={`${item.title}${item.location ? ` · ${item.location}` : ''} · ${formatHour(start)} – ${formatHour(end)}${item.description ? `\n${item.description}` : ''}`}
                    onClick={() => openEditProgramForm(item)}
                    onDragStart={(event) => handleProgramDragStart(event, item)}
                    onDragEnd={handleProgramDragEnd}
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
              <div
                key={item.driver.id}
                className={[
                  'timeline-track',
                  draggedProgramItemId !== null || draggedRideAssignment
                    ? 'accepts-timeline-drop'
                    : '',
                  dragOverDriverId === item.driver.id ? 'drag-over' : '',
                  savingBlockDriverId === item.driver.id
                    || savingRideDriverId === item.driver.id
                    ? 'saving-block'
                    : '',
                ].filter(Boolean).join(' ')}
                onDragEnter={(event) => handleDriverDragOver(event, item.driver.id)}
                onDragOver={(event) => handleDriverDragOver(event, item.driver.id)}
                onDragLeave={handleDriverDragLeave}
                onDrop={(event) => handleDriverDrop(event, item.driver.id)}
              >
                {dragOverDriverId === item.driver.id && (
                  <div className="timeline-drop-hint">
                    {draggedRideAssignment
                      ? `${dragOverRideAction === 'add' ? 'Add driver' : 'Move ride'} with default car`
                      : draggedProgramItem && (
                        <>
                          Block {formatTime(new Date(draggedProgramItem.start_time))}
                          –{formatTime(new Date(draggedProgramItem.end_time))}
                        </>
                      )}
                  </div>
                )}
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
                    >
                      <button
                        type="button"
                        className="timeline-blocked-remove"
                        aria-label={`Remove blocked period: ${bp.reason || 'Blocked'}`}
                        title="Remove blocked period"
                        disabled={deletingBlockedPeriodId === bp.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleBlockedPeriodRemove(bp, item.driver.name);
                        }}
                      >
                        ×
                      </button>
                      <span className="timeline-blocked-reason">
                        {bp.reason || 'Blocked'}
                      </span>
                    </div>
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
                      className={`timeline-block assignment${assign.is_vip ? ' vip' : ''}${assign.has_departed ? ' departed' : ''}${!assign.has_departed ? ' draggable-assignment' : ''}`}
                      draggable={!assign.has_departed}
                      style={{ top: `${top}%` }}
                      title={`${formatHour(departure)} · ${assign.origin} → ${assign.destination} · ${assign.car_name}${assign.is_vip ? ' · VIP' : ''}${assign.has_departed ? '' : '\nDrag to move · Ctrl-drag to add another driver'}`}
                      onClick={() => navigate(`/admin/rides/${assign.ride_id}/passengers`)}
                      onDragStart={(event) => handleAssignmentDragStart(
                        event,
                        assign,
                        item.driver.id,
                      )}
                      onDragEnd={handleAssignmentDragEnd}
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
