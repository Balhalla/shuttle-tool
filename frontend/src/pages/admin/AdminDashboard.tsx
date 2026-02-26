import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface Stats {
  rides: number;
  drivers: number;
  cars: number;
  locations: number;
  travelTimes: number;
  driverAvailabilities: number;
  reservations: number;
  passengers: number;
  users: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ rides: 0, drivers: 0, cars: 0, locations: 0, travelTimes: 0, driverAvailabilities: 0, reservations: 0, passengers: 0, users: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [rides, drivers, cars, locations, travelTimes, driverAvailabilities, reservations, passengers, users] = await Promise.all([
        api.adminGetRides(),
        api.adminGetDrivers(),
        api.adminGetCars(),
        api.adminGetLocations(),
        api.adminGetTravelTimes(),
        api.adminGetDriverAvailabilities(),
        api.adminGetReservations(),
        api.adminGetPassengers(),
        api.adminGetUsers(),
      ]);
      setStats({
        rides: rides.length,
        drivers: drivers.length,
        cars: cars.length,
        locations: locations.length,
        travelTimes: travelTimes.length,
        driverAvailabilities: driverAvailabilities.length,
        reservations: reservations.length,
        passengers: passengers.length,
        users: users.length,
      });
    } catch {
      // Ignore errors for stats
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      <div className="stats-grid">
        <Link to="/admin/rides" className="stat-card">
          <span className="stat-value">{stats.rides}</span>
          <span className="stat-label">Rides</span>
        </Link>
        <Link to="/admin/drivers" className="stat-card">
          <span className="stat-value">{stats.drivers}</span>
          <span className="stat-label">Drivers</span>
        </Link>
        <Link to="/admin/cars" className="stat-card">
          <span className="stat-value">{stats.cars}</span>
          <span className="stat-label">Cars</span>
        </Link>
        <Link to="/admin/locations" className="stat-card">
          <span className="stat-value">{stats.locations}</span>
          <span className="stat-label">Locations</span>
        </Link>
        <Link to="/admin/travel-times" className="stat-card">
          <span className="stat-value">{stats.travelTimes}</span>
          <span className="stat-label">Travel Times</span>
        </Link>
        <Link to="/admin/driver-availability" className="stat-card">
          <span className="stat-value">{stats.driverAvailabilities}</span>
          <span className="stat-label">Availabilities</span>
        </Link>
        <Link to="/admin/reservations" className="stat-card">
          <span className="stat-value">{stats.reservations}</span>
          <span className="stat-label">Reservations</span>
        </Link>
        <Link to="/admin/passengers" className="stat-card">
          <span className="stat-value">{stats.passengers}</span>
          <span className="stat-label">Passengers</span>
        </Link>
        <Link to="/admin/users" className="stat-card">
          <span className="stat-value">{stats.users}</span>
          <span className="stat-label">Users</span>
        </Link>
      </div>

      <div className="admin-nav">
        <h2>Quick Actions</h2>
        <div className="admin-links">
          <Link to="/admin/rides" className="btn btn-primary">Manage Rides</Link>
          <Link to="/admin/drivers" className="btn btn-primary">Manage Drivers</Link>
          <Link to="/admin/cars" className="btn btn-primary">Manage Cars</Link>
          <Link to="/admin/locations" className="btn btn-primary">Manage Locations</Link>
          <Link to="/admin/travel-times" className="btn btn-primary">Travel Times</Link>
          <Link to="/admin/driver-availability" className="btn btn-primary">Driver Availability</Link>
          <Link to="/admin/driver-timeline" className="btn btn-primary">Availability Timeline</Link>
          <Link to="/admin/reservations" className="btn btn-primary">View Reservations</Link>
          <Link to="/admin/passengers" className="btn btn-primary">Passenger Overview</Link>
          <Link to="/admin/users" className="btn btn-primary">Manage Users</Link>
        </div>
      </div>
    </div>
  );
}
