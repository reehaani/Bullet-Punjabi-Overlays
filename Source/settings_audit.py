import re
from pathlib import Path


CONTROLLED_KEYS = [
    "GLOBAL_HUE_OFFSET",
    "GLOBAL_BRIGHTNESS",
    "GLOBAL_COLOR_BRIGHTNESS",
    "STAR_HUE_OFFSET",
    "STAR_COLOR_BRIGHTNESS",
    "STAR_SECONDARY_HUE_OFFSET",
    "STAR_SECONDARY_COLOR_BRIGHTNESS",
    "STAR_SECONDARY_OFFSET_DEG",
    "GLOSSY_INTENSITY",
    "DAILY_KICKS_GOAL",
    "SUB_GOAL_CONFIG",
    "GLOW_KICK_DOCK",
    "GLOW_SUB_DOCK",
    "GLOW_KICK_RECT",
    "GLOW_SUB_RECT",
    "SHOW_BORDER_KICK_DOCK",
    "SHOW_BORDER_SUB_DOCK",
    "SHOW_BORDER_KICK_RECT",
]


def overlay_uses_settings(text: str) -> bool:
    return "Settings/settings.js" in text or "../Settings/settings.js" in text


def find_key_usage(text: str, key: str) -> bool:
    return re.search(rf"\b{re.escape(key)}\b", text) is not None


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    overlays_dir = repo_root / "Overlays"
    overlays = sorted(overlays_dir.glob("*.html"))

    if not overlays:
        print("No overlay files found.")
        return 1

    rows = []
    for overlay in overlays:
        text = overlay.read_text(encoding="utf-8", errors="replace")
        uses_settings = overlay_uses_settings(text)
        key_hits = [key for key in CONTROLLED_KEYS if find_key_usage(text, key)]
        rows.append((overlay.name, uses_settings, key_hits))

    print("=== Overlay Settings Audit ===")
    for name, uses_settings, key_hits in rows:
        print(f"{name}")
        print(f"  loads settings.js: {'YES' if uses_settings else 'NO'}")
        print(f"  controlled keys referenced: {len(key_hits)}")
        if key_hits:
            print(f"  keys: {', '.join(key_hits)}")
        else:
            print("  keys: (none)")
        print()

    print("=== Controller Key Coverage (count of overlays referencing key) ===")
    for key in CONTROLLED_KEYS:
        count = sum(1 for _, _, key_hits in rows if key in key_hits)
        print(f"{key}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
