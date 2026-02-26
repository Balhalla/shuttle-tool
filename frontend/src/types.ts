export interface Car {
  id: number;
  name: string;
  license_plate: string;
  capacity: number;
  description: string;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'public' | 'driver' | 'admin';
  phone?: string;
  default_car?: Car;
  created_at: string;
}

export interface Location {
  id: number;
  name: string;
  description: string;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
}

export interface TravelTime {
  id: number;
  origin: Location;
  origin_id?: number;
  destination: Location;
  destination_id?: number;
  minutes: number;
  created_at: string;
  updated_at: string;
}

export interface RideAssignment {
  id: number;
  driver: User;
  car: Car;
  has_departed: boolean;
  departed_at: string | null;
  created_at: string;
}

export interface Ride {
  id: number;
  origin: Location;
  origin_id?: number;
  destination: Location;
  destination_id?: number;
  departure_time: string;
  is_vip: boolean;
  assignments: RideAssignment[];
  available_seats: number;
  remaining_capacity: number;
  seats_remaining: number;
  reserved_seats: number;
  is_full: boolean;
  registration_open: boolean;
  all_departed?: boolean;
  created_at: string;
}

export interface Reservation {
  id: number;
  ride: Ride;
  user?: User;
  guest_email: string;
  guest_name: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  added_by_admin: boolean;
  is_present: boolean;
  created_at: string;
  expires_at?: string;
}

// Driver-visible passenger info (no email, but includes phone)
export interface DriverPassenger {
  id: number;
  name: string;
  phone: string;
  status: string;
  is_present: boolean;
  marked_present_by_id: number | null;
  created_at: string;
}

// Admin-visible passenger info (full details)
export interface Passenger {
  id: number;
  email: string;
  name: string;
  phone: string;
  status: string;
  added_by_admin: boolean;
  is_present: boolean;
  marked_present_by_id: number | null;
  created_at: string;
}

export interface DriverAvailability {
  id: number;
  driver: User;
  driver_id?: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CsvImportSuccess {
  rides_created: number;
  assignments_created: number;
}

export interface CsvImportRowError {
  row: number;
  errors: string[];
}

export interface CsvImportError {
  error?: string;
  row_errors?: CsvImportRowError[];
  group_errors?: string[];
}

export interface PassengerRide {
  reservation_id: number;
  ride_id: number;
  origin: string;
  destination: string;
  departure_time: string;
  status: string;
  is_vip: boolean;
}

export interface PassengerOverview {
  key: string;
  name: string;
  email: string;
  phone: string;
  rides: PassengerRide[];
}

export interface TimelineAvailability {
  id: number;
  start_time: string;
  end_time: string;
}

export interface TimelineAssignment {
  id: number;
  ride_id: number;
  origin: string;
  destination: string;
  departure_time: string;
  is_vip: boolean;
  car_name: string;
  has_departed: boolean;
}

export interface DriverTimeline {
  driver: {
    id: number;
    name: string;
    email: string;
  };
  availabilities: TimelineAvailability[];
  assignments: TimelineAssignment[];
}
