# PWA implementation status

## Delivered

- Developer-controlled web app manifest, theme, app name, description, attribution, and install icons.
- Automatic install prompt in normal browser mode, with native install support where available and iOS/browser-specific instructions elsewhere.
- Standalone display mode, service-worker registration, safe offline page, and no caching of authenticated API or tenant data.
- Android-style mobile dashboard shell with a fixed five-item bottom navigation and a full-menu sheet.
- Per-user Web Push subscriptions tied to the authenticated `userId` and `collegeId`.
- Durable push-delivery rows, a retrying worker, expired-subscription cleanup, a protected scheduler endpoint, deep-link validation, and foreground inbox refresh.
- Notification UI aligned with the stored `eventType`, `title`, and `body` fields, with unread badge refresh.
- College profile name and logo remain visible inside the portal but cannot alter the installed app identity.

## Owner-controlled configuration

Only the developer or deployment owner can change the PWA identity. Use the `NEXT_PUBLIC_PWA_*` and `NEXT_PUBLIC_DEVELOPER_NAME` variables documented in `.env.example`, and replace the generated files in `public/pwa/` for official artwork changes. There is no college-admin PWA customization route.

## Production requirements

1. Set the PWA identity before the production build.
2. Generate and store VAPID public/private keys and a monitored VAPID subject.
3. Apply the included Prisma migration through the existing deployment start command.
4. Run `npm run worker:push` as a separate Railway worker service.
5. Serve the site through HTTPS; service workers, installation, and Web Push require a secure production origin.

## Verification

- Prisma schema formatting, validation, client generation, and local migration: passed.
- TypeScript: passed.
- Unit tests: 22 passed.
- Production build: passed.
- Targeted ESLint for the new and changed PWA/push files: passed.
- Browser install prompt: verified in normal browser mode.
- Responsive dashboard and bottom navigation: verified at a 390 x 844 mobile viewport with no horizontal overflow.
- Responsive follow-up audit: verified Dashboard, Opportunities, Applications, Offers, Resumes, Network, Events, Profile, and Messages at phone, tablet, and desktop widths. Messages now switches between a one-pane mobile/tablet flow and a split desktop inbox; dialogs remain scrollable on short screens.
- The circular Next.js development indicator is disabled in local development and is never part of the production application.

The repository-wide lint command still reports pre-existing issues in unrelated legacy files. They are outside this PWA change and are not listed as passing.
