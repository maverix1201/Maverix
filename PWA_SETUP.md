# PWA Setup Guide - MM HRM

This document explains the complete PWA (Progressive Web App) setup for MM HRM.

## 📁 File Structure

```
public/
├── manifest.json              # PWA manifest file
├── sw.js                      # Service worker
├── offline.html               # Offline fallback page
└── icons/
    ├── icon-192x192.png       # Android/Desktop icon (192x192)
    ├── icon-512x512.png       # Android/Desktop icon (512x512)
    ├── apple-icon-180x180.png # iOS icon (180x180)
    └── splash-*.png           # iOS splash screens (various sizes)

components/
├── PWARegistration.tsx        # Service worker registration & update handling
└── PWAInstallPrompt.tsx       # Install prompt for Android/Desktop & iOS

lib/
└── indexedDB.ts               # IndexedDB utility for offline data storage

app/
├── layout.tsx                  # Updated with PWA meta tags
└── providers.tsx              # Integrated PWA components
```

## 🚀 Quick Start

### 1. Generate Icons

First, generate all required PNG icons from your existing icon:

```bash
# Install sharp (if not already installed)
npm install --save-dev sharp

# Generate icons
node scripts/generate-icons.js
```

This will create all required icon sizes and splash screens in `public/icons/`.

### 2. Build and Test

```bash
npm run build
npm start
```

### 3. Test PWA Features

1. **Install Prompt**: Open the app in Chrome/Edge on desktop or Android
2. **Service Worker**: Check DevTools > Application > Service Workers
3. **Offline Mode**: Go offline and refresh the page
4. **Update Notification**: Deploy a new version and check for update prompt

## 📱 Platform-Specific Behavior

### Android (Chrome/Edge/Brave)

- **Install**: Shows native "Add to Home Screen" prompt
- **Service Worker**: Full support with background sync
- **Offline**: Full offline capability
- **Updates**: Automatic update detection with user notification

### iOS Safari

- **Install**: Manual "Add to Home Screen" (instructions shown in app)
- **Service Worker**: Limited support (no background sync)
- **Offline**: Basic offline capability
- **Updates**: Manual refresh required

### Desktop (Chrome/Edge/Brave)

- **Install**: Shows install banner/prompt
- **Service Worker**: Full support
- **Offline**: Full offline capability
- **Updates**: Automatic update detection

## 🔧 How It Works

### Service Worker (`public/sw.js`)

**Cache Strategy:**
- **Static Assets**: Cache-first (HTML, CSS, JS, images)
- **API Routes**: Network-first with cache fallback
- **Navigation**: Cache-first with offline page fallback

**Versioning:**
- Cache version is stored in `CACHE_NAME` constant
- Update `CACHE_NAME` when deploying new version to force cache refresh
- Old caches are automatically deleted on activate

**Update Flow:**
1. New service worker is detected
2. User is notified via `PWARegistration` component
3. User clicks "Update Now"
4. Service worker skips waiting and activates
5. Page reloads with new version

### Install Prompts

**Android/Desktop (`PWAInstallPrompt.tsx`):**
- Listens for `beforeinstallprompt` event
- Shows custom install button
- Uses native `prompt()` method
- Remembers dismissal for 7 days

**iOS (`PWAInstallPrompt.tsx`):**
- Detects iOS user agent
- Shows custom instructions modal
- Guides user through "Add to Home Screen" process

### Offline Mode

**Cached Assets:**
- Static files (HTML, CSS, JS)
- Images and fonts
- Manifest and icons
- Offline fallback page

**Offline Behavior:**
- Navigation requests show offline page
- Cached API responses are served
- New API requests fail gracefully

### IndexedDB (`lib/indexedDB.ts`)

**Purpose:** Store data offline for HRM features

**Stores:**
- `attendance`: Attendance records
- `leaves`: Leave requests
- `notifications`: User notifications
- `cache`: General cache

**Usage:**
```typescript
import { initDB, addData, getData } from '@/lib/indexedDB';

// Initialize
await initDB();

// Add data
await addData('attendance', { id: '1', date: '2024-01-01' });

// Get data
const data = await getData('attendance', '1');
```

## 🔄 Update Process

### Manual Update (Recommended)

1. **Update Cache Version:**
   ```javascript
   // In public/sw.js
   const CACHE_NAME = 'mm-hrm-v1.0.1'; // Increment version
   ```

2. **Deploy:**
   ```bash
   npm run build
   # Deploy to your server
   ```

3. **User Experience:**
   - User sees "Update Available" notification
   - Clicks "Update Now"
   - App reloads with new version

### Automatic Update Detection

The service worker automatically checks for updates:
- On page load
- Every 24 hours (via browser)
- When user navigates between pages

## 📊 Lighthouse Checklist

To achieve 100/100 PWA score:

✅ **Installable**
- Valid manifest.json
- Service worker registered
- HTTPS (required for production)
- Icons provided (192x192, 512x512)

✅ **PWA Optimized**
- Offline page provided
- Fast load time
- Responsive design
- Proper viewport meta tag

✅ **Best Practices**
- No console errors
- Valid HTML
- Proper meta tags
- Accessible

## 🐛 Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Ensure HTTPS (or localhost)
3. Check `sw.js` file exists in `public/`
4. Verify scope matches (`/`)

### Icons Not Showing

1. Ensure PNG files exist in `public/icons/`
2. Check `manifest.json` paths are correct
3. Clear browser cache
4. Regenerate icons using script

### Install Prompt Not Showing

1. **Android/Desktop**: Must meet installability criteria
2. **iOS**: Show manual instructions (automatic in app)
3. Check if already installed (standalone mode)
4. Clear browser data and try again

### Updates Not Detecting

1. Ensure `CACHE_NAME` is updated
2. Check service worker is active
3. Force refresh (Ctrl+Shift+R)
4. Unregister old service worker in DevTools

## 🔐 Production Checklist

Before deploying to production:

- [ ] Generate all icon sizes
- [ ] Update `CACHE_NAME` in `sw.js`
- [ ] Test install prompt on Android
- [ ] Test iOS "Add to Home Screen"
- [ ] Test offline mode
- [ ] Test update notification
- [ ] Run Lighthouse audit (target 100/100)
- [ ] Ensure HTTPS is enabled
- [ ] Test on real devices (Android & iOS)

## 📝 Notes

- **iOS Limitations**: Service workers have limited functionality on iOS
- **Cache Strategy**: Adjust in `sw.js` based on your needs
- **Icon Generation**: Use the provided script or create manually
- **Splash Screens**: Customize colors in `generate-icons.js`

## 🆘 Support

For issues or questions:
1. Check browser console for errors
2. Review service worker logs in DevTools
3. Test in incognito mode (clears cache)
4. Check Lighthouse audit for specific issues

