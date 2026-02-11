const API_BASE = '/api';

export interface AppConfig {
  title: string;
  favicon_url?: string;
  demo_site?: boolean;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.detail || 'Request failed');
    }

    // Handle 204 No Content responses (e.g., DELETE)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private async uploadRequest<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const headers: Record<string, string> = {};
    // No Content-Type header - browser sets multipart boundary automatically

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw error;
    }

    return response.json();
  }

  // Config endpoint
  async getConfig() {
    return this.request<AppConfig>('/config/');
  }

  // Auth endpoints
  async requestMagicLink(email: string) {
    return this.request<{ message: string }>('/auth/request-link/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyToken(token: string) {
    return this.request<{ user: import('../types').User; token: string }>(
      `/auth/verify/${token}/`
    );
  }

  async getCurrentUser() {
    return this.request<import('../types').User>('/auth/me/');
  }

  async logout() {
    return this.request<{ message: string }>('/auth/logout/', {
      method: 'POST',
    });
  }

  // Public endpoints
  async getPublicRides(params?: {
    origin?: number;
    destination?: number;
    date?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.origin) query.append('origin', params.origin.toString());
    if (params?.destination) query.append('destination', params.destination.toString());
    if (params?.date) query.append('date', params.date);
    const queryStr = query.toString();
    return this.request<import('../types').Ride[]>(
      `/rides/${queryStr ? `?${queryStr}` : ''}`
    );
  }

  async getRideDetail(rideId: number) {
    return this.request<import('../types').Ride>(`/rides/${rideId}/`);
  }

  async reserveRide(rideId: number, data: { email: string; name: string }) {
    return this.request<{
      message: string;
      reservation_id?: number;
      reservation?: import('../types').Reservation;
      expires_at?: string;
      auto_confirmed: boolean;
    }>(`/rides/${rideId}/reserve/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmReservation(token: string) {
    return this.request<{
      message: string;
      reservation: import('../types').Reservation;
      user?: import('../types').User;
      token?: string;
    }>(`/confirm/${token}/`);
  }

  // User endpoints (authenticated)
  async getMyReservations() {
    return this.request<import('../types').Reservation[]>('/my/reservations/');
  }

  async cancelMyReservation(id: number) {
    return this.request<{ message: string }>(`/my/reservations/${id}/cancel/`, {
      method: 'POST',
    });
  }

  async getLocations() {
    return this.request<import('../types').Location[]>('/locations/');
  }

  // Driver endpoints
  async getDriverRides() {
    return this.request<import('../types').Ride[]>('/driver/rides/');
  }

  async getDriverRideDetail(rideId: number) {
    return this.request<import('../types').Ride>(`/driver/rides/${rideId}/`);
  }

  async getDriverRidePassengers(rideId: number) {
    return this.request<import('../types').DriverPassenger[]>(`/driver/rides/${rideId}/passengers/`);
  }

  async markPassengerPresent(rideId: number, reservationId: number, isPresent: boolean) {
    return this.request<import('../types').DriverPassenger>(
      `/driver/rides/${rideId}/passengers/${reservationId}/present/`,
      {
        method: 'POST',
        body: JSON.stringify({ is_present: isPresent }),
      }
    );
  }

  async driverDepart(rideId: number) {
    return this.request<{ message: string; assignment: import('../types').RideAssignment }>(
      `/driver/rides/${rideId}/depart/`,
      {
        method: 'POST',
      }
    );
  }

  // Admin endpoints
  async adminGetCars() {
    return this.request<import('../types').Car[]>('/admin/cars/');
  }

  async adminCreateCar(data: { name: string; license_plate?: string; capacity: number; description?: string }) {
    return this.request<import('../types').Car>('/admin/cars/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateCar(id: number, data: Partial<import('../types').Car>) {
    return this.request<import('../types').Car>(`/admin/cars/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteCar(id: number) {
    return this.request<void>(`/admin/cars/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetLocations() {
    return this.request<import('../types').Location[]>('/admin/locations/');
  }

  async adminCreateLocation(data: Partial<import('../types').Location>) {
    return this.request<import('../types').Location>('/admin/locations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateLocation(id: number, data: Partial<import('../types').Location>) {
    return this.request<import('../types').Location>(`/admin/locations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteLocation(id: number) {
    return this.request<void>(`/admin/locations/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetTravelTimes() {
    return this.request<import('../types').TravelTime[]>('/admin/travel-times/');
  }

  async adminCreateTravelTime(data: { origin_id: number; destination_id: number; minutes: number }) {
    return this.request<import('../types').TravelTime>('/admin/travel-times/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateTravelTime(id: number, data: { origin_id?: number; destination_id?: number; minutes?: number }) {
    return this.request<import('../types').TravelTime>(`/admin/travel-times/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteTravelTime(id: number) {
    return this.request<void>(`/admin/travel-times/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetDriverAvailabilities(driverId?: number) {
    const query = driverId ? `?driver_id=${driverId}` : '';
    return this.request<import('../types').DriverAvailability[]>(`/admin/driver-availabilities/${query}`);
  }

  async adminCreateDriverAvailability(data: { driver_id: number; start_time: string; end_time: string }) {
    return this.request<import('../types').DriverAvailability>('/admin/driver-availabilities/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateDriverAvailability(id: number, data: { driver_id?: number; start_time?: string; end_time?: string }) {
    return this.request<import('../types').DriverAvailability>(`/admin/driver-availabilities/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteDriverAvailability(id: number) {
    return this.request<void>(`/admin/driver-availabilities/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetRides() {
    return this.request<import('../types').Ride[]>('/admin/rides/');
  }

  async adminCreateRide(data: {
    origin_id: number;
    destination_id: number;
    departure_time: string;
    is_vip: boolean;
  }) {
    return this.request<import('../types').Ride>('/admin/rides/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateRide(id: number, data: Partial<import('../types').Ride>) {
    return this.request<import('../types').Ride>(`/admin/rides/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteRide(id: number) {
    return this.request<void>(`/admin/rides/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminImportRidesCsv(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.uploadRequest<import('../types').CsvImportSuccess>(
      '/admin/rides/import-csv/',
      formData
    );
  }

  async adminGetRidePassengers(rideId: number) {
    return this.request<import('../types').Passenger[]>(`/admin/rides/${rideId}/passengers/`);
  }

  async adminAddPassenger(rideId: number, data: { name: string; email?: string; phone?: string }) {
    return this.request<import('../types').Passenger>(`/admin/rides/${rideId}/add_passenger/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminRemovePassenger(rideId: number, reservationId: number) {
    return this.request<void>(`/admin/rides/${rideId}/passengers/${reservationId}/`, {
      method: 'DELETE',
    });
  }

  async adminGetRideAssignments(rideId: number) {
    return this.request<import('../types').RideAssignment[]>(`/admin/rides/${rideId}/assignments/`);
  }

  async adminAddRideAssignment(rideId: number, driverId: number, carId: number) {
    return this.request<import('../types').RideAssignment>(`/admin/rides/${rideId}/assignments/`, {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId, car_id: carId }),
    });
  }

  async adminRemoveRideAssignment(rideId: number, assignmentId: number) {
    return this.request<void>(`/admin/rides/${rideId}/assignments/${assignmentId}/`, {
      method: 'DELETE',
    });
  }

  async adminUndepartAssignment(rideId: number, assignmentId: number) {
    return this.request<import('../types').RideAssignment>(
      `/admin/rides/${rideId}/assignments/${assignmentId}/undepart/`,
      { method: 'POST' }
    );
  }

  async adminGetDrivers() {
    return this.request<import('../types').User[]>('/admin/drivers/');
  }

  async adminCreateDriver(data: { email: string; name: string; phone?: string; default_car_id?: number | null }) {
    return this.request<import('../types').User>('/admin/drivers/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateDriver(id: number, data: Partial<import('../types').User>) {
    return this.request<import('../types').User>(`/admin/drivers/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteDriver(id: number) {
    return this.request<void>(`/admin/drivers/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetUsers() {
    return this.request<import('../types').User[]>('/admin/users/');
  }

  async adminCreateUser(data: { email: string; name: string; role: string; phone?: string }) {
    return this.request<import('../types').User>('/admin/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminUpdateUser(id: number, data: Partial<import('../types').User>) {
    return this.request<import('../types').User>(`/admin/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteUser(id: number) {
    return this.request<void>(`/admin/users/${id}/`, {
      method: 'DELETE',
    });
  }

  async adminGetReservations() {
    return this.request<import('../types').Reservation[]>('/admin/reservations/');
  }

  async adminConfirmReservation(id: number) {
    return this.request<import('../types').Reservation>(`/admin/reservations/${id}/confirm/`, {
      method: 'POST',
    });
  }

  async adminCancelReservation(id: number) {
    return this.request<import('../types').Reservation>(`/admin/reservations/${id}/cancel/`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
