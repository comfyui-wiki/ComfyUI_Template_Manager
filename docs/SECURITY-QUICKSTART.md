# AI Translation Security Quick Configuration Guide

## 📝 TL;DR (Too Long; Didn't Read)

### Step 1: Add Yourself to Whitelist (Optional, Recommended)

Edit `config/i18n-config.json`:

```json
{
  "aiTranslation": {
    "security": {
      "whitelist": {
        "users": ["your-github-username"]
      }
    }
  }
}
```

### Step 2: Check Domain Configuration

Check your `.env` file, confirm `NEXTAUTH_URL` is correct:

```bash
# Development environment
NEXTAUTH_URL=http://localhost:3000/api/auth

# Production environment (modify when deploying)
NEXTAUTH_URL=https://yourdomain.com/api/auth
```

**The system will automatically extract the domain** from this URL, only allowing requests from that domain.

### Step 3: Restart Server

```bash
npm run dev
```

Done! ✅

---

## 🔒 Current Security Settings

| Security Measure | Status | Configuration |
|------------------|--------|---------------|
| **Rate Limiting** | ✅ Enabled | 20 requests per user per minute |
| **Origin Check** | ✅ Enabled | Automatically extracted from `NEXTAUTH_URL` |
| **User Authentication** | ✅ Required | GitHub login required |
| **Whitelist** | 📝 Needs Configuration | Whitelisted users have no limits |

---

## 🎯 Common Scenarios

### Scenario 1: I'm the Only User

```json
// config/i18n-config.json
{
  "aiTranslation": {
    "security": {
      "whitelist": {
        "users": ["your-username"]
      }
    }
  }
}
```

✅ You will have no restrictions

### Scenario 2: Me and a Few Collaborators

```json
{
  "aiTranslation": {
    "security": {
      "whitelist": {
        "users": ["your-username", "collaborator1", "collaborator2"]
      },
      "rateLimit": {
        "enabled": true,
        "maxRequestsPerMinute": 20
      }
    }
  }
}
```

✅ Whitelisted users have no limits, others get 20 requests per minute

### Scenario 3: Public Use, But Need to Control Costs

```json
{
  "aiTranslation": {
    "security": {
      "rateLimit": {
        "enabled": true,
        "maxRequestsPerMinute": 10  // Reduced to 10 requests
      }
    }
  }
}
```

✅ Everyone has limits, controlling API costs

### Scenario 4: Multiple Domains (Development + Production)

```json
{
  "aiTranslation": {
    "security": {
      "originCheck": {
        "enabled": true,
        "allowedOrigins": [
          "http://localhost:3000",
          "https://staging.yourdomain.com",
          "https://yourdomain.com"
        ]
      }
    }
  }
}
```

✅ Allows access from multiple domains

---

## 🚨 Quick Troubleshooting

### Problem: Translation keeps failing, showing "Rate limit exceeded"

**Reason**: You're not on the whitelist, exceeding 20 requests per minute

**Solution**: Add yourself to whitelist (see step 1 above)

---

### Problem: Shows "Request origin is not allowed"

**Reason**: Domain configuration is incorrect

**Solution**:
1. Check if `NEXTAUTH_URL` in `.env` is correct
2. Or add `allowedOrigins` in `config/i18n-config.json`

---

### Problem: Works fine locally, but doesn't work after deployment

**Reason**: Production environment's `NEXTAUTH_URL` is still `localhost`

**Solution**: Set the correct domain in production environment variables:
```bash
NEXTAUTH_URL=https://yourdomain.com/api/auth
```

---

## 📖 Complete Documentation

For detailed configuration instructions, see: [TODO-i18n-sync.md](./TODO-i18n-sync.md)

---

**Created Date**: 2026-01-18
