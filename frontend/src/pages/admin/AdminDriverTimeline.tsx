import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type {
  DriverTimeline,
  FestivalProgramItem,
  TimelineRidePassenger,
  TimelineUnassignedRide,
} from '../../types';

type TimelineBlockedPeriod = DriverTimeline['blocked_periods'][number];
type TimelineAssignment = DriverTimeline['assignments'][number];
type DraggedRideAssignment = {
  assignment: TimelineAssignment;
  sourceDriverId: number;
};

type TimelineNotificationsProps = {
  error: string;
  notice: string;
  onDismissError: () => void;
  onDismissNotice: () => void;
};

type TimelineDaySection = {
  index: number;
  top: number;
  height: number;
  label: string;
};

type TimelineBlockLayout = {
  column: number;
  columnCount: number;
};

type RideHoverDetails = {
  departureTime: string;
  origin: string;
  destination: string;
  originName: string;
  destinationName: string;
  routeLabel: string;
  reservedSeats: number;
  totalSeats: number;
  isVip: boolean;
  drivers: Array<{ name: string; carName: string }>;
  passengers: TimelineRidePassenger[];
  overlapsBlockedPeriod: boolean;
  overlapsAnotherRide: boolean;
};

const TIME_AXIS_WIDTH = 52;
const PROGRAM_TRACK_WIDTH = 180;
const UNASSIGNED_TRACK_WIDTH = 140;
const DRIVER_TRACK_WIDTH = 150;
const PROGRAM_CLICK_INCREMENT_MS = 15 * 60 * 1000;
const PROGRAM_DRAG_TYPE = 'application/x-shuttle-program-item';
const RIDE_ASSIGNMENT_DRAG_TYPE = 'application/x-shuttle-ride-assignment';
const UNASSIGNED_RIDE_DRAG_TYPE = 'application/x-shuttle-unassigned-ride';

function TimelineNotifications({
  error,
  notice,
  onDismissError,
  onDismissNotice,
}: TimelineNotificationsProps) {
  if (!error && !notice) return null;

  return (
    <div className="timeline-notifications" aria-live="polite">
      {error && (
        <div className="timeline-notification error" role="alert">
          <span className="timeline-notification-message">{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={onDismissError}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="timeline-notification success" role="status">
          <span className="timeline-notification-message">{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={onDismissNotice}>
            ×
          </button>
          <span className="timeline-notification-progress" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function TimelineDayBands({
  sections,
  showLabels = false,
}: {
  sections: TimelineDaySection[];
  showLabels?: boolean;
}) {
  return sections.map((section) => (
    <div
      key={`day-band-${section.index}`}
      className={`timeline-day-band${section.index % 2 === 1 ? ' alternate' : ''}`}
      style={{ top: `${section.top}%`, height: `${section.height}%` }}
    >
      {showLabels && (
        <span className="timeline-day-label">{section.label}</span>
      )}
    </div>
  ));
}

function buildTimelineDaySections(startMs: number, endMs: number) {
  const sections: TimelineDaySection[] = [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return sections;
  }

  let dayStart = new Date(startMs);
  let index = 0;
  while (dayStart.getTime() < endMs) {
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayEndMs = Math.min(nextDay.getTime(), endMs);
    sections.push({
      index,
      top: ((dayStart.getTime() - startMs) / (endMs - startMs)) * 100,
      height: ((dayEndMs - dayStart.getTime()) / (endMs - startMs)) * 100,
      label: dayStart.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      }),
    });
    dayStart = nextDay;
    index += 1;
  }

  return sections;
}

function getAssignmentOverlapInfo(
  driverTimeline: DriverTimeline,
  assignment: TimelineAssignment,
) {
  const startMs = new Date(assignment.departure_time).getTime();
  const endMs = new Date(assignment.estimated_end_time).getTime();
  const overlapsRide = driverTimeline.assignments.some((otherAssignment) => {
    if (otherAssignment.id === assignment.id) return false;
    const otherStartMs = new Date(otherAssignment.departure_time).getTime();
    const otherEndMs = new Date(otherAssignment.estimated_end_time).getTime();
    return startMs < otherEndMs && endMs > otherStartMs;
  });
  const overlapsBlockedPeriod = driverTimeline.blocked_periods.some(
    (blockedPeriod) => (
      startMs < new Date(blockedPeriod.end_time).getTime()
      && endMs > new Date(blockedPeriod.start_time).getTime()
    ),
  );

  const conflicts = [
    overlapsRide ? 'another ride' : '',
    overlapsBlockedPeriod ? 'a blocked period' : '',
  ].filter(Boolean);
  return {
    label: conflicts.length > 0 ? `Overlaps ${conflicts.join(' and ')}` : '',
    overlapsBlockedPeriod,
  };
}

function layoutTimelineLaneBlocks(
  blocks: Array<{ key: string; start: number; end: number }>,
) {
  const layout = new Map<string, TimelineBlockLayout>();
  const sortedBlocks = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: Array<{ key: string; start: number; end: number; column: number }> = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    for (const block of cluster) {
      layout.set(block.key, {
        column: block.column,
        columnCount: Math.max(1, columnEnds.length),
      });
    }
  };

  for (const block of sortedBlocks) {
    if (cluster.length > 0 && block.start >= clusterEnd) {
      flushCluster();
      cluster = [];
      columnEnds = [];
      clusterEnd = -Infinity;
    }

    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(block.end);
    } else {
      columnEnds[column] = block.end;
    }

    cluster.push({ ...block, column });
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  flushCluster();

  return layout;
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
  const [unassignedRides, setUnassignedRides] = useState<TimelineUnassignedRide[]>([]);
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
  const [timelineRange, setTimelineRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [draggedProgramItemId, setDraggedProgramItemId] = useState<number | null>(null);
  const [dragOverDriverId, setDragOverDriverId] = useState<number | null>(null);
  const [savingBlockDriverId, setSavingBlockDriverId] = useState<number | null>(null);
  const [deletingBlockedPeriodId, setDeletingBlockedPeriodId] = useState<number | null>(null);
  const [draggedRideAssignment, setDraggedRideAssignment] = useState<DraggedRideAssignment | null>(null);
  const [draggedUnassignedRide, setDraggedUnassignedRide] = useState<TimelineUnassignedRide | null>(null);
  const [dragOverRideAction, setDragOverRideAction] = useState<'move' | 'add'>('move');
  const [unassignedDropActive, setUnassignedDropActive] = useState(false);
  const [savingRideDriverId, setSavingRideDriverId] = useState<number | null>(null);
  const [savingUnassignment, setSavingUnassignment] = useState(false);
  const [hoveredRideId, setHoveredRideId] = useState<number | null>(null);
  const [rideInfoPosition, setRideInfoPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    api.adminGetDriverTimeline()
      .then((timeline) => {
        setTimelineRange(timeline.range);
        setData(timeline.drivers);
        setProgramItems(timeline.program_items || []);
        setUnassignedRides(timeline.unassigned_rides || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const loadData = async () => {
    try {
      setError('');
      const result = await api.adminGetDriverTimeline();
      setTimelineRange(result.range);
      setData(result.drivers);
      setProgramItems(result.program_items || []);
      setUnassignedRides(result.unassigned_rides || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const hideRideInfo = () => {
    setHoveredRideId(null);
    setRideInfoPosition(null);
  };

  const showRideInfo = (rideId: number, anchor: HTMLElement) => {
    const bounds = anchor.getBoundingClientRect();
    const cardWidth = 280;
    const cardHeight = 360;
    const gap = 10;
    const left = bounds.right + gap + cardWidth <= window.innerWidth - 12
      ? bounds.right + gap
      : Math.max(12, bounds.left - cardWidth - gap);
    const top = Math.max(
      12,
      Math.min(bounds.top, window.innerHeight - cardHeight - 12),
    );
    setHoveredRideId(rideId);
    setRideInfoPosition({ top, left });
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
    setDraggedUnassignedRide(null);
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
    setDraggedUnassignedRide(null);
    setDraggedRideAssignment({ assignment, sourceDriverId });
    setNotice('');
  };

  const handleAssignmentDragEnd = () => {
    setDraggedRideAssignment(null);
    setDragOverDriverId(null);
    setUnassignedDropActive(false);
    hideRideInfo();
  };

  const handleUnassignedRideDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    ride: TimelineUnassignedRide,
  ) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(UNASSIGNED_RIDE_DRAG_TYPE, String(ride.id));
    event.dataTransfer.setData('text/plain', `unassigned:${ride.id}`);
    setDraggedProgramItemId(null);
    setDraggedRideAssignment(null);
    setDraggedUnassignedRide(ride);
    setNotice('');
  };

  const handleUnassignedRideDragEnd = () => {
    setDraggedUnassignedRide(null);
    setDragOverDriverId(null);
    setUnassignedDropActive(false);
    hideRideInfo();
  };

  const handleDriverDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const isRideDrag = Boolean(
      draggedRideAssignment
      || draggedUnassignedRide
      || dragTypes.includes(RIDE_ASSIGNMENT_DRAG_TYPE)
      || dragTypes.includes(UNASSIGNED_RIDE_DRAG_TYPE),
    );
    const isProgramDrag = Boolean(
      draggedProgramItem
      || dragTypes.includes(PROGRAM_DRAG_TYPE),
    );
    if (!isRideDrag && !isProgramDrag) return;

    event.preventDefault();
    const addMode = Boolean(isRideDrag && event.ctrlKey);
    event.dataTransfer.dropEffect = (
      draggedUnassignedRide
      || dragTypes.includes(UNASSIGNED_RIDE_DRAG_TYPE)
    )
      ? 'copy'
      : isRideDrag
        ? (addMode ? 'copy' : 'move')
        : 'copy';
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
    hideRideInfo();
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
      hideRideInfo();
    }
  };

  const handleUnassignedRideToDriver = async (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    const plainText = event.dataTransfer.getData('text/plain');
    const rawId = event.dataTransfer.getData(UNASSIGNED_RIDE_DRAG_TYPE)
      || (plainText.startsWith('unassigned:') ? plainText.slice(11) : '');
    const ride = unassignedRides.find((entry) => entry.id === Number(rawId))
      ?? draggedUnassignedRide;
    const targetDriver = data.find((entry) => entry.driver.id === driverId);
    if (!ride || !targetDriver) {
      setError('Could not identify the dropped unassigned ride.');
      return;
    }

    setSavingRideDriverId(driverId);
    setError('');
    setNotice('');
    try {
      await api.adminAddRideAssignment(ride.id, driverId);
      await loadData();
      setNotice(
        `Assigned ${targetDriver.driver.name} and their default car to the ride.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign the ride');
    } finally {
      setSavingRideDriverId(null);
      setDraggedUnassignedRide(null);
    }
  };

  const handleUnassignedLaneDragOver = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    if (
      !draggedRideAssignment
      && !dragTypes.includes(RIDE_ASSIGNMENT_DRAG_TYPE)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setUnassignedDropActive(true);
  };

  const handleUnassignedLaneDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setUnassignedDropActive(false);
  };

  const handleUnassignedLaneDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setUnassignedDropActive(false);

    const plainText = event.dataTransfer.getData('text/plain');
    const rawAssignment = event.dataTransfer.getData(RIDE_ASSIGNMENT_DRAG_TYPE)
      || (plainText.startsWith('ride:') ? plainText.slice(5) : '');
    const [rawSourceDriverId, rawAssignmentId] = rawAssignment.split(':').map(Number);
    const sourceDriver = data.find((entry) => entry.driver.id === rawSourceDriverId);
    const assignment = draggedRideAssignment?.assignment
      ?? sourceDriver?.assignments.find((entry) => entry.id === rawAssignmentId);
    if (!assignment) {
      setError('Could not identify the dropped ride assignment.');
      return;
    }
    const sourceDriverName = sourceDriver?.driver.name
      ?? data.find((entry) => entry.assignments.some((item) => item.id === assignment.id))
        ?.driver.name
      ?? 'driver';
    const remainingAssignments = data.reduce(
      (count, entry) => (
        count + entry.assignments.filter((item) => item.ride_id === assignment.ride_id).length
      ),
      0,
    ) - 1;

    setSavingUnassignment(true);
    setError('');
    setNotice('');
    try {
      await api.adminRemoveRideAssignment(assignment.ride_id, assignment.id);
      await loadData();
      setNotice(
        remainingAssignments > 0
          ? `Removed ${sourceDriverName}'s assignment from the ride.`
          : 'Moved the ride to Unassigned.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign the ride');
    } finally {
      setSavingUnassignment(false);
      setDraggedRideAssignment(null);
      hideRideInfo();
    }
  };

  const handleDriverDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    driverId: number,
  ) => {
    event.preventDefault();
    setDragOverDriverId(null);
    setUnassignedDropActive(false);
    const plainText = event.dataTransfer.getData('text/plain');
    if (
      draggedUnassignedRide
      || event.dataTransfer.getData(UNASSIGNED_RIDE_DRAG_TYPE)
      || plainText.startsWith('unassigned:')
    ) {
      await handleUnassignedRideToDriver(event, driverId);
      return;
    }
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
  const timelineMinWidth = `${TIME_AXIS_WIDTH + PROGRAM_TRACK_WIDTH + UNASSIGNED_TRACK_WIDTH + data.length * DRIVER_TRACK_WIDTH}px`;
  const daySections = buildTimelineDaySections(startMs, endMs);
  const unassignedRideLayout = layoutTimelineLaneBlocks(
    unassignedRides.map((ride) => {
      const rideStart = new Date(ride.departure_time).getTime();
      return {
        key: `unassigned-${ride.id}`,
        start: rideStart,
        end: new Date(ride.estimated_end_time).getTime(),
      };
    }),
  );
  const laneLayouts = new Map<number, Map<string, TimelineBlockLayout>>(
    data.map((driverTimeline) => [
      driverTimeline.driver.id,
      layoutTimelineLaneBlocks([
        ...driverTimeline.assignments.map((assignment) => {
          const assignmentStart = new Date(assignment.departure_time).getTime();
          return {
            key: `assignment-${assignment.id}`,
            start: assignmentStart,
            end: new Date(assignment.estimated_end_time).getTime(),
          };
        }),
      ]),
    ]),
  );

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

  const rideDetailsById = new Map<number, RideHoverDetails>();
  for (const driverTimeline of data) {
    for (const assignment of driverTimeline.assignments) {
      const details: RideHoverDetails = rideDetailsById.get(assignment.ride_id) ?? {
        departureTime: assignment.departure_time,
        origin: assignment.origin,
        destination: assignment.destination,
        originName: assignment.origin_name,
        destinationName: assignment.destination_name,
        routeLabel: assignment.route_label,
        reservedSeats: assignment.reserved_seats,
        totalSeats: assignment.total_seats,
        isVip: assignment.is_vip,
        drivers: [],
        passengers: assignment.passengers,
        overlapsBlockedPeriod: false,
        overlapsAnotherRide: false,
      };
      details.drivers.push({
        name: driverTimeline.driver.name,
        carName: assignment.car_name,
      });
      details.overlapsBlockedPeriod = (
        details.overlapsBlockedPeriod
        || getAssignmentOverlapInfo(driverTimeline, assignment).overlapsBlockedPeriod
      );
      details.overlapsAnotherRide = (
        details.overlapsAnotherRide
        || getAssignmentOverlapInfo(driverTimeline, assignment).label.includes('another ride')
      );
      rideDetailsById.set(assignment.ride_id, details);
    }
  }
  for (const ride of unassignedRides) {
    rideDetailsById.set(ride.id, {
      departureTime: ride.departure_time,
      origin: ride.origin,
      destination: ride.destination,
      originName: ride.origin_name,
      destinationName: ride.destination_name,
      routeLabel: ride.route_label,
      reservedSeats: ride.reserved_seats,
      totalSeats: ride.total_seats,
      isVip: ride.is_vip,
      drivers: [],
      passengers: ride.passengers,
      overlapsBlockedPeriod: false,
      overlapsAnotherRide: false,
    });
  }
  const hoveredRideDetails = hoveredRideId === null
    ? null
    : rideDetailsById.get(hoveredRideId);
  const hoveredRideStatus = !hoveredRideDetails
    ? ''
    : hoveredRideDetails.totalSeats === 0
      ? 'No driver assigned'
      : hoveredRideDetails.reservedSeats > hoveredRideDetails.totalSeats
        ? 'Over capacity'
        : hoveredRideDetails.reservedSeats === hoveredRideDetails.totalSeats
          ? 'Full'
          : 'Available';
  const hoveredPassengers = hoveredRideDetails?.passengers ?? [];
  const visibleHoveredPassengers = hoveredPassengers.slice(0, 8);
  const remainingHoveredPassengers = hoveredPassengers.length - visibleHoveredPassengers.length;

  // Generate time markers
  const markers: Date[] = [];
  const markerStep = 60 * 60 * 1000;
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
        <TimelineNotifications
          error={error}
          notice={notice}
          onDismissError={() => setError('')}
          onDismissNotice={() => setNotice('')}
        />
        <div className="page-header">
          <h1>Driver &amp; Festival Timeline</h1>
        </div>
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
      <TimelineNotifications
        error={error}
        notice={notice}
        onDismissError={() => setError('')}
        onDismissNotice={() => setNotice('')}
      />
      {rideInfoPosition && hoveredRideDetails && (
        <div
          className="timeline-ride-info"
          style={{ top: rideInfoPosition.top, left: rideInfoPosition.left }}
          role="tooltip"
        >
          <div className="timeline-ride-info-header">
            <strong>
              {hoveredRideDetails.routeLabel}
            </strong>
            {hoveredRideDetails.isVip && (
              <span className="timeline-ride-info-vip">VIP</span>
            )}
          </div>
          <div className="timeline-ride-info-time">
            {formatHour(new Date(hoveredRideDetails.departureTime))}
          </div>
          <div className="timeline-ride-info-row">
            <span>Capacity</span>
            <strong>
              {hoveredRideDetails.reservedSeats}/{hoveredRideDetails.totalSeats}
            </strong>
          </div>
          <div className="timeline-ride-info-row">
            <span>Status</span>
            <strong
              className={
                hoveredRideStatus === 'Over capacity'
                  ? 'warning'
                  : hoveredRideStatus === 'Full'
                    ? 'full'
                    : ''
              }
            >
              {hoveredRideStatus}
            </strong>
          </div>
          <div className="timeline-ride-info-drivers">
            <span>{hoveredRideDetails.drivers.length > 0 ? 'Drivers' : 'Assignment'}</span>
            {hoveredRideDetails.drivers.length > 0 ? (
              <ul>
                {hoveredRideDetails.drivers.map((driver) => (
                  <li key={`${driver.name}-${driver.carName}`}>
                    {driver.name} · {driver.carName}
                  </li>
                ))}
              </ul>
            ) : (
              <strong>No driver assigned</strong>
            )}
          </div>
          <div className="timeline-ride-info-passengers">
            <span>Passengers ({hoveredPassengers.length})</span>
            {visibleHoveredPassengers.length > 0 ? (
              <ul>
                {visibleHoveredPassengers.map((passenger, index) => (
                  <li key={`${passenger.name}-${passenger.status}-${index}`}>
                    <span>{passenger.name}{passenger.pickup && passenger.dropoff ? ` · ${passenger.pickup} → ${passenger.dropoff}` : ''}</span>
                    <span>
                      {passenger.seats} {passenger.seats === 1 ? 'seat' : 'seats'}
                      {passenger.status === 'pending' ? ' · pending' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <strong>No passengers</strong>
            )}
            {remainingHoveredPassengers > 0 && (
              <small>+{remainingHoveredPassengers} more passengers</small>
            )}
          </div>
          {hoveredRideDetails.overlapsBlockedPeriod && (
            <div className="timeline-ride-info-warning">
              Overlaps a blocked period
            </div>
          )}
          {hoveredRideDetails.overlapsAnotherRide && (
            <div className="timeline-ride-info-warning">
              Overlaps another ride for the same driver
            </div>
          )}
          <div className="timeline-ride-info-hint">
            {hoveredRideDetails.drivers.length > 0
              ? 'Drag to move · Ctrl-drag to add a driver'
              : 'Drag to a driver to assign this ride'}
          </div>
        </div>
      )}
      <div className="page-header">
        <h1>Driver &amp; Festival Timeline</h1>
        <button type="button" className="btn btn-primary" onClick={() => openCreateProgramForm()}>
          Add Program Item
        </button>
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
            <div
              className="timeline-unassigned-header"
              title="Rides with no assigned driver"
            >
              Unassigned ({unassignedRides.length})
            </div>
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
            hideRideInfo();
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
              <TimelineDayBands sections={daySections} showLabels />
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
                  <span className="marker-label">{formatTime(m)}</span>
                </div>
              ))}
            </div>

            {/* Global festival program lane */}
            <div
              className="timeline-track program-track"
              onContextMenu={handleProgramContextMenu}
            >
              <TimelineDayBands sections={daySections} />
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

            {/* Rides without a driver */}
            <div
              className={`timeline-track unassigned-track${unassignedDropActive ? ' drag-over' : ''}${savingUnassignment ? ' saving-block' : ''}`}
              onDragEnter={handleUnassignedLaneDragOver}
              onDragOver={handleUnassignedLaneDragOver}
              onDragLeave={handleUnassignedLaneDragLeave}
              onDrop={handleUnassignedLaneDrop}
            >
              {unassignedDropActive && (
                <div className="timeline-drop-hint">Move ride to Unassigned</div>
              )}
              <TimelineDayBands sections={daySections} />
              {guidelines.map((time, i) => (
                <div
                  key={`unassigned-grid-${i}`}
                  className={`timeline-gridline${time.getMinutes() === 0 ? ' hour' : ''}`}
                  style={{ top: `${((time.getTime() - startMs) / totalMs) * 100}%` }}
                />
              ))}
              {unassignedRides.map((ride) => {
                const top = toPercent(ride.departure_time);
                if (top < 0 || top > 100) return null;
                const departure = new Date(ride.departure_time);
                const rideLayout = unassignedRideLayout.get(`unassigned-${ride.id}`) ?? {
                  column: 0,
                  columnCount: 1,
                };
                const rideWidth = 100 / rideLayout.columnCount;
                const capacityLabel = (
                  ride.total_seats > 0
                  && ride.reserved_seats > ride.total_seats
                )
                  ? `Over capacity: ${ride.reserved_seats} reservations for ${ride.total_seats} places`
                  : '';
                const isFull = (
                  ride.total_seats > 0
                  && ride.reserved_seats === ride.total_seats
                );
                return (
                  <button
                    type="button"
                    key={`unassigned-${ride.id}`}
                    className={`timeline-block assignment unassigned-ride draggable-unassigned${ride.is_vip ? ' vip' : ''}${rideLayout.columnCount > 1 ? ' split-lane' : ''}${capacityLabel ? ' timeline-assignment-warning' : ''}${isFull ? ' timeline-assignment-full' : ''}`}
                    draggable
                    style={{
                      top: `${top}%`,
                      left: `calc(${rideLayout.column * rideWidth}% + 2px)`,
                      width: `calc(${rideWidth}% - 4px)`,
                      right: 'auto',
                    }}
                    aria-label={`${ride.route_label}, ${formatHour(departure)}`}
                    onClick={() => navigate(`/admin/rides/${ride.id}/passengers`)}
                    onMouseEnter={(event) => showRideInfo(ride.id, event.currentTarget)}
                    onMouseLeave={hideRideInfo}
                    onFocus={(event) => showRideInfo(ride.id, event.currentTarget)}
                    onBlur={hideRideInfo}
                    onDragStart={(event) => handleUnassignedRideDragStart(event, ride)}
                    onDragEnd={handleUnassignedRideDragEnd}
                  >
                    <span className="timeline-assignment-time">
                      {formatTime(departure)}
                    </span>
                    <span className="timeline-assignment-top-right">
                      {capacityLabel && (
                        <span
                          className="timeline-assignment-warning-badge"
                          aria-label={capacityLabel}
                          title={capacityLabel}
                        >
                          !
                        </span>
                      )}
                      <span className={`timeline-assignment-places${isFull ? ' full' : ''}`}>
                        {ride.reserved_seats}/{ride.total_seats}
                      </span>
                    </span>
                    <span className="timeline-assignment-route">
                      {ride.route_label}
                    </span>
                    <span className="timeline-assignment-meta">No driver assigned</span>
                  </button>
                );
              })}
              {unassignedRides.length === 0 && (
                <span className="timeline-empty-track">No unassigned rides</span>
              )}
            </div>

            {/* Driver columns */}
            {data.map((item) => (
              <div
                key={item.driver.id}
                className={[
                  'timeline-track',
                  draggedProgramItemId !== null
                    || draggedRideAssignment
                    || draggedUnassignedRide
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
                    {draggedUnassignedRide
                      ? 'Assign ride with default car'
                      : draggedRideAssignment
                      ? `${dragOverRideAction === 'add' ? 'Add driver' : 'Move ride'} with default car`
                      : draggedProgramItem && (
                        <>
                          Block {formatTime(new Date(draggedProgramItem.start_time))}
                          –{formatTime(new Date(draggedProgramItem.end_time))}
                        </>
                      )}
                  </div>
                )}
                <TimelineDayBands sections={daySections} />
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
                  const overlap = getAssignmentOverlapInfo(item, assign);
                  const overlapLabel = overlap.label;
                  const capacityLabel = (
                    assign.total_seats > 0
                    && assign.reserved_seats > assign.total_seats
                  )
                    ? `Over capacity: ${assign.reserved_seats} reservations for ${assign.total_seats} places`
                    : '';
                  const isFull = (
                    assign.total_seats > 0
                    && assign.reserved_seats === assign.total_seats
                  );
                  const warningLabel = [overlapLabel, capacityLabel].filter(Boolean).join('\n');
                  const assignmentLayout = laneLayouts.get(item.driver.id)?.get(`assignment-${assign.id}`) ?? {
                    column: 0,
                    columnCount: 1,
                  };
                  const assignmentWidth = 100 / assignmentLayout.columnCount;
                  const blockedIndentPx = overlap.overlapsBlockedPeriod ? 12 : 0;
                  return (
                    <button
                      type="button"
                      key={`assign-${assign.id}`}
                      className={`timeline-block assignment${assign.is_vip ? ' vip' : ''}${assign.has_departed ? ' departed' : ''}${!assign.has_departed ? ' draggable-assignment' : ''}${hoveredRideId === assign.ride_id ? ' same-ride-highlight' : ''}${warningLabel ? ' timeline-assignment-warning' : ''}${isFull ? ' timeline-assignment-full' : ''}${assignmentLayout.columnCount > 1 ? ' split-lane' : ''}`}
                      draggable={!assign.has_departed}
                      style={{
                        top: `${top}%`,
                        left: `calc(${assignmentLayout.column * assignmentWidth}% + ${2 + blockedIndentPx}px)`,
                        width: `calc(${assignmentWidth}% - ${4 + blockedIndentPx}px)`,
                        right: 'auto',
                      }}
                      aria-label={`${assign.route_label}, ${formatHour(departure)}`}
                      onClick={() => navigate(`/admin/rides/${assign.ride_id}/passengers`)}
                      onMouseEnter={(event) => showRideInfo(assign.ride_id, event.currentTarget)}
                      onMouseLeave={hideRideInfo}
                      onFocus={(event) => showRideInfo(assign.ride_id, event.currentTarget)}
                      onBlur={hideRideInfo}
                      onDragStart={(event) => handleAssignmentDragStart(
                        event,
                        assign,
                        item.driver.id,
                      )}
                      onDragEnd={handleAssignmentDragEnd}
                    >
                      <span className="timeline-assignment-time">{formatTime(departure)}</span>
                      <span className="timeline-assignment-top-right">
                        {warningLabel && (
                          <span
                            className="timeline-assignment-warning-badge"
                            aria-label={warningLabel}
                            title={warningLabel}
                          >
                            !
                          </span>
                        )}
                        <span className={`timeline-assignment-places${isFull ? ' full' : ''}`}>
                          {assign.reserved_seats}/{assign.total_seats}
                        </span>
                      </span>
                      <span className="timeline-assignment-route">
                        {assign.route_label}
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
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{
              backgroundColor: '#fff',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(220, 53, 69, 0.35) 3px, rgba(220, 53, 69, 0.35) 5px)',
              border: '2px dashed #dc3545',
            }}
          /> Overlap / conflict
        </span>
        <span className="legend-item">
          <span
            className="legend-swatch"
            style={{
              backgroundColor: '#d4edda',
              border: '2px solid #2f7d48',
            }}
          /> Full ride
        </span>
      </div>
    </div>
  );
}
