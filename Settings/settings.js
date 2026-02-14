// Controls for Bullet Rain Integration
// Change to 'false' to disable bullets for that specific overlay.
window.ENABLE_BULLETS_SQUARE = true;
window.ENABLE_BULLETS_RECT = true;

// ╔══════════════════════════════════════════════════════════════════╗
// ║              SMART HUE SYSTEM SETTINGS                          ║
// ║  Change GLOBAL_HUE_OFFSET to shift the theme color.              ║
// ║  0 = Original Green                                              ║
// ║  120 = Blue/Purple                                               ║
// ║  240 = Red/Orange                                                ║
// ╚══════════════════════════════════════════════════════════════════╝

window.GLOBAL_HUE_OFFSET = 360; // Degrees (0-360)
window.GLOBAL_HUE_DEFAULT = 360; // Baseline for resets
window.GLOBAL_BRIGHTNESS = 1.0; // Brightness Multiplier (0.0 - 2.0)
window.GLOBAL_COLOR_BRIGHTNESS = 1.66; // Color Shade Multiplier (0.2 - 2.0)
window.GLOBAL_COLOR_SATURATION = 1.0; // Color Saturation (0.0 - 2.0)

// === STAR BORDER SETTINGS ===
window.STAR_HUE_OFFSET = 190;
window.STAR_COLOR_BRIGHTNESS = 2.0;
window.STAR_COLOR_SATURATION = 1.0;

// === EFFECTS ===
window.GLOSSY_INTENSITY = 4.0; // 0.0 to 4.0

// --------------------------------------------------------------------
// Utility: Adjust Hue while preserving Saturation, Lightness & Alpha
// --------------------------------------------------------------------
window.adjustHue = function (color, degrees) {
    if (!degrees || degrees === 0) return color;

    // Helper to parse color string
    let r, g, b, a = 1;

    // Check for Hex
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const bigint = parseInt(hex, 16);
        r = (bigint >> 16) & 255;
        g = (bigint >> 8) & 255;
        b = bigint & 255;
    }
    // Check for RGBA/RGB
    else if (color.startsWith('rgb')) {
        const parts = color.match(/[\d.]+/g);
        if (parts) {
            r = parseFloat(parts[0]);
            g = parseFloat(parts[1]);
            b = parseFloat(parts[2]);
            if (parts.length > 3) a = parseFloat(parts[3]);
        }
    }
    else {
        return color; // Fallback for unknown formats
    }

    // Convert RGB to HSL
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Apply Hue Offset
    h = (h * 360 + degrees) % 360;
    while (h < 0) h += 360;

    // Apply Colorspace Adjustments (Saturation & Shade)
    let shadeFactor = window.GLOBAL_COLOR_BRIGHTNESS !== undefined ? window.GLOBAL_COLOR_BRIGHTNESS : 1.0;
    let satFactor = window.GLOBAL_COLOR_SATURATION !== undefined ? window.GLOBAL_COLOR_SATURATION : 1.0;

    s = Math.min(1.0, s * satFactor);
    l = Math.min(1.0, l * shadeFactor);

    // Convert back to RGB
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    let r_new, g_new, b_new;
    if (s === 0) {
        r_new = g_new = b_new = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r_new = hue2rgb(p, q, h / 360 + 1 / 3);
        g_new = hue2rgb(p, q, h / 360);
        b_new = hue2rgb(p, q, h / 360 - 1 / 3);
    }

    const r_final = Math.round(r_new * 255);
    const g_final = Math.round(g_new * 255);
    const b_final = Math.round(b_new * 255);

    return `rgba(${r_final}, ${g_final}, ${b_final}, ${a})`;
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║              BASE COLORS (DYNAMICALLY ADJUSTED)                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// Using 'var' allows this script to be re-executed periodically without errors.
var BASE_COLOR_NEON = window.adjustHue('#0aff0a', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_NEON_GLOW = window.adjustHue('rgba(10, 255, 10, 0.4)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_NEON_SOFT = window.adjustHue('rgba(10, 255, 10, 0.1)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_NEON_ACCENT = window.adjustHue('rgba(10, 255, 10, 0.3)', window.GLOBAL_HUE_OFFSET);

var BASE_COLOR_GRADIENT_START = window.adjustHue('rgba(0, 177, 137, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_GRADIENT_END = window.adjustHue('rgba(83, 252, 24, 0.95)', window.GLOBAL_HUE_OFFSET);

var BASE_COLOR_FILL_START = window.adjustHue('rgba(5, 60, 50, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_MID = window.adjustHue('rgba(10, 100, 80, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_MID2 = window.adjustHue('rgba(30, 170, 80, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_END = window.adjustHue('rgba(50, 220, 100, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_GOAL_START = window.adjustHue('rgba(17, 153, 142, 0.9)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_GOAL_END = window.adjustHue('rgba(56, 239, 125, 0.9)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FILL_GLOW = window.adjustHue('rgba(56, 239, 125, 0.4)', window.GLOBAL_HUE_OFFSET);

var BASE_COLOR_FABRIC_DARK = window.adjustHue('rgba(5, 140, 45, 0.98)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FABRIC_MID = window.adjustHue('rgba(15, 200, 70, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FABRIC_BRIGHT = window.adjustHue('rgba(30, 230, 90, 0.92)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FABRIC_MID2 = window.adjustHue('rgba(20, 200, 65, 0.95)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_FABRIC_DEEP = window.adjustHue('rgba(10, 170, 55, 0.98)', window.GLOBAL_HUE_OFFSET);

var BASE_COLOR_WAVE_1 = window.adjustHue('rgb(17, 153, 142)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_WAVE_2 = window.adjustHue('rgb(37, 196, 134)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_WAVE_3 = window.adjustHue('rgb(56, 239, 125)', window.GLOBAL_HUE_OFFSET);

var BASE_COLOR_LABEL = window.adjustHue('rgba(10, 255, 10, 0.7)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_LABEL_GLOW = window.adjustHue('rgba(10, 255, 10, 0.3)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_BORDER_ACCENT = window.adjustHue('rgba(10, 255, 10, 0.6)', window.GLOBAL_HUE_OFFSET);
var BASE_COLOR_ACCENT_LINE = window.adjustHue('rgba(10, 255, 10, 0.3)', window.GLOBAL_HUE_OFFSET);

// Global Stylesheet injection to apply variables across all elements
(function injectGlobalStyles() {
    let style = document.getElementById('global-sync-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'global-sync-styles';
        document.head.appendChild(style);
    }

    style.textContent = `
        :root {
            --neon-green: ${BASE_COLOR_NEON};
            --glow-color: ${BASE_COLOR_NEON_GLOW};
            --soft-glow: ${BASE_COLOR_NEON_SOFT};
            --accent-glow: ${BASE_COLOR_NEON_ACCENT};
            --gradient-start: ${BASE_COLOR_GRADIENT_START};
            --gradient-end: ${BASE_COLOR_GRADIENT_END};
            --fill-start: ${BASE_COLOR_FILL_START};
            --fill-mid: ${BASE_COLOR_FILL_MID};
            --fill-end: ${BASE_COLOR_FILL_END};
            --global-brightness: ${window.GLOBAL_BRIGHTNESS};
        }
        
        body, .container, .webcam-frame, .dock-anchor, .goal-container, .gifter-anchor {
            filter: brightness(${window.GLOBAL_BRIGHTNESS}) !important;
        }
    `;
})();

