# AI Translation Security Configuration Guide

## 🔒 Implemented Security Measures

### 1. Rate Limiting
- **Default Limit**: Each user can make up to **20** translation requests per minute
- **Whitelisted Users**: Unlimited

### 2. Origin/Referer Check
- Only allows requests from specified domains
- Prevents other websites from calling your API
- **Automatically gets allowed domains from environment variable `NEXTAUTH_URL`**
- Also allows manually specifying a list of allowed domains in the configuration file

### 3. User Authentication
- Must log in via GitHub to use translation functionality
- Uses user's GitHub username for rate limiting

---

## 🌐 Domain Configuration (Origin Check)

Origin check is used to prevent other websites from calling your API. The system automatically gets domains from environment variables, but you can also configure manually.

### Method 1: Using Environment Variables (Recommended, Automatic)

In your `.env` file, you already have this configuration:

```bash
NEXTAUTH_URL=http://localhost:3000/api/auth
```

The system will **automatically** extract the domain `http://localhost:3000` from this URL and only allow requests from this domain.

**Production Environment Example**:
```bash
NEXTAUTH_URL=https://yourdomain.com/api/auth
```

This way only requests from `https://yourdomain.com` will be allowed.

### Method 2: Manually Configure Allowed Domain List

If you need to allow multiple domains (such as supporting both production and testing environments), you can configure in `config/i18n-config.json`:

```json
{
  "aiTranslation": {
    "security": {
      "originCheck": {
        "enabled": true,
        "allowedOrigins": [
          "https://yourdomain.com",
          "https://staging.yourdomain.com",
          "http://localhost:3000"
        ]
      }
    }
  }
}
```

**Notes**:
- If `allowedOrigins` is an empty array `[]`, the system will automatically use `NEXTAUTH_URL`
- If `allowedOrigins` is configured, it will ignore `NEXTAUTH_URL` and only use the configured list
- Domains must include protocol (`http://` or `https://`)
- Do not add trailing slashes

### Completely Disable Origin Check (Not Recommended)

If you want to allow any domain to call (may be needed during development):

```json
"originCheck": {
  "enabled": false
}
```

⚠️ **Warning**: After disabling, any website can call your API. It's recommended to only use during local development.

---

## ⚙️ How to Add Whitelist Users (Unlimited)

### Method 1: Edit Configuration File (Recommended)

Edit the `config/i18n-config.json` file, add GitHub usernames to the `aiTranslation.security.whitelist.users` array:

```json
{
  "aiTranslation": {
    "security": {
      "whitelist": {
        "comment": "GitHub usernames that bypass all rate limits. Add your GitHub username here.",
        "users": [
          "your-github-username",
          "another-trusted-user"
        ]
      }
    }
  }
}
```

### Find Your GitHub Username

1. Log in to GitHub
2. Click the avatar in the upper right corner
3. Username is displayed in `@username` format (without `@` symbol)
4. Or visit `https://api.github.com/users/your-username` to view the `login` field

### Example

If your GitHub username is `linmoumou`, the configuration should be:

```json
"users": ["linmoumou"]
```

---

## 🛠️ Other Security Configuration Options

In `config/i18n-config.json`, you can adjust the following settings:

```json
{
  "aiTranslation": {
    "security": {
      "rateLimit": {
        "enabled": true,                    // Whether to enable rate limiting
        "maxRequestsPerMinute": 20          // Maximum requests per minute
      },
      "originCheck": {
        "enabled": true,                    // Whether to enable Origin check
        "allowedOrigins": []                // List of allowed domains (empty=use NEXTAUTH_URL)
      },
      "whitelist": {
        "users": []                         // List of whitelist users
      }
    }
  }
}
```

### Adjust Rate Limiting

If 20 requests per minute is not enough, you can modify `maxRequestsPerMinute`:

```json
"maxRequestsPerMinute": 50  // Change to 50 requests per minute
```

### Completely Disable Rate Limiting (Not Recommended)

```json
"rateLimit": {
  "enabled": false
}
```

⚠️ **Warning**: After disabling, any logged-in user can call unlimited times, which may cause API costs to skyrocket!

---

## 📊 View Logs

The server will record the following information:

```bash
# Domain configuration
[Rate Limiter] Using NEXTAUTH_URL as allowed origin: http://localhost:3000

# Whitelist user request
[Rate Limiter] User linmoumou is whitelisted, bypassing rate limit

# Regular user request
[Rate Limiter] User someuser request allowed (5/20, 15 remaining)

# Exceeded limit
[Rate Limiter] User someuser exceeded rate limit (20/20)

# Origin check passed
[Rate Limiter] Origin check passed: https://yourdomain.com

# Origin check failed
[Rate Limiter] Origin check failed: https://evil-site.com not in allowed list: ["https://yourdomain.com"]

# SSR request (no origin/referer)
[Rate Limiter] No origin/referer header (likely SSR), allowing request
```

---

## 🚨 Error Messages

Error messages users may encounter:

### 429 - Rate Limit Exceeded
```
Rate limit exceeded. Try again after 2024-01-18T10:30:00.000Z
```
**Solutions**:
- Wait 1 minute and try again
- Or add user to whitelist

### 403 - Forbidden
```
Request origin 'https://evil-site.com' is not allowed. Only requests from allowed domains are permitted.
```
**Solutions**:
- Confirm request comes from correct domain
- Check if `NEXTAUTH_URL` in `.env` file is correct
- Or add the domain to `allowedOrigins` in `config/i18n-config.json`
- Or disable Origin check (not recommended): `"originCheck": { "enabled": false }`

### 401 - Unauthorized
```
Unauthorized - Please sign in
```
**Solution**: User needs to log in to GitHub first

---

## 💡 Best Practices

1. **Add yourself to whitelist**: As administrator, you should join the whitelist to test without limitations
2. **Configure domain**: Ensure `NEXTAUTH_URL` in `.env` is set correctly (development and production environments)
3. **Monitor logs**: Regularly check logs to see if there are abnormal requests or Origin check failures
4. **Adjust limits appropriately**: Adjust `maxRequestsPerMinute` based on actual usage
5. **Protect environment variables**: Ensure `.env` file is not committed to Git (already in `.gitignore`)
6. **Regularly update whitelist**: Only add trusted users
7. **Production environment**: When deploying to production, remember to update `NEXTAUTH_URL` to the correct domain

---

## 🔧 Advanced: Only Allow Specific Users to Use Translation Feature

If you want to restrict that only whitelisted users can use the translation feature (others cannot use it at all), you can modify the code:

In `server/api/ai/translate/single.post.ts` and `batch.post.ts`, after the authentication check, add:

```typescript
// Only allow whitelisted users
const username = (session.user as any)?.login || (session.user as any)?.name || 'unknown'
if (!isWhitelisted(username)) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Translation feature is restricted to authorized users only.'
  })
}
```

This way only users in the whitelist can use the translation feature.

---

## 📝 Configuration File Locations

```
config/i18n-config.json          # Main configuration file (includes whitelist)
.env                              # DeepSeek API key (do not commit to Git)
server/utils/rate-limiter.ts     # Rate limiting logic
```

---

**Last Updated**: 2026-01-18
