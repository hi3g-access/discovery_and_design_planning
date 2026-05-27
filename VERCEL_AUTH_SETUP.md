# Vercel Authentication Setup

Your Requirement Analyzer is now password-protected! 🔒

## Quick Setup (3 steps)

### 1. Set Environment Variables in Vercel

Go to your Vercel project:
- Open [vercel.com](https://vercel.com)
- Select your project: `discovery-and-design-planning`
- Go to **Settings** → **Environment Variables**
- Add these two variables:

| Name | Value | Environment |
|------|-------|-------------|
| `SITE_PASSWORD` | `your-secure-password` | Production, Preview, Development |
| `AUTH_SECRET` | `random-secret-token-123` | Production, Preview, Development |

**Tips for secure values:**
- `SITE_PASSWORD`: Choose a strong password (e.g., `Tr3@team2026!`)
- `AUTH_SECRET`: Generate a random string (e.g., use `openssl rand -hex 32`)

### 2. Deploy to Vercel

```bash
cd /Users/ekenstam002/Documents/requirement-analyzer
vercel --prod
```

Or push to your Git repository if you have automatic deployments enabled.

### 3. Share Password with Team

After deployment, share the `SITE_PASSWORD` with your team members via:
- Secure password manager
- Encrypted email
- Company chat (direct message)

## How It Works

- **Login page**: `/login.html` - Users enter the password
- **Authentication**: Password is verified via API route
- **Session**: Secure cookie stored for 30 days
- **Protection**: All pages require authentication except login

## Testing Locally

```bash
# Set environment variables locally
export SITE_PASSWORD="testpass123"
export AUTH_SECRET="test-secret"

# Run dev server
npm run dev

# Visit http://localhost:5177
# You'll be redirected to login page
```

## Security Features

✅ Password-protected access  
✅ Secure HTTP-only cookies  
✅ 30-day session expiration  
✅ Environment variable secrets  
✅ No hardcoded passwords  

## Changing the Password

1. Go to Vercel project settings
2. Update the `SITE_PASSWORD` variable
3. Redeploy (or wait for automatic redeployment)
4. All users will need to log in again with the new password

## Troubleshooting

**Can't log in after deployment?**
- Check that environment variables are set in Vercel
- Verify you're using the correct password
- Clear browser cookies and try again

**Getting redirect loops?**
- Clear browser cache
- Check browser console for errors
- Verify middleware.js was deployed

**Need to bypass temporarily?**
- Remove middleware.js and redeploy
- Or set `SITE_PASSWORD=""` (empty) to disable

## Team Access

To give someone access:
1. Share the `SITE_PASSWORD` with them
2. They visit your Vercel URL
3. They enter the password on the login page
4. They stay logged in for 30 days

## Alternative: Vercel Password Protection

If you have Vercel Pro/Team plan, you can also use built-in password protection:
1. Go to Project Settings → Deployment Protection
2. Enable "Password Protection"
3. Set a password

This is simpler but requires a paid plan.
