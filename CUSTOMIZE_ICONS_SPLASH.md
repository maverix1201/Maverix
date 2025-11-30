# 🎨 How to Customize Icons & Splash Screens

## 📍 File Locations

### Icons
- **Source Icon**: `public/assets/maverixicon.png` (used to generate all icons)
- **Generated Icons**: `public/icons/`
  - `icon-192x192.png` - Android/Desktop icon (192x192px)
  - `icon-512x512.png` - Android/Desktop icon (512x512px)
  - `apple-icon-180x180.png` - iOS icon (180x180px)

### Splash Screens
- **Generated Splash Screens**: `public/icons/`
  - `splash-2048x2732.png` - iPad Pro 12.9"
  - `splash-1668x2388.png` - iPad Pro 11"
  - `splash-1536x2048.png` - iPad
  - `splash-1242x2688.png` - iPhone XS Max
  - `splash-1125x2436.png` - iPhone X/XS
  - `splash-828x1792.png` - iPhone XR
  - `splash-750x1334.png` - iPhone 8/7/6s/6
  - `splash-640x1136.png` - iPhone SE

### Configuration Files
- **Manifest**: `public/manifest.json` (app name, colors, etc.)
- **Layout**: `app/layout.tsx` (splash screen links)
- **Script**: `scripts/generate-icons.js` (generation settings)

---

## 🎯 Method 1: Edit Source Icon (Easiest)

### Step 1: Replace Source Icon

1. **Create your new icon** (recommended: 1024x1024px PNG)
   - Use design tools: Figma, Photoshop, Canva, etc.
   - Ensure it's square and centered
   - Save as PNG with transparency

2. **Replace the source file**:
   ```
   public/assets/maverixicon.png
   ```
   - Replace with your new icon
   - Keep the same filename: `maverixicon.png`

3. **Regenerate all icons**:
   ```bash
   npm run generate-icons
   ```

✅ **Done!** All icons and splash screens will be regenerated with your new design.

---

## 🎨 Method 2: Customize Splash Screen Colors

### Step 1: Edit the Generation Script

Open `scripts/generate-icons.js` and find this section (around line 88):

```javascript
background: { r: 99, g: 102, b: 241, alpha: 1 } // theme color #6366f1
```

### Step 2: Change Background Color

**Option A: Use RGB values**
```javascript
background: { r: 255, g: 0, b: 0, alpha: 1 } // Red background
```

**Option B: Use Hex color**
Convert hex to RGB:
- `#6366f1` = `r: 99, g: 102, b: 241`
- `#ffffff` = `r: 255, g: 255, b: 255`
- `#000000` = `r: 0, g: 0, b: 0`

**Option C: Use gradient** (requires more code)
See "Advanced Customization" section below.

### Step 3: Adjust Icon Size on Splash Screen

Find this line (around line 93):
```javascript
const iconSize = Math.floor(splash.height * 0.3); // 30% of screen height
```

Change the percentage:
- `0.2` = 20% (smaller icon)
- `0.3` = 30% (default)
- `0.4` = 40% (larger icon)
- `0.5` = 50% (very large icon)

### Step 4: Regenerate
```bash
npm run generate-icons
```

---

## 🖼️ Method 3: Edit Individual Files Directly

### For Icons

1. **Use image editing software**:
   - Photoshop, GIMP, Figma, Canva
   - Or online tools: Photopea, Remove.bg

2. **Edit the PNG files directly**:
   - `public/icons/icon-192x192.png`
   - `public/icons/icon-512x512.png`
   - `public/icons/apple-icon-180x180.png`

3. **Keep exact dimensions**:
   - Don't change the size
   - Keep PNG format
   - Maintain transparency if needed

### For Splash Screens

1. **Create custom splash screens**:
   - Use design software
   - Match exact dimensions (see sizes above)
   - Save as PNG

2. **Replace files**:
   - Replace files in `public/icons/`
   - Keep exact filenames
   - Keep exact dimensions

---

## 🎨 Method 4: Customize Manifest Colors

### Edit `public/manifest.json`

```json
{
  "background_color": "#ffffff",  // Splash screen background
  "theme_color": "#6366f1"        // Browser theme color
}
```

**Color Options:**
- `background_color`: Shown while app loads (splash screen)
- `theme_color`: Browser address bar color

**Update both:**
1. Edit `manifest.json`
2. Edit `scripts/generate-icons.js` (line 88) to match
3. Regenerate splash screens: `npm run generate-icons`

---

## 🚀 Quick Customization Examples

### Example 1: Change Splash Screen to White

1. **Edit `scripts/generate-icons.js`** (line 88):
   ```javascript
   background: { r: 255, g: 255, b: 255, alpha: 1 } // White
   ```

2. **Regenerate**:
   ```bash
   npm run generate-icons
   ```

### Example 2: Change Splash Screen to Black

1. **Edit `scripts/generate-icons.js`** (line 88):
   ```javascript
   background: { r: 0, g: 0, b: 0, alpha: 1 } // Black
   ```

2. **Regenerate**:
   ```bash
   npm run generate-icons
   ```

### Example 3: Make Icon Larger on Splash Screen

1. **Edit `scripts/generate-icons.js`** (line 93):
   ```javascript
   const iconSize = Math.floor(splash.height * 0.4); // 40% instead of 30%
   ```

2. **Regenerate**:
   ```bash
   npm run generate-icons
   ```

### Example 4: Change Theme Color to Blue

1. **Edit `public/manifest.json`**:
   ```json
   "theme_color": "#3b82f6"  // Blue-500
   ```

2. **Edit `app/layout.tsx`** (find theme-color meta tag):
   ```html
   <meta name="theme-color" content="#3b82f6" />
   ```

3. **Edit `scripts/generate-icons.js`** (line 88):
   ```javascript
   background: { r: 59, g: 130, b: 246, alpha: 1 } // #3b82f6
   ```

4. **Regenerate**:
   ```bash
   npm run generate-icons
   ```

---

## 🎨 Advanced Customization

### Create Gradient Splash Screen

Edit `scripts/generate-icons.js` to create gradients (requires more code):

```javascript
// Example: Create gradient background
const gradient = sharp({
  create: {
    width: splash.width,
    height: splash.height,
    channels: 4,
    background: { r: 99, g: 102, b: 241, alpha: 1 }
  }
});

// Add gradient overlay (you'll need to create a gradient image)
// Then composite it
```

### Add Text to Splash Screen

You can add text overlays using Sharp's text compositing:

```javascript
// Add text overlay
const text = await sharp({
  text: {
    text: 'MM HRM',
    font: 'Arial',
    fontSize: 100,
    width: splash.width,
    height: splash.height
  }
}).toBuffer();

await canvas
  .composite([
    { input: icon, top: ..., left: ... },
    { input: text, top: ..., left: ... }
  ])
  .png()
  .toFile(...);
```

---

## 🛠️ Tools for Creating Icons

### Free Tools
1. **Figma** - https://figma.com
   - Create icons and export as PNG
   - Free, web-based

2. **Canva** - https://canva.com
   - Easy icon creation
   - Templates available

3. **Photopea** - https://photopea.com
   - Free Photoshop alternative
   - Web-based

4. **GIMP** - https://gimp.org
   - Free desktop software
   - Full-featured

### Paid Tools
1. **Adobe Photoshop**
2. **Adobe Illustrator**
3. **Sketch** (Mac only)

### Online Icon Generators
1. **PWA Asset Generator** - https://github.com/elegantapp/pwa-asset-generator
2. **RealFaviconGenerator** - https://realfavicongenerator.net
3. **App Icon Generator** - https://appicon.co

---

## 📋 Step-by-Step: Complete Customization

### Scenario: You want a custom blue splash screen with larger icon

1. **Edit splash screen background**:
   ```bash
   # Open scripts/generate-icons.js
   # Find line 88, change to:
   background: { r: 59, g: 130, b: 246, alpha: 1 } // Blue
   ```

2. **Make icon larger**:
   ```bash
   # Find line 93, change to:
   const iconSize = Math.floor(splash.height * 0.4); // 40%
   ```

3. **Update manifest colors**:
   ```bash
   # Edit public/manifest.json
   "theme_color": "#3b82f6"
   "background_color": "#3b82f6"
   ```

4. **Update layout theme color**:
   ```bash
   # Edit app/layout.tsx
   # Find theme-color meta tag, change to:
   <meta name="theme-color" content="#3b82f6" />
   ```

5. **Regenerate everything**:
   ```bash
   npm run generate-icons
   ```

6. **Test**:
   ```bash
   npm run dev
   # Install app and check splash screen
   ```

---

## ✅ Checklist After Customization

- [ ] Icons regenerated successfully
- [ ] Splash screens regenerated successfully
- [ ] Manifest colors updated
- [ ] Layout theme color updated
- [ ] Tested on Android device
- [ ] Tested on iOS device
- [ ] Splash screen shows correctly
- [ ] Icons display correctly

---

## 🔄 Regenerating Icons

**After any customization, always regenerate:**

```bash
npm run generate-icons
```

This will:
- ✅ Generate all icon sizes from source
- ✅ Generate all splash screens
- ✅ Use your custom colors/settings
- ✅ Overwrite old files

---

## 💡 Pro Tips

1. **Keep source icon high quality** (1024x1024px minimum)
2. **Use PNG format** for transparency support
3. **Test on real devices** after changes
4. **Clear browser cache** after regenerating
5. **Match colors** between manifest and splash screens
6. **Keep icons simple** - they're small on screens

---

## 🐛 Troubleshooting

### Icons look blurry?
- Use higher resolution source image (1024x1024px+)
- Ensure source is PNG, not JPG
- Check if icons are being scaled by browser

### Splash screen wrong color?
- Check `manifest.json` background_color
- Check `scripts/generate-icons.js` background color
- Regenerate: `npm run generate-icons`
- Clear browser cache

### Changes not showing?
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Uninstall and reinstall PWA
- Check file paths in manifest.json

---

## 📚 Related Files

- **Icon Generation Script**: `scripts/generate-icons.js`
- **Manifest**: `public/manifest.json`
- **Layout**: `app/layout.tsx`
- **Icons Directory**: `public/icons/`

---

**Need help?** Check the script comments or modify the generation logic in `scripts/generate-icons.js`!

