import sys
import re
import os

# Default to 'Settings' subdirectory if not specified
DEFAULT_SETTINGS_FILE = os.path.join("Settings", "settings.js")

def main():
    # Usage: HueAction.exe [Value/Command] [Optional: Path to settings.js]
    arg = sys.argv[1] if len(sys.argv) > 1 else "0"
    
    # Check for second argument (Path)
    if len(sys.argv) > 2:
        settings_path = sys.argv[2]
        # If directory, append filename
        if os.path.isdir(settings_path):
            settings_path = os.path.join(settings_path, "settings.js")
    else:
        # Default to EXE directory
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        settings_path = os.path.join(base_dir, DEFAULT_SETTINGS_FILE)
    
    if not os.path.exists(settings_path):
        return

    # Read existing file
    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        return

    # Find current value
    # Find current value and default value
    match_offset = re.search(r"window\.GLOBAL_HUE_OFFSET\s*=\s*(-?\d+);", content)
    match_default = re.search(r"window\.GLOBAL_HUE_DEFAULT\s*=\s*(-?\d+);", content)
    
    if not match_offset: return
    
    current_val = int(match_offset.group(1))
    default_val = int(match_default.group(1)) if match_default else 0
    
    new_val = current_val

    # Parse Argument
    if arg.lower() == "reset":
        new_val = default_val
    elif arg.startswith("+"):
        try:
            amount = int(arg[1:])
            new_val += amount
        except ValueError:
            return
    elif arg.startswith("-"):
        try:
            amount = int(arg[1:])
            new_val -= amount
        except ValueError:
            return
    else:
        # Absolute set (e.g. "30")
        try:
            new_val = int(arg)
        except ValueError:
            return

    # Normalize to 0-359 range (optional logic)
    # The user might want cumulative stacking, but usually we mod 360 to keep colors sane.
    new_val = new_val % 360

    # Write back
    new_content = re.sub(
        r"window\.GLOBAL_HUE_OFFSET\s*=\s*-?\d+;", 
        f"window.GLOBAL_HUE_OFFSET = {new_val};", 
        content
    )

    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)

if __name__ == "__main__":
    main()
