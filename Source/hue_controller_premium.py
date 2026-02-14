import customtkinter as ctk
import sys
import re
import os
import time
from PIL import Image

# CONFIG
LOGO_REL_PATH = os.path.join("Logo", "Logo.png")

def get_settings_path():
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "Settings", "settings.js")

SETTINGS_PATH = get_settings_path()

# THEME COLORS
COLOR_BG = "#000000"       # Pitch Black
COLOR_SURFACE = "#111111"  # Slightly lighter black for cards
COLOR_ACCENT = "#FFFFFF"   # White text
COLOR_SLIDER = "#0aff0a"   # Neon Green (Signature)

class HueControllerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window Setup
        self.title("Color Controller")
        self.geometry("600x880")
        self.configure(fg_color=COLOR_BG)
        # Frameless Mode: This guarantees no OS title bar
        self.overrideredirect(True) 

        # 1. High DPI Awareness
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass
            
        # 2. Setup Icon (Taskbar needs .ico)
        self.setup_icon()

        # 3. Force Taskbar Icon (The specific hack for overrideredirect)
        self.after(10, lambda: self.set_app_window())

        # Center Window
        self.center_window()

    def set_app_window(self):
        # Force the window to be a top-level app window so it appears in taskbar
        # This works WITH overrideredirect(True)
        try:
            import ctypes
            GWL_EXSTYLE = -20
            WS_EX_APPWINDOW = 0x00040000
            WS_EX_TOOLWINDOW = 0x00000080
            
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            
            # Remove ToolWindow (default for overrideredirect), Add AppWindow
            style = style & ~WS_EX_TOOLWINDOW
            style = style | WS_EX_APPWINDOW
            
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
            
            # Force redraw/update of style
            ctypes.windll.user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x27)
            self.wm_withdraw()
            self.after(10, lambda: self.wm_deiconify())
        except Exception as e:
            print(f"Taskbar Hack Error: {e}")

        # State
        self.current_hue = 0
        self.current_brightness = 1.0
        self.current_color_brightness = 1.0
        self.star_hue = 190
        self.star_shade = 1.0
        self.gloss_intensity = 1.0
        
        self.last_write_time = 0
        self.write_delay = 0.05
        self.load_initial_hue()

        # Layout Grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1) # Give all space to scroll area
        self.grid_rowconfigure(2, weight=1)

        # === 1. Custom Title Bar ===
        self.title_bar = ctk.CTkFrame(self, height=40, fg_color=COLOR_BG, corner_radius=0)
        self.title_bar.grid(row=0, column=0, sticky="ew")
        self.title_bar.bind("<Button-1>", self.start_move)
        self.title_bar.bind("<B1-Motion>", self.do_move)

        # Close Button
        self.btn_close = ctk.CTkButton(
            self.title_bar, text="×", width=40, height=40,
            fg_color="transparent", hover_color="#330000",
            text_color="white", font=("Arial", 20),
            command=self.close_app
        )
        self.btn_close.pack(side="right")
        
        # Minimize Button
        self.btn_min = ctk.CTkButton(
            self.title_bar, text="-", width=40, height=40,
            fg_color="transparent", hover_color="#222222",
            text_color="white", font=("Arial", 20),
            command=self.minimize_app
        )
        self.btn_min.pack(side="right")

        # Title Label
        self.lbl_title = ctk.CTkLabel(
            self.title_bar, text="BULLET PUNJABI CONTROLLER", 
            font=("Anton", 14), text_color="#666666"
        )
        self.lbl_title.pack(side="left", padx=15)
        self.lbl_title.bind("<Button-1>", self.start_move)

        # Main Scrollable Frame
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", corner_radius=0)
        self.scroll_frame.grid(row=1, column=0, rowspan=2, sticky="nsew", padx=10, pady=10)
        self.scroll_frame.grid_columnconfigure(0, weight=1)

        # === 2. Logo Area ===
        self.logo_frame = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        self.logo_frame.grid(row=0, column=0, pady=(10, 20))
        # Label will be packed here by setup_icon later

        # === 3. Theme Controls Card ===
        self.theme_frame = ctk.CTkFrame(self.scroll_frame, fg_color=COLOR_SURFACE, corner_radius=20)
        self.theme_frame.grid(row=1, column=0, padx=15, pady=10, sticky="ew")

        ctk.CTkLabel(self.theme_frame, text="CORE THEME", font=("Inter", 12, "bold"), text_color="#555555").pack(pady=(15, 0))

        # Hue
        self.lbl_value = ctk.CTkLabel(self.theme_frame, text=f"{self.current_hue}°", font=("Inter", 38, "bold"), text_color="white")
        self.lbl_value.pack(pady=(10, 0))
        self.slider = ctk.CTkSlider(self.theme_frame, from_=0, to=360, number_of_steps=360, width=400, command=self.on_slider_change)
        self.slider.pack(pady=(5, 10))

        # Brightness
        self.lbl_bright_val = ctk.CTkLabel(self.theme_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_bright_val.pack(pady=(10, 0))
        ctk.CTkLabel(self.theme_frame, text="GLOBAL BRIGHTNESS (FILTER)", font=("Inter", 10), text_color="#444444").pack()
        self.slider_bright = ctk.CTkSlider(self.theme_frame, from_=0.2, to=2.0, width=400, command=self.on_brightness_change)
        self.slider_bright.pack(pady=(5, 10))

        # Color Shade
        self.lbl_shade_val = ctk.CTkLabel(self.theme_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_shade_val.pack(pady=(10, 0))
        ctk.CTkLabel(self.theme_frame, text="COLOR SHADE (HSL LIGHTNESS)", font=("Inter", 10), text_color="#444444").pack()
        self.slider_shade = ctk.CTkSlider(self.theme_frame, from_=0.2, to=2.0, width=400, command=self.on_shade_change)
        self.slider_shade.pack(pady=(5, 20))

        # === 4. Accent Controls Card ===
        self.accent_frame = ctk.CTkFrame(self.scroll_frame, fg_color=COLOR_SURFACE, corner_radius=20)
        self.accent_frame.grid(row=2, column=0, padx=15, pady=10, sticky="ew")

        ctk.CTkLabel(self.accent_frame, text="STAR BORDER & ACCENTS", font=("Inter", 12, "bold"), text_color="#555555").pack(pady=(15, 0))

        # Star Hue
        self.lbl_star_hue = ctk.CTkLabel(self.accent_frame, text=f"{self.star_hue}°", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_star_hue.pack(pady=(10, 0))
        self.slider_star_hue = ctk.CTkSlider(self.accent_frame, from_=0, to=360, number_of_steps=360, width=400, command=self.on_star_hue_change)
        self.slider_star_hue.pack(pady=(5, 10))

        # Star Shade
        self.lbl_star_shade = ctk.CTkLabel(self.accent_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_shade.pack(pady=(10, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR BORDER SHADE", font=("Inter", 10), text_color="#444444").pack()
        self.slider_star_shade = ctk.CTkSlider(self.accent_frame, from_=0.2, to=2.0, width=400, command=self.on_star_shade_change)
        self.slider_star_shade.pack(pady=(5, 20))

        # === 5. Effects Card ===
        self.effect_frame = ctk.CTkFrame(self.scroll_frame, fg_color=COLOR_SURFACE, corner_radius=20)
        self.effect_frame.grid(row=3, column=0, padx=15, pady=10, sticky="ew")

        ctk.CTkLabel(self.effect_frame, text="VISUAL EFFECTS", font=("Inter", 12, "bold"), text_color="#555555").pack(pady=(15, 0))

        # Gloss
        self.lbl_gloss = ctk.CTkLabel(self.effect_frame, text="100%", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_gloss.pack(pady=(10, 0))
        ctk.CTkLabel(self.effect_frame, text="GLOSSY INTENSITY", font=("Inter", 10), text_color="#444444").pack()
        self.slider_gloss = ctk.CTkSlider(self.effect_frame, from_=0.0, to=4.0, width=400, command=self.on_gloss_change)
        self.slider_gloss.pack(pady=(5, 25))
        # Status Bar stays outside scroll
        self.lbl_status = ctk.CTkLabel(
            self, text="READY", 
            font=("Inter", 10), text_color="#333333"
        )
        self.lbl_status.grid(row=3, column=0, pady=5, sticky="s")


    def setup_icon(self):
        try:
            # Determine path
            if hasattr(sys, '_MEIPASS'):
                # We will bundle it to root "." in PyInstaller
                logo_path = os.path.join(sys._MEIPASS, "Logo.png")
            else:
                # Running from source (Development)
                logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Logo", "Logo.png")
            
            if not os.path.exists(logo_path):
                # Debug logging
                try:
                    with open("debug_logo_error.txt", "w") as f:
                        f.write(f"Logo missing at: {logo_path}\n")
                        f.write(f"MEIPASS contents: {os.listdir(sys._MEIPASS) if hasattr(sys, '_MEIPASS') else 'Not Frozen'}\n")
                except:
                    pass
                return

            # 1. Set internal window icon (Title bar, Alt-Tab)
            pil_img = Image.open(logo_path)
            self.logo_img_ctk = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(160, 160))
            
            # 2. Generate temp .ico for Taskbar
            temp_ico = os.path.join(os.getenv('TEMP'), "hue_ctrl_temp.ico")
            pil_img.save(temp_ico, format='ICO', sizes=[(256, 256)])
            try:
                self.iconbitmap(temp_ico)
            except:
                pass # Iconbitmap sometimes fails on some persistent windows
            
            # 3. Set Logo in UI
            self.logo_frame = ctk.CTkFrame(self, fg_color="transparent")
            self.logo_frame.grid(row=1, column=0, pady=(20, 10))
            self.lbl_logo = ctk.CTkLabel(self.logo_frame, image=self.logo_img_ctk, text="")
            self.lbl_logo.pack()
            
        except Exception as e:
            print(f"Icon Error: {e}")

    def center_window(self):
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')

    def start_move(self, event):
        self.x = event.x
        self.y = event.y

    def do_move(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.winfo_x() + deltax
        y = self.winfo_y() + deltay
        self.geometry(f"+{x}+{y}")

    def close_app(self):
        self.destroy()

    def minimize_app(self):
        # Because we messed with styles, standard iconify might need help
        self.update_idletasks()
        self.overrideredirect(False)
        self.iconify()
        self.overrideredirect(True)

    def load_initial_hue(self):
        try:
            if not os.path.exists(SETTINGS_PATH):
                self.current_hue = 0
                self.current_brightness = 1.0
                return

            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
                match = re.search(r'window\.GLOBAL_HUE_OFFSET\s*=\s*(\d+);', content)
                if match:
                    self.current_hue = int(match.group(1))
                
                match_br = re.search(r'window\.GLOBAL_BRIGHTNESS\s*=\s*([\d\.]+);', content)
                if match_br:
                    self.current_brightness = float(match_br.group(1))
                else:
                    self.current_brightness = 1.0
                match_cb = re.search(r'window\.GLOBAL_COLOR_BRIGHTNESS\s*=\s*([\d\.]+);', content)
                if match_cb:
                    self.current_color_brightness = float(match_cb.group(1))
                else:
                    self.current_color_brightness = 1.0

                match_sh = re.search(r'window\.STAR_HUE_OFFSET\s*=\s*(\d+);', content)
                if match_sh:
                    self.star_hue = int(match_sh.group(1))
                else:
                    self.star_hue = 190

                match_ss = re.search(r'window\.STAR_COLOR_BRIGHTNESS\s*=\s*([\d\.]+);', content)
                if match_ss:
                    self.star_shade = float(match_ss.group(1))
                else:
                    self.star_shade = 1.0

                match_gl = re.search(r'window\.GLOSSY_INTENSITY\s*=\s*([\d\.]+);', content)
                if match_gl:
                    self.gloss_intensity = float(match_gl.group(1))
                else:
                    self.gloss_intensity = 1.0

                # Set slider positions
                self.slider.set(self.current_hue)
                self.slider_bright.set(self.current_brightness)
                self.slider_shade.set(self.current_color_brightness)
                self.slider_star_hue.set(self.star_hue)
                self.slider_star_shade.set(self.star_shade)
                self.slider_gloss.set(self.gloss_intensity)

                self.lbl_bright_val.configure(text=f"{int(self.current_brightness*100)}%")
                self.lbl_shade_val.configure(text=f"{int(self.current_color_brightness*100)}%")
                self.lbl_star_shade.configure(text=f"{int(self.star_shade*100)}%")
                self.lbl_gloss.configure(text=f"{int(self.gloss_intensity*100)}%")

        except Exception as e:
            print(f"Load Settings error: {e}")
            self.current_hue = 0
            self.current_brightness = 1.0
            self.current_color_brightness = 1.0
            self.star_hue = 190
            self.star_shade = 1.0
            self.gloss_intensity = 1.0

    def on_slider_change(self, value):
        val = int(value)
        self.lbl_value.configure(text=f"{val}°")
        self.current_hue = val
        self.debounce_write()

    def on_brightness_change(self, value):
        # Value is 0.2 to 2.0
        val = round(float(value), 2)
        self.lbl_bright_val.configure(text=f"{int(val*100)}%")
        self.current_brightness = val
        self.debounce_write()

    def on_shade_change(self, value):
        val = round(float(value), 2)
        self.lbl_shade_val.configure(text=f"{int(val*100)}%")
        self.current_color_brightness = val
        self.debounce_write()

    def on_star_hue_change(self, value):
        val = int(value)
        self.lbl_star_hue.configure(text=f"{val}°")
        self.star_hue = val
        self.debounce_write()

    def on_star_shade_change(self, value):
        val = round(float(value), 2)
        self.lbl_star_shade.configure(text=f"{int(val*100)}%")
        self.star_shade = val
        self.debounce_write()

    def on_gloss_change(self, value):
        val = round(float(value), 2)
        self.lbl_gloss.configure(text=f"{int(val*100)}%")
        self.gloss_intensity = val
        self.debounce_write()

    def debounce_write(self):
        curr = time.time()
        if curr - self.last_write_time > self.write_delay:
            self.write_settings()
            self.last_write_time = curr

    def write_settings(self):
        try:
            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                content = f.read()

            # Update Hue
            content = re.sub(
                r'(window\.GLOBAL_HUE_OFFSET\s*=\s*)(\d+)(;)', 
                f'\\g<1>{self.current_hue}\\g<3>', 
                content
            )
            content = re.sub(
                r'(window\.GLOBAL_HUE_DEFAULT\s*=\s*)(\d+)(;)', 
                f'\\g<1>{self.current_hue}\\g<3>', 
                content
            )

            # Update Global Brightness
            if "window.GLOBAL_BRIGHTNESS" in content:
                content = re.sub(
                    r'(window\.GLOBAL_BRIGHTNESS\s*=\s*)([\d\.]+)(;)',
                    f'\\g<1>{self.current_brightness}\\g<3>',
                    content
                )
            else:
                content += f"\nwindow.GLOBAL_BRIGHTNESS = {self.current_brightness};"

            # Update Color Shade
            if "window.GLOBAL_COLOR_BRIGHTNESS" in content:
                content = re.sub(
                    r'(window\.GLOBAL_COLOR_BRIGHTNESS\s*=\s*)([\d\.]+)(;)',
                    f'\\g<1>{self.current_color_brightness}\\g<3>',
                    content
                )
            else:
                content += f"\nwindow.GLOBAL_COLOR_BRIGHTNESS = {self.current_color_brightness};"

            # Update Star Hue
            if "window.STAR_HUE_OFFSET" in content:
                content = re.sub(
                    r'(window\.STAR_HUE_OFFSET\s*=\s*)(\d+)(;)',
                    f'\\g<1>{self.star_hue}\\g<3>',
                    content
                )
            else:
                content += f"\nwindow.STAR_HUE_OFFSET = {self.star_hue};"

            # Update Star Shade
            if "window.STAR_COLOR_BRIGHTNESS" in content:
                content = re.sub(
                    r'(window\.STAR_COLOR_BRIGHTNESS\s*=\s*)([\d\.]+)(;)',
                    f'\\g<1>{self.star_shade}\\g<3>',
                    content
                )
            else:
                content += f"\nwindow.STAR_COLOR_BRIGHTNESS = {self.star_shade};"

            # Update Gloss
            if "window.GLOSSY_INTENSITY" in content:
                content = re.sub(
                    r'(window\.GLOSSY_INTENSITY\s*=\s*)([\d\.]+)(;)',
                    f'\\g<1>{self.gloss_intensity}\\g<3>',
                    content
                )
            else:
                content += f"\nwindow.GLOSSY_INTENSITY = {self.gloss_intensity};"

            with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
                f.write(content)
            self.lbl_status.configure(text="SETTINGS UPDATED")
        except:
            self.lbl_status.configure(text="ERROR WRITING FILE")

if __name__ == "__main__":
    c = HueControllerApp()
    c.mainloop()
