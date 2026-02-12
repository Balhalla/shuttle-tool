# Security Guidelines

## Overview

This document outlines the security measures implemented in the Shuttle Management System and provides guidelines for secure deployment and operation.

## Security Features Implemented

### 1. Authentication & Authorization

- **Magic Link Authentication**: Passwordless authentication using time-limited, one-time-use tokens
- **Token Security**: All tokens are hashed with SHA-256 before storage
- **High-Entropy Tokens**: Using `secrets.token_urlsafe(48)` for cryptographically secure random tokens
- **Session Management**: Separate session tokens for API authentication with configurable expiry
- **Role-Based Access Control**: Three roles (public, driver, admin) with appropriate permission checks
- **One-Time Use**: Magic links are invalidated after first use

### 2. Rate Limiting

The following endpoints are rate-limited to prevent abuse:

- **Magic Link Requests**: 5 requests per hour per IP (`/api/auth/request-link/`)
- **Token Verification**: 10 requests per hour per IP (`/api/auth/verify/{token}/`)
- **Ride Reservations**: 10 requests per hour per IP (`/api/rides/{id}/reserve/`)

### 3. Security Headers

Production deployments automatically enforce:

- **HTTPS Redirect**: All HTTP traffic redirected to HTTPS
- **HSTS**: HTTP Strict Transport Security with 1-year duration
- **Secure Cookies**: Session and CSRF cookies only sent over HTTPS
- **XSS Protection**: Browser XSS filter enabled
- **Content Type Sniffing Protection**: X-Content-Type-Options: nosniff
- **Clickjacking Protection**: X-Frame-Options: DENY

### 4. Input Validation & Sanitization

- **Email Validation**: All email inputs validated
- **SQL Injection Protection**: Django ORM used exclusively (no raw SQL)
- **XSS Protection**: Django template auto-escaping enabled
- **CSRF Protection**: Enabled for all state-changing operations
- **File Upload Validation**:
  - Maximum file size: 5MB for general uploads, 1MB for CSV imports
  - File type validation (CSV files only for imports)
  - Content encoding validation (UTF-8)

### 5. Database Security

- **Atomic Transactions**: Critical operations wrapped in transactions
- **Race Condition Prevention**: `select_for_update()` used for concurrent operations
- **Parameterized Queries**: All database queries use Django ORM
- **Connection Pooling**: Configured with `conn_max_age=600`

### 6. Secret Management

- **Environment Variables**: All secrets stored in environment variables
- **No Default Secrets in Production**: Application refuses to start without SECRET_KEY in production
- **Password Validators**: Django's password validation enabled for admin accounts

## Deployment Checklist

### Required Environment Variables

1. **DJANGO_SECRET_KEY** (Required in production)
   ```bash
   # Generate a secure secret key
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

2. **DJANGO_DEBUG** (Must be False in production)
   ```bash
   DJANGO_DEBUG=False
   ```

3. **DJANGO_ALLOWED_HOSTS** (Configure for your domain)
   ```bash
   DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
   ```

4. **CORS_ALLOWED_ORIGINS** (Configure for your frontend)
   ```bash
   CORS_ALLOWED_ORIGINS=https://yourdomain.com
   ```

5. **DATABASE_URL** (Use strong credentials)
   ```bash
   DATABASE_URL=mysql://user:strong_password@host:port/database
   # or
   DATABASE_URL=postgres://user:strong_password@host:port/database
   ```

6. **Email Configuration** (Choose one backend)
   ```bash
   # For SMTP
   EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_HOST_USER=your_email@example.com
   EMAIL_HOST_PASSWORD=your_secure_password
   EMAIL_USE_TLS=True
   DEFAULT_FROM_EMAIL=noreply@yourdomain.com
   ```

### HTTPS/TLS Configuration

The application automatically enables HTTPS-only security features when `DEBUG=False`:
- SSL redirect
- Secure cookies
- HSTS headers

Ensure your reverse proxy (nginx, Apache, etc.) is configured for HTTPS.

### Database Security

1. Use strong, unique passwords for database users
2. Limit database user permissions to only what's needed
3. Use SSL/TLS for database connections in production
4. Regular backups with encryption at rest

### Monitoring & Logging

1. Monitor failed authentication attempts
2. Set up alerts for unusual activity patterns
3. Regularly review access logs
4. Monitor rate limit violations

## Security Best Practices

### For Administrators

1. **Use Strong Passwords**: Even though magic links are used, admin accounts should have strong passwords
2. **Limit Admin Access**: Only grant admin role to trusted users
3. **Review User Roles**: Regularly audit user roles and permissions
4. **Monitor Reservations**: Watch for unusual reservation patterns
5. **Secure Email**: Ensure the email backend is properly configured and secure

### For Developers

1. **Never Commit Secrets**: Use `.env` files (git-ignored) for local development
2. **Keep Dependencies Updated**: Regularly update Django and other dependencies
3. **Review Security Audits**: Read `SECURITY_AUDIT.md` for known issues
4. **Test in Production-Like Environment**: Test with DEBUG=False before deploying
5. **Use HTTPS in Development**: Test HTTPS locally when possible

### For DevOps

1. **Use Secrets Management**: Store secrets in a secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
2. **Network Segmentation**: Isolate database from public internet
3. **Regular Updates**: Keep OS and dependencies patched
4. **Backup Strategy**: Implement regular, tested backups
5. **Firewall Rules**: Only expose necessary ports
6. **Rate Limiting at Reverse Proxy**: Consider additional rate limiting at nginx/Apache level

## Incident Response

If a security incident occurs:

1. **Immediate Actions**:
   - Rotate all secrets (SECRET_KEY, database passwords, API keys)
   - Review access logs for suspicious activity
   - Invalidate all session tokens if needed (clear `session_tokens` table)

2. **Investigation**:
   - Document the incident
   - Determine scope and impact
   - Identify root cause

3. **Recovery**:
   - Apply patches/fixes
   - Restore from backups if needed
   - Monitor for continued issues

4. **Post-Incident**:
   - Update security measures
   - Document lessons learned
   - Notify affected users if required

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to the repository owner
3. Include detailed information about the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Audit History

- **2026-02-12**: Initial comprehensive security audit performed (see `SECURITY_AUDIT.md`)
  - Implemented production security headers
  - Added rate limiting to authentication and reservation endpoints
  - Improved SECRET_KEY handling
  - Enhanced DEBUG mode security
  - Added file upload size limits
  - Improved CORS configuration

## Security Dependencies

The application uses the following security-focused packages:

- **django-cors-headers**: CORS protection
- **django-ratelimit**: Rate limiting for endpoints
- **gunicorn**: Production WSGI server with security features

## Additional Resources

- [Django Security Documentation](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)

## License

See LICENSE file for details.
