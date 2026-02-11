# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shuttle is a Festival Shuttle Management System - a web application for managing shuttle drivers at a festival, connecting festival grounds to sleeping locations.

### Core Features
- **Public ride booking**: Users browse rides and register (15-min reservation window, magic link email to confirm); rides visible until 15 min after departure unless all drivers left
- **VIP rides**: Admin-only management, not visible to public
- **Multiple drivers per ride**: Rides can have multiple driver/car assignments, capacity is sum of all cars
- **Driver portal**: Drivers see their schedule (with collapsible past rides), passenger lists with phone/WhatsApp links, other drivers on same ride, and can mark passengers present
- **Real-time presence tracking**: When one driver marks a passenger present, other drivers see yellow indicator
- **Phone number handling**: E.164 format with country code dropdown; saved to user profile for future bookings; clickable phone links with WhatsApp integration
- **Departure tracking**: Drivers indicate when leaving; registration closes when all departed or capacity exhausted; admin sees green (all departed) / yellow (partial) color coding
- **Admin overbooking**: Admins can book more passengers than available seats; overbooked rides show red in admin overview
- **Magic link auth**: Email-based passwordless authentication for all users
- **Role-based access**: public, driver, and admin roles

## Build and Development Commands

### Backend (Django)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver

# Run tests
python manage.py test

# Create superuser
python manage.py createsuperuser
```

### Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

### Docker

```bash
# Production (with MySQL)
docker-compose up --build

```

**Note:** All verification (tests, type checks, builds) must be run inside Docker containers, not locally:
```bash
# Run backend tests
docker compose -f docker-compose.dev.yml exec backend python manage.py test

# Type check frontend
docker compose -f docker-compose.dev.yml exec frontend npx tsc --noEmit
```

## Architecture

### Backend Structure
- `manage.py` - Django management script
- `config/` - Project settings and root URL configuration
- `accounts/` - Custom User model with magic link authentication
- `shuttle/` - Core app with Location, Car, Ride, Reservation, RideAssignment models
- `requirements.txt` - Python dependencies

### Frontend Structure
- `frontend/src/App.tsx` - Main app with routing
- `frontend/src/components/Layout.tsx` - App layout with navigation
- `frontend/src/context/AuthContext.tsx` - Authentication state management (includes refreshUser for profile updates)
- `frontend/src/components/PhoneInput.tsx` - Phone input with country code dropdown and PhoneLink component with WhatsApp
- `frontend/src/api/client.ts` - API client with all endpoint methods
- `frontend/src/types.ts` - TypeScript type definitions
- `frontend/src/pages/` - Page components organized by role:
  - Public: `Home.tsx`, `RideDetail.tsx`, `Confirm.tsx`, `Login.tsx`, `Verify.tsx`, `MyRides.tsx`
  - Driver: `driver/DriverDashboard.tsx`, `driver/DriverRideDetail.tsx`
  - Admin: `admin/AdminDashboard.tsx`, `admin/AdminRides.tsx`, `admin/AdminDrivers.tsx`, `admin/AdminCars.tsx`, `admin/AdminLocations.tsx`, `admin/AdminTravelTimes.tsx`, `admin/AdminDriverAvailability.tsx`, `admin/AdminReservations.tsx`, `admin/AdminUsers.tsx`, `admin/AdminRidePassengers.tsx`

## Data Models

### User (accounts/models.py)
- email (unique), name, role (public|driver|admin)
- phone (saved for all users on reservation), default_car (FK to Car, for drivers)
- magic_token, token_expires_at (for auth)

### DriverAvailability (accounts/models.py)
- driver (FK to User), start_time, end_time

### Location (shuttle/models.py)
- name, description

### TravelTime (shuttle/models.py)
- origin, destination (FK to Location)
- minutes (travel time between locations)

### Car (shuttle/models.py)
- name, license_plate, capacity, description

### Ride (shuttle/models.py)
- origin, destination (FK to Location)
- departure_time, is_vip
- Computed: available_seats, reserved_seats, remaining_capacity, registration_open, all_departed

### RideAssignment (shuttle/models.py)
- ride (FK), driver (FK to User), car (FK)
- has_departed, departed_at

### Reservation (shuttle/models.py)
- ride (FK), user (FK, nullable for pending)
- guest_email, guest_name, guest_phone
- status (pending|confirmed|cancelled)
- confirmation_token, expires_at
- marked_present_by (FK to User), is_present

## API Endpoints

### Public
- `GET /api/rides/` - List public rides with availability
- `GET /api/rides/{id}/` - Ride details
- `POST /api/rides/{id}/reserve/` - Create pending reservation (sends magic link)
- `GET /api/confirm/{token}/` - Confirm reservation via magic link
- `GET /api/locations/` - List locations

### Auth
- `POST /api/auth/request-link/` - Request magic link email
- `GET /api/auth/verify/{token}/` - Verify magic link, get auth token
- `GET /api/auth/me/` - Get current user
- `POST /api/auth/logout/` - Logout

### User (authenticated)
- `GET /api/my/reservations/` - User's reservations

### Driver
- `GET /api/driver/rides/` - Driver's assigned rides
- `GET /api/driver/rides/{id}/` - Ride details
- `GET /api/driver/rides/{id}/passengers/` - Passenger list
- `POST /api/driver/rides/{id}/passengers/{reservation_id}/present/` - Mark passenger present
- `POST /api/driver/rides/{id}/depart/` - Mark driver as departed

### Admin
- `GET/POST /api/admin/rides/` - CRUD rides
- `POST /api/admin/rides/import-csv/` - Bulk import rides from CSV file
- `GET/POST /api/admin/rides/{id}/assignments/` - Manage driver/car assignments
- `DELETE /api/admin/rides/{id}/assignments/{assignment_id}/`
- `GET /api/admin/rides/{id}/passengers/` - View passengers
- `POST /api/admin/rides/{id}/add_passenger/` - Add passenger manually
- `DELETE /api/admin/rides/{id}/passengers/{reservation_id}/` - Remove passenger
- `GET/POST/PATCH/DELETE /api/admin/drivers/` - CRUD drivers
- `GET/POST/PATCH/DELETE /api/admin/cars/` - CRUD cars
- `GET/POST/PATCH/DELETE /api/admin/locations/` - CRUD locations
- `GET/POST/PATCH/DELETE /api/admin/travel-times/` - CRUD travel times between locations
- `GET/POST/PATCH/DELETE /api/admin/driver-availabilities/` - CRUD driver availability schedules
- `GET/POST/PATCH/DELETE /api/admin/users/` - CRUD all users (role management)
- `GET /api/admin/reservations/` - All reservations
- `POST /api/admin/reservations/{id}/confirm/` - Confirm reservation
- `POST /api/admin/reservations/{id}/cancel/` - Cancel reservation

## Environment Variables

### Backend (config/settings.py)
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (default: True)
- `ALLOWED_HOSTS` - Comma-separated allowed hosts
- `DATABASE_URL` - Database connection string (default: SQLite)
  - PostgreSQL: `postgres://user:password@host:port/database`
  - MySQL: `mysql://user:password@host:port/database`
- `FRONTEND_URL` - Frontend URL for magic links (default: http://localhost:5173)
- `TIME_ZONE` - Set to `Europe/Brussels` for Belgian festival
- `ADMIN_EMAIL` - Email for initial admin user (created on startup if set)
- `ADMIN_NAME` - Name for initial admin user (default: Admin)

### Email (SMTP)
- `EMAIL_BACKEND` - Email backend (default: console)
- `EMAIL_HOST` - SMTP server
- `EMAIL_PORT` - SMTP port (default: 587)
- `EMAIL_HOST_USER` - SMTP username
- `EMAIL_HOST_PASSWORD` - SMTP password
- `EMAIL_USE_TLS` - Use TLS (default: True)
- `DEFAULT_FROM_EMAIL` - From address

## Docker Configuration

- `Dockerfile` - Backend Django image with gunicorn
- `frontend/Dockerfile` - Multi-stage frontend build with nginx
- `frontend/nginx.conf` - Nginx config for SPA routing and API proxy
- `docker-compose.yml` - Production setup with MySQL
- `docker-compose.dev.yml` - Development with hot reloading

# Todo
