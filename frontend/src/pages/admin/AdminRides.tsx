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
    assignments: RideAssignment[];
  } | null>(null);
  const [newAssignment, setNewAssignment] = useState({ driver_id: '', car_id: '' });
  const [showPastRides, setShowPastRides] = useState(false);
  const [driverAvailabilities, setDriverAvailabilities] = useState<DriverAvailability[]>([]);
  const [travelTimes, setTravelTimes] = useState<TravelTime[]>([]);

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
      const [ridesData, locationsData, driversData, carsData, availabilities, travelTimesData] = await Promise.all([
        api.adminGetRides(),
        api.adminGetLocations(),
        api.adminGetDrivers(),
        api.adminGetCars(),
        api.adminGetDriverAvailabilities(),
        api.adminGetTravelTimes(),
      ]);
      setRides(ridesData);
      setLocations(locationsData);
      setDrivers(driversData);
      setCars(carsData);
      setDriverAvailabilities(availabilities);
      setTravelTimes(travelTimesData);
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
      origin_id: parseInt(form.origin_id),
      destination_id: parseInt(form.destination_id),
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
    setEditingId(ride.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ride?')) return;

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
    setShowForm(false);
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

  const openAssignmentModal = (ride: Ride) => {
    setAssignmentModal({
      rideId: ride.id,
      rideName: `${ride.origin.name} → ${ride.destination.name}`,
      departureTime: new Date(ride.departure_time),
      originId: ride.origin.id,
      destinationId: ride.destination.id,
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

  // Check if a driver has a travel time conflict for a specific ride
  const hasDriverConflict = (driverId: number, rideToCheck: Ride): boolean => {
    // Get all rides assigned to this driver
    const driverRides = rides.filter((r) =>
      r.assignments?.some((a) => a.driver.id === driverId)
    );

    if (driverRides.length === 0) return false;

    const rideTime = new Date(rideToCheck.departure_time).getTime();

    for (const otherRide of driverRides) {
      if (otherRide.id === rideToCheck.id) continue;

      const otherTime = new Date(otherRide.departure_time).getTime();

      // Check if the rides are close enough in time to potentially conflict
      // Driver needs to: complete the first ride, then travel to the next ride's origin

      if (otherTime < rideTime) {
        // Other ride is before this ride
        // Driver departs otherRide at otherTime, arrives at destination after ride duration
        const rideDuration = getTravelTime(otherRide.origin.id, otherRide.destination.id);
        const travelToNext = getTravelTime(otherRide.destination.id, rideToCheck.origin.id);
        if (rideDuration !== null && travelToNext !== null) {
          const arrivalTime = otherTime + (rideDuration + travelToNext) * 60 * 1000;
          if (arrivalTime > rideTime) {
            return true; // Conflict: driver can't make it in time
          }
        }
      } else {
        // This ride is before other ride
        // Driver departs rideToCheck at rideTime, arrives at destination after ride duration
        const rideDuration = getTravelTime(rideToCheck.origin.id, rideToCheck.destination.id);
        const travelToNext = getTravelTime(rideToCheck.destination.id, otherRide.origin.id);
        if (rideDuration !== null && travelToNext !== null) {
          const arrivalTime = rideTime + (rideDuration + travelToNext) * 60 * 1000;
          if (arrivalTime > otherTime) {
            return true; // Conflict: driver can't make it in time
          }
        }
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
  const wouldDriverConflict = (driverId: number, targetRide: { departureTime: Date; originId: number; destinationId: number }): boolean => {
    // Get all rides assigned to this driver
    const driverRides = rides.filter((r) =>
      r.assignments?.some((a) => a.driver.id === driverId)
    );

    if (driverRides.length === 0) return false;

    const rideTime = targetRide.departureTime.getTime();

    for (const otherRide of driverRides) {
      const otherTime = new Date(otherRide.departure_time).getTime();

      if (otherTime < rideTime) {
        // Other ride is before target ride
        // Driver needs to complete otherRide, then travel to targetRide origin
        const rideDuration = getTravelTime(otherRide.origin.id, otherRide.destination.id);
        const travelToNext = getTravelTime(otherRide.destination.id, targetRide.originId);
        if (rideDuration !== null && travelToNext !== null) {
          const arrivalTime = otherTime + (rideDuration + travelToNext) * 60 * 1000;
          if (arrivalTime > rideTime) {
            return true;
          }
        }
      } else {
        // Target ride is before other ride
        // Driver needs to complete targetRide, then travel to otherRide origin
        const rideDuration = getTravelTime(targetRide.originId, targetRide.destinationId);
        const travelToNext = getTravelTime(targetRide.destinationId, otherRide.origin.id);
        if (rideDuration !== null && travelToNext !== null) {
          const arrivalTime = rideTime + (rideDuration + travelToNext) * 60 * 1000;
          if (arrivalTime > otherTime) {
            return true;
          }
        }
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
        {ride.origin.name} &rarr; {ride.destination.name}
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
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
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
                <label htmlFor="origin">Origin</label>
                <select
                  id="origin"
                  value={form.origin_id}
                  onChange={(e) => setForm({ ...form, origin_id: e.target.value })}
                  required
                >
                  <option value="">Select origin</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="destination">Destination</label>
                <select
                  id="destination"
                  value={form.destination_id}
                  onChange={(e) => setForm({ ...form, destination_id: e.target.value })}
                  required
                >
                  <option value="">Select destination</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
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
                <button type="submit" className="btn btn-primary">
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
    </div>
  );
}
