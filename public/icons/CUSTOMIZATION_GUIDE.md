# 🎨 Quick Customization Guide

## Edit Icons & Splash Screens

### Method 1: Edit Source Icon (Recommended)
1. Replace `public/assets/maverixicon.png` with your new icon
2. Run: `npm run generate-icons`
3. Done! ✅

### Method 2: Customize Colors & Sizes
1. Open `scripts/generate-icons.js`
2. Find the "CUSTOMIZATION SETTINGS" section (top of file)
3. Edit these values:
   ```javascript
   SPLASH_BACKGROUND_COLOR = { r: 99, g: 102, b: 241, alpha: 1 }; // RGB color
   SPLASH_ICON_SIZE_PERCENT = 0.3; // 30% of screen height
   ```
4. Run: `npm run generate-icons`

### Method 3: Edit Files Directly
- Edit PNG files in `public/icons/` directly
- Keep exact dimensions
- Use PNG format

## Color Reference

**Common Colors:**
- White: `{ r: 255, g: 255, b: 255, alpha: 1 }`
- Black: `{ r: 0, g: 0, b: 0, alpha: 1 }`
- Blue: `{ r: 59, g: 130, b: 246, alpha: 1 }` (#3b82f6)
- Indigo: `{ r: 99, g: 102, b: 241, alpha: 1 }` (#6366f1)
- Green: `{ r: 34, g: 197, b: 94, alpha: 1 }` (#22c55e)

**Convert Hex to RGB:**
- `#6366f1` → `r: 99, g: 102, b: 241`
- Use online converter: https://www.rapidtables.com/convert/color/hex-to-rgb.html

## After Customization

1. Regenerate: `npm run generate-icons`
2. Clear browser cache
3. Test on device

**Full Guide:** See `CUSTOMIZE_ICONS_SPLASH.md` in project root

