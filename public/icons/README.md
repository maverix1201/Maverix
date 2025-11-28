# PWA Icons

This directory contains all required PWA icons.

## Required Icons

### App Icons
- `icon-192x192.png` - Android/Desktop icon (192x192px)
- `icon-512x512.png` - Android/Desktop icon (512x512px)
- `apple-icon-180x180.png` - iOS icon (180x180px)

### iOS Splash Screens
- `splash-2048x2732.png` - iPad Pro 12.9"
- `splash-1668x2388.png` - iPad Pro 11"
- `splash-1536x2048.png` - iPad
- `splash-1242x2688.png` - iPhone XS Max
- `splash-1125x2436.png` - iPhone X/XS
- `splash-828x1792.png` - iPhone XR
- `splash-750x1334.png` - iPhone 8/7/6s/6
- `splash-640x1136.png` - iPhone SE

## Generating Icons

Run the icon generation script:

```bash
npm run generate-icons
```

This will generate all required PNG icons from `public/assets/maverixicon.png`.

## Manual Generation

If you prefer to create icons manually:

1. Use your design tool (Figma, Photoshop, etc.)
2. Export icons at the exact sizes listed above
3. Ensure icons are square and centered
4. Use PNG format with transparency
5. Place all files in this directory

## Temporary SVG Placeholders

SVG placeholder files are provided for development, but PNG files are required for production PWA functionality.

