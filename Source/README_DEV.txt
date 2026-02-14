# Developer Notes

This folder contains the source code for the Bullet Punjabi Color System.

## Files
*   `hue_controller_premium.py`: Source for the GUI Application.
*   `hue_action.py`: Source for the CLI Tool.
*   `*.spec`: PyInstaller build specifications.

## How to Edit & Rebuild

1.  **Edit** the `.py` files as needed.
2.  **Rebuild** using PyInstaller. run the following commands from the PARENT directory (F:\Automation\Bullet Punjabi\):

### Build Color Controller
```powershell
pyinstaller --noconsole --onefile --icon="Logo.ico" --add-data "Logo/Logo.png;." "Source/hue_controller_premium.py" --name "ColorControllerNew"
```

### Build HueAction
```powershell
pyinstaller --noconsole --onefile --icon="Logo.ico" "Source/hue_action.py" --name "HueActionNew"
```

3.  The new EXEs will appear in the `dist` folder. Move them to the root.
