import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { RideDetail } from './pages/RideDetail';
import { Confirm } from './pages/Confirm';
import { Login } from './pages/Login';
import { Verify } from './pages/Verify';
import { MyRides } from './pages/MyRides';
import { DriverDashboard } from './pages/driver/DriverDashboard';
import { DriverRideDetail } from './pages/driver/DriverRideDetail';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminCars } from './pages/admin/AdminCars';
import { AdminLocations } from './pages/admin/AdminLocations';
import { AdminDrivers } from './pages/admin/AdminDrivers';
import { AdminRides } from './pages/admin/AdminRides';
import { AdminRidePassengers } from './pages/admin/AdminRidePassengers';
import { AdminReservations } from './pages/admin/AdminReservations';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminTravelTimes } from './pages/admin/AdminTravelTimes';
import { AdminDriverAvailability } from './pages/admin/AdminDriverAvailability';
import { AdminPassengers } from './pages/admin/AdminPassengers';
import './App.css';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public routes */}
        <Route index element={<Home />} />
        <Route path="ride/:rideId" element={<RideDetail />} />
        <Route path="confirm/:token" element={<Confirm />} />
        <Route path="login" element={<Login />} />
        <Route path="verify/:token" element={<Verify />} />

        {/* User routes (authenticated) */}
        <Route
          path="my-rides"
          element={
            <ProtectedRoute allowedRoles={['public', 'driver', 'admin']}>
              <MyRides />
            </ProtectedRoute>
          }
        />

        {/* Driver routes */}
        <Route
          path="driver"
          element={
            <ProtectedRoute allowedRoles={['driver', 'admin']}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/ride/:rideId"
          element={
            <ProtectedRoute allowedRoles={['driver', 'admin']}>
              <DriverRideDetail />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/cars"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCars />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/locations"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLocations />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/drivers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDrivers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/rides"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRides />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/rides/:rideId/passengers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminRidePassengers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reservations"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminReservations />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/travel-times"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTravelTimes />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/driver-availability"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDriverAvailability />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/passengers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPassengers />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
