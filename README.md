# Shuttle Management System

A Festival Shuttle Management System - a web application for managing shuttle drivers at a festival, connecting festival grounds to sleeping locations.

## Features

- **Public ride booking**: Users browse rides and register with magic link email confirmation
- **VIP rides**: Admin-only management, not visible to public
- **Multiple drivers per ride**: Rides can have multiple driver/car assignments
- **Driver portal**: Drivers see their schedule, passenger lists, and can mark passengers present
- **Real-time presence tracking**: When one driver marks a passenger present, other drivers see the update
- **Magic link authentication**: Email-based passwordless authentication
- **Role-based access**: public, driver, and admin roles

## Documentation

- **[Security Guidelines](SECURITY.md)** - Security features and deployment best practices
- **[Security Audit Report](SECURITY_AUDIT.md)** - Detailed security audit findings
- **[Claude Instructions](CLAUDE.md)** - Development guidance for AI assistants

## Quick Start

See [CLAUDE.md](CLAUDE.md) for detailed build and development commands.

### Production Deployment

1. Set required environment variables (see `.env.example`)
2. Ensure `DJANGO_SECRET_KEY` is set
3. Set `DJANGO_DEBUG=False`
4. Configure `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
5. Use HTTPS (security headers are automatically enabled in production)
6. Review [SECURITY.md](SECURITY.md) for complete checklist

### Development

```bash
# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Security

This application implements multiple security measures:
- Rate limiting on authentication and reservation endpoints
- Production security headers (HSTS, secure cookies, XSS protection)
- Token-based authentication with SHA-256 hashing
- Input validation and file upload restrictions
- CSRF protection

See [SECURITY.md](SECURITY.md) for complete security documentation.

## License

See LICENSE file for details.
