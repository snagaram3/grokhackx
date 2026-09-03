# AI Agents Branch Deployment Guide

This guide explains how to deploy the AI Agents tracking feature as a separate Vercel deployment.

## Branch Information

- **Branch Name:** `cursor/ai-agents-tracking-2b43`
- **Feature:** AI Agents Intelligence tracking
- **Status:** Production-ready, separate from main

## Automatic Vercel Preview

Vercel automatically creates preview deployments for all branches:

1. Every push to `cursor/ai-agents-tracking-2b43` triggers a preview deployment
2. Access at: `grokhackx-git-cursor-ai-agents-tracking-2b43-[team].vercel.app`
3. Preview URL appears in:
   - GitHub PR checks
   - Vercel dashboard
   - Git push output

## Option 1: Dedicated Production Deployment (Recommended)

To host this branch as a separate production deployment:

### Via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import the same repository: `snagaram3/grokhackx`
4. Configure:
   - **Project Name:** `hawkxai-ai-agents` (or similar)
   - **Framework:** Next.js
   - **Root Directory:** `./`
   - **Git Branch:** `cursor/ai-agents-tracking-2b43`
5. Add Environment Variables (same as main deployment):
   - Copy all env vars from main production deployment
   - Or add individually: `TREND_DB_*`, `FLEET_URL`, etc.
6. Deploy

### Via Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to existing project or create new
vercel link

# Deploy this branch to production
vercel --prod
```

## Option 2: Branch as Production Target

Configure the existing project to deploy this branch:

1. Go to Project Settings → Git
2. Under "Production Branch" → Add another production branch
3. Add: `cursor/ai-agents-tracking-2b43`
4. Every push to this branch will deploy to production

## Option 3: Keep as Preview Only

The default preview deployment is fully functional:

- Automatic deployment on every push
- Full feature set available
- Shareable preview URL
- No additional configuration needed

## Environment Variables

Ensure these are set in Vercel for the AI Agents deployment:

```bash
# Database (optional, falls back to memory)
TREND_DB_HOST=
TREND_DB_PORT=5432
TREND_DB_USER=
TREND_DB_PASSWORD=
TREND_DB_SSL=true

# Fleet integration (optional)
FLEET_URL=

# Next.js
NODE_ENV=production
```

## Custom Domain (Optional)

To use a custom domain for the AI Agents branch:

1. Go to Project Settings → Domains
2. Add domain: `ai-agents.hawkxai.com` (or similar)
3. Configure DNS records as instructed
4. Vercel will issue SSL certificate automatically

## Monitoring

Monitor the deployment:

- **Vercel Dashboard:** Real-time logs and analytics
- **GitHub Actions:** CI/CD status (if configured)
- **Preview URL:** Test before promoting to production

## Merging to Main

When ready to merge into main:

1. Create PR: `cursor/ai-agents-tracking-2b43` → `main`
2. Review changes
3. Merge PR
4. Main production deployment auto-updates
5. Optionally delete dedicated AI Agents deployment

## Testing the Deployment

After deployment, verify:

1. Navigate to `/ai-agents` route
2. Check API endpoint: `/api/ai-agents`
3. Test filters: category, provider, trending
4. Verify agent details load correctly
5. Check insights generation
6. Test navigation to other desks

## Branch Maintenance

Keep this branch updated:

```bash
# Fetch latest from main
git checkout cursor/ai-agents-tracking-2b43
git fetch origin main
git merge origin/main

# Or rebase for clean history
git rebase origin/main

# Push updates
git push origin cursor/ai-agents-tracking-2b43
```

## Support

For Vercel deployment issues:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

For feature issues:
- See `docs/ai-agents/IMPROVISATIONS.md` for roadmap
- Check branch commits for latest changes
