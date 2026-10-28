import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Ride, Location, User, Car, RideAssignment, DriverAvailability, TravelTime, CsvImportSuccess, CsvImportError } from '../../types';

export function AdminRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stopIds, setStopIds] = useState<number[]>([]);
  const [nextStopId, setNextStopId] = useState('');
  const [draggedStopIndex, setDraggedStopIndex] = useState<number | null>(null);
  const [dropTargetStopIndex, setDropTargetStopIndex] = useState<number | null>(null);
  const [form, setForm] = useState({
    origin_id: '',
    destination_id: '',
    departure_time: '',
    is_vip: false,
  });

  // Assignment management state
  const [assignmentModal, setAssignmentModal] = useState<{
    rideId: number;
    rideName: string;
    departureTime: Date;
    originId: number;
    destinationId: number;
    stopIds: number[];
    assignments: RideAssignment[];
  } | null>(null);
  const [newAssignment, setNewAssignment] = useState({ driver_id: '', car_id: '' });
  const [showPastRides, setShowPastRides] = useState(false);
  const [driverAvailabilities, setDriverAvailabilities] = useState<DriverAvailability[]>([]);
  const [travelTimes, setTravelTimes] = useState<TravelTime[]>([]);
  const [trashRides, setTrashRides] = useState<Ride[]>([]);
  const [showTrash, setShowTrash] = useState(false);

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success?: CsvImportSuccess; error?: CsvImportError } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ridesData, locationsData, driversData, carsData, availabilities, travelTimesData, trashData] = await Promise.all([
        api.adminGetRides(),
        api.adminGetLocations(),
        api.adminGetDrivers(),
        api.adminGetCars(),
        api.adminGetDriverAvailabilities(),
        api.adminGetTravelTimes(),
        api.adminGetTrashRides(),
      ]);
      setRides(ridesData);
      setLocations(locationsData);
      setDrivers(driversData);
      setCars(carsData);
      setDriverAvailabilities(availabilities);
      setTravelTimes(travelTimesData);
      setTrashRides(trashData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const data = {
      stop_ids: stopIds,
      departure_time: form.departure_time,
      is_vip: form.is_vip,
    };

    try {
      if (editingId) {
        await api.adminUpdateRide(editingId, data);
      } else {
        await api.adminCreateRide(data);
      }
      loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save ride');
    }
  };

  const handleEdit = (ride: Ride) => {
    const dt = new Date(ride.departure_time);
    // Format as local datetime for the input (YYYY-MM-DDTHH:MM)
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const localDt = `${year}-${month}-${day}T${hours}:${minutes}`;

    setForm({
      origin_id: ride.origin.id.toString(),
      destination_id: ride.destination.id.toString(),
      departure_time: localDt,
      is_vip: ride.is_vip,
    });
    setStopIds(ride.stops.map((stop) => stop.location.id));
    setEditingId(ride.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Move this ride to trash?')) return;

    try {
      await api.adminDeleteRide(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ride');
    }
  };

  const resetForm = () => {
    setForm({
      origin_id: '',
      destination_id: '',
      departure_time: '',
      is_vip: false,
    });
    setEditingId(null);
    setStopIds([]);
    setNextStopId('');
    setDraggedStopIndex(null);
    setDropTargetStopIndex(null);
    setShowForm(false);
  };

  const reorderStops = (targetIndex: number) => {
    if (draggedStopIndex === null || draggedStopIndex === targetIndex) return;
    const isLoop = stopIds.length > 2 && stopIds[0] === stopIds[stopIds.length - 1];
    if (isLoop && (draggedStopIndex === stopIds.length - 1 || targetIndex === stopIds.length - 1)) return;

    const ordered = isLoop ? stopIds.slice(0, -1) : [...stopIds];
    const [movedStop] = ordered.splice(draggedStopIndex, 1);
    if (movedStop === undefined) return;
    ordered.splice(targetIndex, 0, movedStop);
    setStopIds(isLoop ? [...ordered, ordered[0]] : ordered);
    setDraggedStopIndex(null);
    setDropTargetStopIndex(null);
  };

  const removeStop = (index: number) => {
    const isLoop = stopIds.length > 2 && stopIds[0] === stopIds[stopIds.length - 1];
    if (isLoop && index < stopIds.length - 1) {
      const ordered = stopIds.slice(0, -1);
      ordered.splice(index, 1);
      setStopIds(ordered.length > 1 ? [...ordered, ordered[0]] : ordered);
      return;
    }
    setStopIds(stopIds.filter((_, stopIndex) => stopIndex !== index));
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const result = await api.adminImportRidesCsv(csvFile);
      setCsvResult({ success: result });
      loadData();
    } catch (err: unknown) {
      const csvError = err as CsvImportError;
      if (csvError.error || csvError.row_errors || csvError.group_errors) {
        setCsvResult({ error: csvError });
      } else {
        setCsvResult({ error: { error: 'Import failed' } });
      }
    } finally {
      setCsvImporting(false);
    }
  };

  const closeCsvImport = () => {
    setShowCsvImport(false);
    setCsvFile(null);
    setCsvResult(null);
  };

  const handleRestore = async (id: number) => {
    try {
      await api.adminRestoreRide(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore ride');
    }
  };

  const openAssignmentModal = (ride: Ride) => {
    setAssignmentModal({
      rideId: ride.id,
      rideName: ride.stops.map((stop) => stop.location.name).join(' → '),
      departureTime: new Date(ride.departure_time),
      originId: ride.origin.id,
      destinationId: ride.destination.id,
      stopIds: ride.stops.map((stop) => stop.location.id),
      assignments: ride.assignments || [],
    });
    setNewAssignment({ driver_id: '', car_id: '' });
  };

  const isDriverAvailable = (driverId: number, departureTime: Date) => {
    const driverSlots = driverAvailabilities.filter((a) => a.driver.id === driverId);
    if (driverSlots.length === 0) return false;
    return driverSlots.some((slot) => {
      const start = new Date(slot.start_time);
      const end = new Date(slot.end_time);
      return departureTime >= start && departureTime <= end;
    });
  };

  const getSortedDrivers = (departureTime: Date, existingAssignments: RideAssignment[]) => {
    const availableDrivers = drivers.filter(
      (d) =>
        !existingAssignments.some((a) => a.driver.id === d.id) &&
        isDriverAvailable(d.id, departureTime)
    );
    const unavailableDrivers = drivers.filter(
      (d) =>
        !existingAssignments.some((a) => a.driver.id === d.id) &&
        !isDriverAvailable(d.id, departureTime)
    );
    return { availableDrivers, unavailableDrivers };
  };

  // Get travel time between two locations in minutes
  const getTravelTime = (fromLocationId: number, toLocationId: number): number | null => {
    if (fromLocationId === toLocationId) return 0;
    const tt = travelTimes.find(
      (t) => t.origin.id === fromLocationId && t.destination.id === toLocationId
    );
    return tt ? tt.minutes : null;
  };

  // Returns true if a driver can finish this route and reach the next start in time.
  const ridesConflict = (
    firstTime: number, firstStopIds: number[],
    secondTime: number, secondOriginId: number,
  ): boolean => {
    const legTimes = firstStopIds.slice(0, -1).map((stopId, index) => getTravelTime(stopId, firstStopIds[index + 1]));
    if (legTimes.some((minutes) => minutes === null)) return false;
    const rideDuration = (legTimes as number[]).reduce((total, minutes) => total + minutes, 0);
    const firstDestId = firstStopIds[firstStopIds.length - 1];
    const travelToNext = getTravelTime(firstDestId, secondOriginId);
    const repositioning = travelToNext !== null ? travelToNext * 60 * 1000 : 0;
    return firstTime + rideDuration * 60 * 1000 + repositioning > secondTime;
  };

  // Check if a driver has a travel time conflict for a specific ride
  const hasDriverConflict = (driverId: number, rideToCheck: Ride): boolean => {
    const driverRides = rides.filter((r) =>
      r.assignments?.some((a) => a.driver.id === driverId)
    );

    if (driverRides.length === 0) return false;

    const rideTime = new Date(rideToCheck.departure_time).getTime();

    for (const otherRide of driverRides) {
      if (otherRide.id === rideToCheck.id) continue;

      const otherTime = new Date(otherRide.departure_time).getTime();

      if (otherTime < rideTime) {
        if (ridesConflict(otherTime, otherRide.stops.map((stop) => stop.location.id), rideTime, rideToCheck.origin.id))
          return true;
      } else {
        if (ridesConflict(rideTime, rideToCheck.stops.map((stop) => stop.location.id), otherTime, otherRide.origin.id))
          return true;
      }
    }

    return false;
  };

  // Check if a ride has any driver conflicts or unavailable drivers
  const hasRideConflict = (ride: Ride): boolean => {
    if (!ride.assignments || ride.assignments.length === 0) return false;
    const departureTime = new Date(ride.departure_time);
    return ride.assignments.some((a) =>
      hasDriverConflict(a.driver.id, ride) || !isDriverAvailable(a.driver.id, departureTime)
    );
  };

  // Check if adding a driver to a ride would cause a conflict
  const wouldDriverConflict = (driverId: number, targetRide: { departureTime: Date; originId: number; destinationId: number; stopIds: number[] }): boolean => {
    const driverRides = rides.filter((r) =>
      r.assignments?.some((a) => a.driver.id === driverId)
    );

    if (driverRides.length === 0) return false;

    const rideTime = targetRide.departureTime.getTime();

    for (const otherRide of driverRides) {
      const otherTime = new Date(otherRide.departure_time).getTime();

      if (otherTime < rideTime) {
        if (ridesConflict(otherTime, otherRide.stops.map((stop) => stop.location.id), rideTime, targetRide.originId))
          return true;
      } else {
        if (ridesConflict(rideTime, targetRide.stopIds, otherTime, otherRide.origin.id))
          return true;
      }
    }

    return false;
  };

  const handleAddAssignment = async () => {
    if (!assignmentModal || !newAssignment.driver_id || !newAssignment.car_id) return;

    try {
      const assignment = await api.adminAddRideAssignment(
        assignmentModal.rideId,
        parseInt(newAssignment.driver_id),
        parseInt(newAssignment.car_id)
      );
      setAssignmentModal({
        ...assignmentModal,
        assignments: [...assignmentModal.assignments, assignment],
      });
      setNewAssignment({ driver_id: '', car_id: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add assignment');
    }
  };

  const handleUndepartAssignment = async (assignmentId: number) => {
    if (!assignmentModal) return;

    try {
      const updated = await api.adminUndepartAssignment(assignmentModal.rideId, assignmentId);
      setAssignmentModal({
        ...assignmentModal,
        assignments: assignmentModal.assignments.map((a) =>
          a.id === assignmentId ? updated : a
        ),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unmark departure');
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!assignmentModal) return;

    try {
      await api.adminRemoveRideAssignment(assignmentModal.rideId, assignmentId);
      setAssignmentModal({
        ...assignmentModal,
        assignments: assignmentModal.assignments.filter((a) => a.id !== assignmentId),
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getDriverNames = (ride: Ride) => {
    if (!ride.assignments || ride.assignments.length === 0) {
      return 'No drivers';
    }
    return ride.assignments.map((a) => a.driver.name).join(', ');
  };

  const getDepartureStatus = (ride: Ride): 'all' | 'partial' | 'none' => {
    if (!ride.assignments || ride.assignments.length === 0) {
      return 'none';
    }
    const departedCount = ride.assignments.filter((a) => a.has_departed).length;
    if (departedCount === ride.assignments.length) {
      return 'all';
    }
    if (departedCount > 0) {
      return 'partial';
    }
    return 'none';
  };

  const isOverbooked = (ride: Ride) => {
    return ride.reserved_seats > ride.available_seats;
  };

  const hasNoDrivers = (ride: Ride) => {
    return !ride.assignments || ride.assignments.length === 0;
  };

  const getRowClass = (ride: Ride) => {
    if (isOverbooked(ride)) return 'ride-overbooked';
    if (hasRideConflict(ride)) return 'ride-conflict';
    const status = getDepartureStatus(ride);
    if (status === 'all') return 'ride-departed-all';
    if (status === 'partial') return 'ride-departed-partial';
    if (hasNoDrivers(ride)) return 'ride-no-driver';
    return '';
  };

  const getStopPlanIssues = (ids: number[]) => {
    const issues: string[] = [];
    if (ids.length < 2) {
      issues.push('Add at least two stops.');
      return issues;
    }

    const isLoop = ids.length > 2 && ids[0] === ids[ids.length - 1];
    const uniqueRoute = isLoop ? ids.slice(0, -1) : ids;
    if (new Set(uniqueRoute).size !== uniqueRoute.length) {
      issues.push('A location may appear only once, except the starting location as the final return stop.');
    }

    for (let index = 0; index < ids.length - 1; index += 1) {
      const fromId = ids[index];
      const toId = ids[index + 1];
      const configured = travelTimes.some((travelTime) => travelTime.origin.id === fromId && travelTime.destination.id === toId);
      if (!configured) {
        const fromName = locations.find((location) => location.id === fromId)?.name ?? `Location ${fromId}`;
        const toName = locations.find((location) => location.id === toId)?.name ?? `Location ${toId}`;
        issues.push(`Missing travel time from ${fromName} to ${toName}.`);
      }
    }
    return issues;
  };

  const currentStopPlanIssues = getStopPlanIssues(stopIds);

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  const upcomingRides = rides.filter((ride) => new Date(ride.departure_time) >= cutoffTime);
  const pastRides = rides.filter((ride) => new Date(ride.departure_time) < cutoffTime);

  // Sort upcoming rides by departure time (ascending)
  upcomingRides.sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
  // Sort past rides by departure time (descending - most recent first)
  pastRides.sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());

  const renderRideRow = (ride: Ride) => (
    <tr key={ride.id} className={getRowClass(ride)}>
      <td>
        {ride.stops.map((stop, index) => <span key={stop.position}>{index > 0 && ' → '}{stop.location.name}</span>)}
        {getStopPlanIssues(ride.stops.map((stop) => stop.location.id)).length > 0 && (
          <span
            className="ride-stop-plan-badge invalid"
            title={getStopPlanIssues(ride.stops.map((stop) => stop.location.id)).join(' ')}
          >Invalid plan</span>
        )}
      </td>
      <td>{formatTime(ride.departure_time)}</td>
      <td>{getDriverNames(ride)}</td>
      <td>
        {ride.reserved_seats}/{ride.available_seats}
      </td>
      <td>{ride.is_vip ? '👑' : ''}</td>
      <td>
        <button onClick={() => openAssignmentModal(ride)} className="btn btn-small">
          Drivers
        </button>
        <Link to={`/admin/rides/${ride.id}/passengers`} className="btn btn-small">
          Passengers
        </Link>
        <button onClick={() => handleEdit(ride)} className="btn btn-small">
          Edit
        </button>
        <button onClick={() => handleDelete(ride.id)} className="btn btn-small btn-danger">
          Delete
        </button>
      </td>
    </tr>
  );

  if (loading) {
    return <div className="loading">Loading rides...</div>;
  }

  return (
    <div className="admin-rides">
      <div className="page-header">
        <h1>Manage Rides</h1>
        <div>
          <button onClick={() => setShowCsvImport(true)} className="btn btn-secondary" style={{ marginRight: '0.5rem' }}>
            Import CSV
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn btn-primary">
            Add Ride
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showCsvImport && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Import Rides from CSV</h2>
            <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
              CSV format: <code>departure_time,origin,destination,driver_email,car_name,is_vip</code><br />
              Rows with the same departure time, origin, destination, and VIP status are merged into one ride with multiple driver/car assignments.
              Driver and car columns are optional.
            </p>
            <div className="form-group">
              <label htmlFor="csv-file">CSV File</label>
              <input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setCsvFile(e.target.files?.[0] || null);
                  setCsvResult(null);
                }}
              />
            </div>

            {csvResult?.success && (
              <div className="success" style={{ margin: '1rem 0', padding: '0.75rem', backgroundColor: '#d4edda', borderRadius: '4px' }}>
                Import successful: {csvResult.success.rides_created} ride(s) and {csvResult.success.assignments_created} assignment(s) created.
              </div>
            )}

            {csvResult?.error && (
              <div className="error" style={{ margin: '1rem 0' }}>
                {csvResult.error.error && <p>{csvResult.error.error}</p>}
                {csvResult.error.row_errors && (
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {csvResult.error.row_errors.map((re, i) => (
                      <li key={i}>
                        <strong>Row {re.row}:</strong> {re.errors.join('; ')}
                      </li>
                    ))}
                  </ul>
                )}
                {csvResult.error.group_errors && (
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {csvResult.error.group_errors.map((ge, i) => (
                      <li key={i}>{ge}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={closeCsvImport} className="btn btn-secondary">
                {csvResult?.success ? 'Close' : 'Cancel'}
              </button>
              {!csvResult?.success && (
                <button
                  type="button"
                  onClick={handleCsvImport}
                  className="btn btn-primary"
                  disabled={!csvFile || csvImporting}
                >
                  {csvImporting ? 'Importing...' : 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="color-legend">
        <span className="legend-item"><span className="legend-swatch" style={{ backgroundColor: '#d4edda' }} /> All departed</span>
        <span className="legend-item"><span className="legend-swatch" style={{ backgroundColor: '#fff3cd' }} /> Partially departed</span>
        <span className="legend-item"><span className="legend-swatch" style={{ backgroundColor: '#f8d7da' }} /> Overbooked</span>
        <span className="legend-item"><span className="legend-swatch" style={{ backgroundColor: '#ffe4b3' }} /> Driver conflict</span>
        <span className="legend-item"><span className="legend-swatch" style={{ backgroundColor: '#e2d6f3' }} /> No drivers assigned</span>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? 'Edit Ride' : 'Add Ride'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Ordered stops (select the start again at the end for a loop)</label>
                {currentStopPlanIssues.length > 0 && (
                  <div className="ride-stop-plan-status invalid" role="alert">
                    <strong>Invalid route plan</strong>
                    <ul>{currentStopPlanIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                  </div>
                )}
                <ol className="ride-stop-order-list">
                  {stopIds.map((id, index) => {
                    const isLoop = stopIds.length > 2 && stopIds[0] === stopIds[stopIds.length - 1];
                    const isReturnStop = isLoop && index === stopIds.length - 1;
                    return <li
                      key={`${index}-${id}`}
                      draggable={!isReturnStop}
                      className={dropTargetStopIndex === index ? 'ride-stop-drop-target' : undefined}
                      onDragStart={(event) => {
                        if (isReturnStop) return;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(index));
                        setDraggedStopIndex(index);
                      }}
                      onDragOver={(event) => {
                        if (draggedStopIndex === null || isReturnStop) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTargetStopIndex(index);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderStops(index);
                      }}
                      onDragEnd={() => {
                        setDraggedStopIndex(null);
                        setDropTargetStopIndex(null);
                      }}
                    >
                      <span className="ride-stop-drag-handle" aria-hidden="true">⠿</span>
                      <span className="ride-stop-name">{locations.find((loc) => loc.id === id)?.name ?? `Location ${id}`}{isReturnStop ? ' (return)' : ''}</span>
                      <button
                        type="button"
                        className="ride-stop-remove"
                        aria-label={`Remove ${isReturnStop ? 'return to ' : ''}${locations.find((loc) => loc.id === id)?.name ?? `location ${id}`}`}
                        title="Remove stop"
                        onClick={() => removeStop(index)}
                      >×</button>
                    </li>;
                  })}
                </ol>
                {stopIds.length > 1 && <small>Drag stops to change their order. The return stop stays at the end of a loop.</small>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={nextStopId} onChange={(e) => setNextStopId(e.target.value)}>
                    <option value="">Select next stop</option>
                    {locations.filter((loc) => !stopIds.includes(loc.id) || (stopIds.length >= 2 && loc.id === stopIds[0] && stopIds[stopIds.length - 1] !== stopIds[0])).map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary" disabled={!nextStopId} onClick={() => {
                    setStopIds([...stopIds, Number(nextStopId)]);
                    setNextStopId('');
                  }}>Add stop</button>
                </div>
                {stopIds.length === 0 && <p>Start by adding the first stop.</p>}
              </div>
              <div className="form-group">
                <label htmlFor="departure">Departure Time</label>
                <input
                  id="departure"
                  type="datetime-local"
                  value={form.departure_time}
                  onChange={(e) => setForm({ ...form, departure_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_vip}
                    onChange={(e) => setForm({ ...form, is_vip: e.target.checked })}
                  />
                  VIP Ride (hidden from public)
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={currentStopPlanIssues.length > 0}>
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignmentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Manage Drivers</h2>
            <p className="modal-subtitle">{assignmentModal.rideName}</p>

            <div className="assignments-list">
              {assignmentModal.assignments.length === 0 ? (
                <p className="text-muted">No drivers assigned yet.</p>
              ) : (
                assignmentModal.assignments.map((assignment) => (
                  <div key={assignment.id} className="assignment-item">
                    <span>
                      <strong>{assignment.driver.name}</strong> with{' '}
                      <strong>{assignment.car.name}</strong> ({assignment.car.capacity} seats)
                      {assignment.has_departed && (
                        <span className="departed-badge" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>Departed</span>
                      )}
                    </span>
                    <span>
                      {assignment.has_departed && (
                        <button
                          onClick={() => handleUndepartAssignment(assignment.id)}
                          className="btn btn-small btn-secondary"
                          style={{ marginRight: '0.25rem' }}
                        >
                          Undo Departure
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="btn btn-small btn-danger"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="add-assignment">
              <h3>Add Driver</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="assignment-driver">Driver</label>
                  <select
                    id="assignment-driver"
                    value={newAssignment.driver_id}
                    onChange={(e) => {
                      const driverId = e.target.value;
                      const driver = drivers.find((d) => d.id === parseInt(driverId));
                      const defaultCarId = driver?.default_car?.id;
                      // Auto-select default car if available and not already assigned
                      const carAlreadyAssigned = defaultCarId && assignmentModal.assignments.some(
                        (a) => a.car.id === defaultCarId
                      );
                      setNewAssignment({
                        driver_id: driverId,
                        car_id: defaultCarId && !carAlreadyAssigned ? defaultCarId.toString() : newAssignment.car_id,
                      });
                    }}
                  >
                    <option value="">Select driver</option>
                    {(() => {
                      const { availableDrivers, unavailableDrivers } = getSortedDrivers(
                        assignmentModal.departureTime,
                        assignmentModal.assignments
                      );
                      const targetRide = {
                        departureTime: assignmentModal.departureTime,
                        originId: assignmentModal.originId,
                        destinationId: assignmentModal.destinationId,
                        stopIds: assignmentModal.stopIds,
                      };
                      return (
                        <>
                          {availableDrivers.map((driver) => {
                            const hasConflict = wouldDriverConflict(driver.id, targetRide);
                            return (
                              <option
                                key={driver.id}
                                value={driver.id}
                                style={hasConflict ? { color: 'orange' } : undefined}
                              >
                                {hasConflict ? `⚠ ${driver.name}` : driver.name}
                              </option>
                            );
                          })}
                          {availableDrivers.length > 0 && unavailableDrivers.length > 0 && (
                            <option disabled>── Not available ──</option>
                          )}
                          {unavailableDrivers.map((driver) => {
                            const hasConflict = wouldDriverConflict(driver.id, targetRide);
                            return (
                              <option
                                key={driver.id}
                                value={driver.id}
                                style={hasConflict ? { color: 'orange' } : undefined}
                              >
                                {hasConflict ? `⚠ ${driver.name}` : driver.name}
                              </option>
                            );
                          })}
                        </>
                      );
                    })()}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="assignment-car">Car</label>
                  <select
                    id="assignment-car"
                    value={newAssignment.car_id}
                    onChange={(e) =>
                      setNewAssignment({ ...newAssignment, car_id: e.target.value })
                    }
                  >
                    <option value="">Select car</option>
                    {cars
                      .filter(
                        (c) => !assignmentModal.assignments.some((a) => a.car.id === c.id)
                      )
                      .map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.name} ({car.capacity} seats)
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddAssignment}
                  className="btn btn-primary"
                  disabled={!newAssignment.driver_id || !newAssignment.car_id}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setAssignmentModal(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>Upcoming Rides ({upcomingRides.length})</h2>
      {upcomingRides.length === 0 ? (
        <p>No upcoming rides.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Departure</th>
              <th>Drivers</th>
              <th>Seats</th>
              <th>VIP</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>{upcomingRides.map(renderRideRow)}</tbody>
        </table>
      )}

      {pastRides.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowPastRides(!showPastRides)}
          >
            <span>Past Rides ({pastRides.length})</span>
            <span className="collapse-icon">{showPastRides ? '▼' : '▶'}</span>
          </button>
          {showPastRides && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Drivers</th>
                  <th>Seats</th>
                  <th>VIP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{pastRides.map(renderRideRow)}</tbody>
            </table>
          )}
        </div>
      )}

      {trashRides.length > 0 && (
        <div className="past-rides-section">
          <button
            className="collapsible-header"
            onClick={() => setShowTrash(!showTrash)}
          >
            <span>🗑️ Trash ({trashRides.length})</span>
            <span className="collapse-icon">{showTrash ? '▼' : '▶'}</span>
          </button>
          {showTrash && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Drivers</th>
                  <th>Seats</th>
                  <th>VIP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trashRides.map((ride) => (
                  <tr key={ride.id} style={{ opacity: 0.6 }}>
      <td>{ride.stops.map((stop, index) => <span key={stop.position}>{index > 0 && ' → '}{stop.location.name}</span>)}</td>
                    <td>{formatTime(ride.departure_time)}</td>
                    <td>{getDriverNames(ride)}</td>
                    <td>{ride.reserved_seats}/{ride.available_seats}</td>
                    <td>{ride.is_vip ? '👑' : ''}</td>
                    <td>
                      <button onClick={() => handleRestore(ride.id)} className="btn btn-small btn-primary">
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
