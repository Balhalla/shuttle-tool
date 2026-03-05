# Security Audit Report

## Executive Summary

This document contains the findings from a comprehensive security audit of the Shuttle Management System codebase performed on 2026-02-12.

## Critical Issues

### 1. Missing Production Security Headers

**Severity:** High  
**Location:** `config/settings.py`  
**Issue:** Production security headers are not configured, leaving the application vulnerable to various attacks.

**Missing Headers:**
- `SECURE_SSL_REDIRECT` - Not enforcing HTTPS
- `SESSION_COOKIE_SECURE` - Session cookies can be sent over HTTP
- `CSRF_COOKIE_SECURE` - CSRF cookies can be sent over HTTP
- `SECURE_HSTS_SECONDS` - No HTTP Strict Transport Security
- `SECURE_CONTENT_TYPE_NOSNIFF` - Missing content type protection
- `SECURE_BROWSER_XSS_FILTER` - Missing XSS filter header

**Impact:** Session hijacking, man-in-the-middle attacks, XSS attacks

**Recommendation:** Add security headers for production environments

---

### 2. DEBUG Mode Defaults to True

**Severity:** High  
**Location:** `config/settings.py` line 24  
**Issue:** DEBUG mode defaults to 'True' which can expose sensitive information in production.

```python
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'
```

**Impact:** Exposes stack traces, settings, and sensitive data to users

**Recommendation:** Default to False for security

---

## High Severity Issues

### 3. Weak Default SECRET_KEY

**Severity:** High  
**Location:** `config/settings.py` lines 12-21  
**Issue:** While there is a warning, the fallback secret key is weak and predictable.

**Current Code:**
```python
if not _secret_key:
    warnings.warn('DJANGO_SECRET_KEY not set! Using insecure default...')
    _secret_key = 'insecure-dev-key-only-for-local-development'
```

**Impact:** Session forgery, CSRF token bypass if deployed without proper configuration

**Recommendation:** Fail hard in production when SECRET_KEY is not set, or generate a random one

---

### 4. Rate Limiting Not Implemented

**Severity:** High  
**Location:** Authentication endpoints (`accounts/views.py`)  
**Issue:** No rate limiting on critical endpoints like magic link generation and token verification

**Affected Endpoints:**
- `/api/auth/request-link/` - Can be abused for email spam
- `/api/auth/verify/{token}/` - Can be brute-forced
- `/api/rides/{id}/reserve/` - Can be abused to spam users

**Impact:** Email flooding, brute force attacks, DoS

**Recommendation:** Implement rate limiting using Django Ratelimit or similar

---

## Medium Severity Issues

### 5. No Password Complexity Enforcement for Superusers

**Severity:** Medium  
**Location:** `accounts/models.py`  
**Issue:** While the app uses magic links, superusers created via Django admin can have weak passwords

**Impact:** Admin account compromise

**Recommendation:** Document password requirements for admin accounts

---

### 6. Missing Input Validation on Phone Numbers

**Severity:** Medium  
**Location:** Various serializers and models  
**Issue:** Phone numbers are stored as CharField with max_length=20 but no format validation

**Impact:** Inconsistent data, potential injection if phone is displayed in contexts expecting E.164 format

**Recommendation:** Add phone number validation using a library like phonenumbers

---

### 7. Email Enumeration Vulnerability

**Severity:** Medium  
**Location:** `accounts/views.py` line 28-29  
**Issue:** While the endpoint tries to hide user existence, timing attacks can reveal if email exists

```python
try:
    user = User.objects.get(email=email)
except User.DoesNotExist:
    # Don't reveal if user exists or not
    return Response({'message': 'If this email exists, a magic link has been sent.'})
```

**Impact:** Attackers can enumerate valid email addresses through timing analysis

**Recommendation:** Always perform the same operations (including fake email sending or timing delays) regardless of whether user exists

---

### 8. CORS Configuration Too Permissive by Default

**Severity:** Medium  
**Location:** `config/settings.py` lines 103-107  
**Issue:** Default CORS allows localhost origins which should not be in production

```python
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://localhost:5173,http://localhost'
).split(',')
```

**Impact:** Development origins may be accidentally exposed in production

**Recommendation:** Use empty default and require explicit configuration

---

### 9. CSV Import Allows Arbitrary File Processing

**Severity:** Medium  
**Location:** `shuttle/views.py` lines 659-858  
**Issue:** CSV import accepts any file and processes it without size limits

**Impact:** Memory exhaustion DoS, processing time DoS

**Recommendation:** Add file size limits and CSV validation

---

### 10. No Request Size Limits

**Severity:** Medium  
**Location:** Global settings  
**Issue:** No `DATA_UPLOAD_MAX_MEMORY_SIZE` or `FILE_UPLOAD_MAX_MEMORY_SIZE` configured

**Impact:** Memory exhaustion attacks

**Recommendation:** Set reasonable limits in settings.py

---

## Low Severity Issues

### 11. Discord Webhook URL in Environment Variables

**Severity:** Low  
**Location:** `.env.example`  
**Issue:** Webhook URL is stored in plaintext environment variable

**Impact:** If .env is committed, webhook can be abused

**Recommendation:** Document security of webhook URLs, consider using Discord bot tokens instead

---

### 12. Missing Security Logging

**Severity:** Low  
**Location:** Throughout application  
**Issue:** No logging of security events like failed login attempts, permission denials

**Impact:** Difficult to detect and respond to attacks

**Recommendation:** Add security event logging

---

### 13. Token Expiry Times Hardcoded

**Severity:** Low  
**Location:** `config/settings.py` lines 143-145  
**Issue:** Security-related timeouts are hardcoded and not configurable

**Impact:** Cannot adjust security posture without code changes

**Recommendation:** Make these environment variables

---

### 14. No Account Lockout Mechanism

**Severity:** Low  
**Location:** Authentication system  
**Issue:** No mechanism to lock accounts after repeated failures

**Impact:** Brute force attacks possible

**Recommendation:** Track failed attempts and implement temporary lockouts

---

## Positive Security Practices Found

1. ✅ Tokens are hashed before storage using SHA-256
2. ✅ Tokens use `secrets.token_urlsafe(48)` for high entropy
3. ✅ Magic links are one-time use only
4. ✅ Atomic transactions used for critical operations
5. ✅ `select_for_update()` used to prevent race conditions
6. ✅ CSRF protection enabled
7. ✅ Parameterized queries used (Django ORM)
8. ✅ No use of `eval()`, `exec()`, or `dangerouslySetInnerHTML`
9. ✅ Permission classes properly configured on viewsets
10. ✅ Email validation on user input

---

## Recommendations Priority

**Immediate (Critical):**
1. Add production security headers
2. Change DEBUG default to False
3. Implement rate limiting on authentication endpoints

**Short-term (High):**
4. Improve SECRET_KEY handling
5. Add CSV file size limits
6. Configure request size limits

**Medium-term (Medium):**
7. Add phone number validation
8. Fix email enumeration timing
9. Improve CORS configuration
10. Add input validation for all user inputs

**Long-term (Low):**
11. Add comprehensive security logging
12. Implement account lockout
13. Make security timeouts configurable

---

## Compliance Notes

- **GDPR:** User data handling appears compliant, personal data is properly scoped
- **OWASP Top 10:** Most items addressed, needs rate limiting and security headers
- **Security Headers:** Missing several recommended headers

---

## Conclusion

The application follows many Django security best practices, particularly in authentication and database access. However, several production-readiness issues need to be addressed before deployment, particularly around security headers, rate limiting, and configuration hardening.

The most critical issues to address immediately are:
1. Production security headers
2. DEBUG mode default
3. Rate limiting
4. SECRET_KEY handling

