/* GENERATED from src/brand.json by scripts/build.mjs — do not edit. */
export const tokens = {
  "name": "Neutral",
  "version": 1,
  "color": {
    "light": {
      "background": "#FFFFFF",
      "surface": "#F5F5F7",
      "surface-raised": "#FFFFFF",
      "border": "#D2D2D7",
      "text": "#1D1D1F",
      "text-muted": "#5C5C63",
      "primary": "#2F5D8A",
      "on-primary": "#FFFFFF",
      "success": "#1E7B3A",
      "on-success": "#FFFFFF",
      "warning": "#8A5A00",
      "on-warning": "#FFFFFF",
      "danger": "#B3261E",
      "on-danger": "#FFFFFF",
      "focus": "#2F5D8A",
      "disabled": "#E5E5EA",
      "on-disabled": "#55555A",
      "chart": "#2F6BC4"
    },
    "dark": {
      "background": "#000000",
      "surface": "#1C1C1E",
      "surface-raised": "#2C2C2E",
      "border": "#3A3A3C",
      "text": "#F5F5F7",
      "text-muted": "#AEAEB2",
      "primary": "#8DB4DC",
      "on-primary": "#0B1B2B",
      "success": "#6FCF8C",
      "on-success": "#062010",
      "warning": "#F2C46B",
      "on-warning": "#2A1C00",
      "danger": "#FF8A80",
      "on-danger": "#2B0603",
      "focus": "#8DB4DC",
      "disabled": "#2C2C2E",
      "on-disabled": "#A1A1A6",
      "chart": "#5A92DC"
    }
  },
  "typography": {
    "family": {
      "sans": "System",
      "mono": "Menlo"
    },
    "size": {
      "xs": 12,
      "sm": 15,
      "md": 17,
      "lg": 20,
      "xl": 28,
      "2xl": 34
    },
    "lineHeight": {
      "xs": 16,
      "sm": 20,
      "md": 22,
      "lg": 25,
      "xl": 34,
      "2xl": 41
    },
    "weight": {
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    }
  },
  "spacing": {
    "0": 0,
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48
  },
  "radius": {
    "sm": 6,
    "md": 10,
    "lg": 14,
    "xl": 20,
    "full": 9999
  },
  "elevation": {
    "0": {
      "y": 0,
      "blur": 0,
      "opacity": 0
    },
    "1": {
      "y": 1,
      "blur": 3,
      "opacity": 0.12
    },
    "2": {
      "y": 4,
      "blur": 12,
      "opacity": 0.14
    },
    "3": {
      "y": 8,
      "blur": 24,
      "opacity": 0.18
    }
  },
  "minTouchTarget": 44,
  "components": {
    "button": {
      "primary": {
        "bg": "primary",
        "fg": "on-primary",
        "radius": "md"
      },
      "secondary": {
        "bg": "surface",
        "fg": "text",
        "radius": "md",
        "border": "border"
      },
      "danger": {
        "bg": "danger",
        "fg": "on-danger",
        "radius": "md"
      }
    },
    "card": {
      "default": {
        "bg": "surface-raised",
        "fg": "text",
        "radius": "lg",
        "elevation": "1"
      }
    }
  },
  "assets": {
    "logo": "assets/logo.svg",
    "appIcon": "assets/icon.png",
    "splash": "assets/splash.png"
  }
};
export default tokens;
