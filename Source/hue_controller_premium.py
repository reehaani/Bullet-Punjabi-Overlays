import customtkinter as ctk
import sys
import re
import os
import time
import tempfile
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


def resolve_logo_path():
    candidates = []
    if hasattr(sys, "_MEIPASS"):
        candidates.append(os.path.join(sys._MEIPASS, "Logo.png"))
        candidates.append(os.path.join(sys._MEIPASS, "Logo", "Logo.png"))

    exe_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cwd = os.getcwd()

    candidates.extend([
        os.path.join(exe_dir, "Logo.png"),
        os.path.join(exe_dir, "Logo", "Logo.png"),
        os.path.join(script_dir, "..", "Logo", "Logo.png"),
        os.path.join(script_dir, "Logo", "Logo.png"),
        os.path.join(cwd, "Logo", "Logo.png"),
        LOGO_REL_PATH,
    ])

    for p in candidates:
        if p and os.path.exists(p):
            return p
    return None

# THEME COLORS
COLOR_BG = "#000000"       # Pitch Black
COLOR_SURFACE = "#111111"  # Slightly lighter black for cards
COLOR_ACCENT = "#FFFFFF"   # White text
COLOR_SLIDER = "#0aff0a"   # Neon Green (Signature)
COLOR_TEXT = "#F5F5F5"
COLOR_MUTED = "#D0D0D0"

DEFAULTS = {
    "GLOBAL_HUE_OFFSET": 0,
    "GLOBAL_BRIGHTNESS": 1.0,
    "GLOBAL_COLOR_BRIGHTNESS": 1.0,
    "GLOBAL_COLOR_SATURATION": 1.0,
    "STAR_HUE_OFFSET": 190,
    "STAR_COLOR_BRIGHTNESS": 1.0,
    "STAR_SECONDARY_HUE_OFFSET": 205,
    "STAR_SECONDARY_COLOR_BRIGHTNESS": 1.6,
    "STAR_SECONDARY_OFFSET_DEG": 120,
    "STAR_SPIN_SPEED": 10.0,
    "GLOSSY_INTENSITY": 1.0,
    "RIM_LIGHT_INTENSITY": 1.0,
    "DAILY_KICKS_GOAL": 10000,
    "SUB_GOAL_CONFIG": 50,
    "GLOW_KICK_DOCK": True,
    "GLOW_SUB_DOCK": True,
    "GLOW_KICK_RECT": True,
    "GLOW_SUB_RECT": True,
    "SHOW_BORDER_KICK_DOCK": True,
    "SHOW_BORDER_SUB_DOCK": True,
    "SHOW_BORDER_KICK_RECT": True,
}

class HueControllerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window Setup
        self.title("Color Controller")
        self.geometry("950x900") # Wider for two columns
        self.configure(fg_color=COLOR_BG)
        # Frameless Mode: This guarantees no OS title bar
        self.overrideredirect(True) 

        # 1. High DPI Awareness
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass
            
        # 2. Force Taskbar Icon (The specific hack for overrideredirect)
        self.after(10, lambda: self.set_app_window())

        # Center Window
        self.center_window()

        # State
        self.current_hue = DEFAULTS["GLOBAL_HUE_OFFSET"]
        self.current_brightness = DEFAULTS["GLOBAL_BRIGHTNESS"]
        self.current_color_brightness = DEFAULTS["GLOBAL_COLOR_BRIGHTNESS"]
        self.current_color_saturation = DEFAULTS["GLOBAL_COLOR_SATURATION"]
        self.star_hue = DEFAULTS["STAR_HUE_OFFSET"]
        self.star_shade = DEFAULTS["STAR_COLOR_BRIGHTNESS"]
        self.star_secondary_hue = DEFAULTS["STAR_SECONDARY_HUE_OFFSET"]
        self.star_secondary_shade = DEFAULTS["STAR_SECONDARY_COLOR_BRIGHTNESS"]
        self.star_secondary_offset = DEFAULTS["STAR_SECONDARY_OFFSET_DEG"]
        self.star_spin_speed = DEFAULTS["STAR_SPIN_SPEED"]
        self.gloss_intensity = DEFAULTS["GLOSSY_INTENSITY"]
        self.rim_light_intensity = DEFAULTS["RIM_LIGHT_INTENSITY"]
        self.daily_kicks_goal = DEFAULTS["DAILY_KICKS_GOAL"]
        self.sub_goal_config = DEFAULTS["SUB_GOAL_CONFIG"]
        
        self.last_write_time = 0
        self.write_delay = 0.12
        self.pending_write_job = None
        self.is_loading = True
        self.last_saved_payload = None
        self.resize_job = None
        
        # Layout Grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1) 

        # === 0. Gradient Background ===
        self.canvas_bg = ctk.CTkCanvas(self, highlightthickness=0)
        self.canvas_bg.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.bind("<Configure>", self.on_window_resize)

        # === 0.5 Large Background Logo ===
        self.lbl_bg_logo = ctk.CTkLabel(self, text="", fg_color="transparent")
        self.lbl_bg_logo.place(relx=0.5, rely=0.5, anchor="center")

        # === 1. Custom Title Bar ===
        self.title_bar = ctk.CTkFrame(self, height=40, fg_color="transparent", corner_radius=0)
        self.title_bar.grid(row=0, column=0, sticky="ew")
        self.title_bar.bind("<Button-1>", self.start_move)
        self.title_bar.bind("<B1-Motion>", self.do_move)

        # Close Button
        self.btn_close = ctk.CTkButton(
            self.title_bar, text="X", width=40, height=40,
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
            font=("Inter", 12, "bold"), text_color=COLOR_TEXT
        )
        self.lbl_title.pack(side="left", padx=15)
        self.lbl_title.bind("<Button-1>", self.start_move)

        # Main Scrollable Frame - Grid for Two Columns
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", corner_radius=0)
        self.scroll_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=10)
        self.scroll_frame.grid_columnconfigure(0, weight=1) 
        self.scroll_frame.grid_columnconfigure(1, weight=1) 

        # === 2. Logo Area ===
        self.logo_frame = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        self.logo_frame.grid(row=0, column=0, columnspan=2, pady=(10, 20))
        # Label will be packed here by setup_icon later

        # Setup icon/logo after widgets exist (prevents silent init failures)
        self.setup_icon()
        
        # Left Column Section
        self.left_col = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        self.left_col.grid(row=1, column=0, sticky="nsew", padx=5)
        
        # Right Column Section
        self.right_col = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
        self.right_col.grid(row=1, column=1, sticky="nsew", padx=5)

        # === 3. Theme Controls Card (Left) ===
        self.theme_frame = ctk.CTkFrame(self.left_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.theme_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(self.theme_frame, text="CORE THEME", font=("Inter", 12, "bold"), text_color=COLOR_TEXT).pack(pady=(15, 0))

        # Hue
        self.lbl_value = ctk.CTkLabel(self.theme_frame, text="0 deg", font=("Inter", 38, "bold"), text_color="white")
        self.lbl_value.pack(pady=(10, 0))
        self.slider = ctk.CTkSlider(self.theme_frame, from_=0, to=360, number_of_steps=360, width=380, command=self.on_slider_change)
        self.slider.pack(pady=(5, 10))

        # Brightness
        self.lbl_bright_val = ctk.CTkLabel(self.theme_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_bright_val.pack(pady=(10, 0))
        ctk.CTkLabel(self.theme_frame, text="GLOBAL BRIGHTNESS (FILTER)", font=("Inter", 9), text_color=COLOR_TEXT).pack()
        self.slider_bright = ctk.CTkSlider(self.theme_frame, from_=0.2, to=2.0, width=380, command=self.on_brightness_change)
        self.slider_bright.pack(pady=(5, 10))

        # Color Shade
        self.lbl_shade_val = ctk.CTkLabel(self.theme_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_shade_val.pack(pady=(10, 0))
        ctk.CTkLabel(self.theme_frame, text="COLOR SHADE", font=("Inter", 9), text_color=COLOR_TEXT).pack()
        self.slider_shade = ctk.CTkSlider(self.theme_frame, from_=0.2, to=2.0, width=380, command=self.on_shade_change)
        self.slider_shade.pack(pady=(5, 10))

        # Color Saturation
        self.lbl_sat_val = ctk.CTkLabel(self.theme_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_sat_val.pack(pady=(8, 0))
        ctk.CTkLabel(self.theme_frame, text="COLOR SATURATION", font=("Inter", 9), text_color=COLOR_TEXT).pack()
        self.slider_sat = ctk.CTkSlider(self.theme_frame, from_=0.0, to=2.0, width=380, command=self.on_saturation_change)
        self.slider_sat.pack(pady=(5, 20))

        # === 4. Accent Controls Card (Left) ===
        self.accent_frame = ctk.CTkFrame(self.left_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.accent_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(self.accent_frame, text="STAR BORDER & ACCENTS", font=("Inter", 12, "bold"), text_color=COLOR_TEXT).pack(pady=(15, 0))

        # Star Hue
        self.lbl_star_hue = ctk.CTkLabel(self.accent_frame, text="0 deg", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_star_hue.pack(pady=(10, 0))
        self.slider_star_hue = ctk.CTkSlider(self.accent_frame, from_=0, to=360, number_of_steps=360, width=380, command=self.on_star_hue_change)
        self.slider_star_hue.pack(pady=(5, 10))

        # Star Shade
        self.lbl_star_shade = ctk.CTkLabel(self.accent_frame, text="100%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_shade.pack(pady=(10, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR BORDER SHADE", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_star_shade = ctk.CTkSlider(self.accent_frame, from_=0.2, to=4.0, width=380, command=self.on_star_shade_change)
        self.slider_star_shade.pack(pady=(5, 10))

        # Secondary Star Hue
        self.lbl_star_hue_2 = ctk.CTkLabel(self.accent_frame, text="205 deg", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_hue_2.pack(pady=(8, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR SECONDARY HUE", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_star_hue_2 = ctk.CTkSlider(self.accent_frame, from_=0, to=360, number_of_steps=360, width=380, command=self.on_star_hue_2_change)
        self.slider_star_hue_2.pack(pady=(5, 10))

        # Secondary Star Shade
        self.lbl_star_shade_2 = ctk.CTkLabel(self.accent_frame, text="160%", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_shade_2.pack(pady=(8, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR SECONDARY SHADE", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_star_shade_2 = ctk.CTkSlider(self.accent_frame, from_=0.2, to=4.0, width=380, command=self.on_star_shade_2_change)
        self.slider_star_shade_2.pack(pady=(5, 10))

        # Secondary Star Offset
        self.lbl_star_offset_2 = ctk.CTkLabel(self.accent_frame, text="120 deg", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_offset_2.pack(pady=(8, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR SECONDARY OFFSET", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_star_offset_2 = ctk.CTkSlider(self.accent_frame, from_=0, to=300, number_of_steps=300, width=380, command=self.on_star_offset_2_change)
        self.slider_star_offset_2.pack(pady=(5, 10))

        # Star Border Speed
        self.lbl_star_speed = ctk.CTkLabel(self.accent_frame, text="10.0s", font=("Inter", 20, "bold"), text_color="white")
        self.lbl_star_speed.pack(pady=(8, 0))
        ctk.CTkLabel(self.accent_frame, text="STAR BORDER SPEED", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_star_speed = ctk.CTkSlider(self.accent_frame, from_=2.0, to=30.0, number_of_steps=280, width=380, command=self.on_star_speed_change)
        self.slider_star_speed.pack(pady=(5, 20))

        # === 6. Goal Settings Card (Left) ===
        self.goal_frame = ctk.CTkFrame(self.left_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.goal_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(self.goal_frame, text="GOAL CONFIGURATION", font=("Inter", 12, "bold"), text_color=COLOR_TEXT).pack(pady=(15, 0))

        # Daily Kicks Goal
        self.lbl_kicks_goal = ctk.CTkLabel(self.goal_frame, text="10,000", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_kicks_goal.pack(pady=(10, 0))
        ctk.CTkLabel(self.goal_frame, text="DAILY KICKS GOAL", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_kicks_goal = ctk.CTkSlider(self.goal_frame, from_=1000, to=50000, number_of_steps=49, width=380, command=self.on_kicks_goal_change)
        self.slider_kicks_goal.set(10000)
        self.slider_kicks_goal.pack(pady=(5, 10))

        # Sub Goal
        self.lbl_sub_goal = ctk.CTkLabel(self.goal_frame, text="50", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_sub_goal.pack(pady=(10, 0))
        ctk.CTkLabel(self.goal_frame, text="SUB GOAL TARGET", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_sub_goal = ctk.CTkSlider(self.goal_frame, from_=5, to=500, number_of_steps=99, width=380, command=self.on_sub_goal_change)
        self.slider_sub_goal.set(50)
        self.slider_sub_goal.pack(pady=(5, 30))

        # === Right Column Section ===
        
        # GLOW CONTROLS CARD
        self.glow_frame = ctk.CTkFrame(self.right_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.glow_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(self.glow_frame, text="GLOW EFFECTS", font=("Inter", 14, "bold"), text_color=COLOR_TEXT).pack(pady=(20, 15))
        
        self.sw_glow_kick_dock = ctk.CTkSwitch(self.glow_frame, text="DAILY KICKS DOCK STAR BORDER", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_glow_kick_dock.pack(pady=15, padx=30, anchor="w")
        
        self.sw_glow_sub_dock = ctk.CTkSwitch(self.glow_frame, text="SUB GOAL DOCK STAR BORDER", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_glow_sub_dock.pack(pady=15, padx=30, anchor="w")
        
        self.sw_glow_kick_rect = ctk.CTkSwitch(self.glow_frame, text="DAILY KICKS RECT GLOW", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_glow_kick_rect.pack(pady=15, padx=30, anchor="w")
        
        self.sw_glow_sub_rect = ctk.CTkSwitch(self.glow_frame, text="SUB GOAL BAR GLOW", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_glow_sub_rect.pack(pady=15, padx=30, anchor="w")
        
        ctk.CTkLabel(self.glow_frame, text="", height=10).pack() 

        # === BORDER OUTLINES CARD ===
        self.border_frame = ctk.CTkFrame(self.right_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.border_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(self.border_frame, text="BORDER OUTLINES", font=("Inter", 14, "bold"), text_color=COLOR_TEXT).pack(pady=(20, 15))
        
        self.sw_border_kick_dock = ctk.CTkSwitch(self.border_frame, text="DAILY KICKS DOCK BORDER", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_border_kick_dock.pack(pady=15, padx=30, anchor="w")
        
        self.sw_border_sub_dock = ctk.CTkSwitch(self.border_frame, text="SUB GOAL DOCK BORDER", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_border_sub_dock.pack(pady=15, padx=30, anchor="w")
        
        self.sw_border_kick_rect = ctk.CTkSwitch(self.border_frame, text="DAILY KICKS RECT BORDER", text_color=COLOR_TEXT, progress_color=COLOR_SLIDER, command=self.on_toggle_change)
        self.sw_border_kick_rect.pack(pady=15, padx=30, anchor="w")
        
        ctk.CTkLabel(self.border_frame, text="", height=10).pack()

        # VISUAL EFFECTS CARD (Right)
        self.effect_frame = ctk.CTkFrame(self.right_col, fg_color=COLOR_SURFACE, corner_radius=20)
        self.effect_frame.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(self.effect_frame, text="EXTRA EFFECTS", font=("Inter", 12, "bold"), text_color=COLOR_TEXT).pack(pady=(15, 0))
        # Gloss
        self.lbl_gloss = ctk.CTkLabel(self.effect_frame, text="100%", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_gloss.pack(pady=(10, 0))
        ctk.CTkLabel(self.effect_frame, text="GLOSSY INTENSITY", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_gloss = ctk.CTkSlider(self.effect_frame, from_=0.0, to=5.0, number_of_steps=500, width=380, command=self.on_gloss_change)
        self.slider_gloss.pack(pady=(5, 12))

        self.lbl_rim = ctk.CTkLabel(self.effect_frame, text="100%", font=("Inter", 24, "bold"), text_color="white")
        self.lbl_rim.pack(pady=(8, 0))
        ctk.CTkLabel(self.effect_frame, text="RIM LIGHT INTENSITY", font=("Inter", 10), text_color=COLOR_TEXT).pack()
        self.slider_rim = ctk.CTkSlider(self.effect_frame, from_=0.0, to=3.0, number_of_steps=300, width=380, command=self.on_rim_change)
        self.slider_rim.pack(pady=(5, 30))

        # === SAVE PERSISTENT DEFAULTS ===
        self.save_frame = ctk.CTkFrame(self.right_col, fg_color="transparent")
        self.save_frame.pack(fill="x", padx=10, pady=20)
        
        self.btn_save = ctk.CTkButton(
            self.save_frame, text="SAVE AS DEFAULT", 
            font=("Inter", 14, "bold"), fg_color="#1a1a1a", border_width=2, border_color="#333333",
            hover_color=COLOR_SLIDER, text_color="white", height=60, corner_radius=15,
            command=self.save_defaults
        )
        self.btn_save.pack(fill="x", padx=20, pady=(0, 10))

        self.btn_restore = ctk.CTkButton(
            self.save_frame, text="RESTORE DEFAULTS",
            font=("Inter", 14, "bold"), fg_color="#151515", border_width=2, border_color="#333333",
            hover_color="#2a2a2a", text_color="white", height=52, corner_radius=15,
            command=self.restore_defaults
        )
        self.btn_restore.pack(fill="x", padx=20)

        # Status Bar
        self.lbl_status = ctk.CTkLabel(
            self, text="READY", 
            font=("Inter", 10), text_color=COLOR_TEXT
        )
        self.lbl_status.grid(row=2, column=0, pady=5, sticky="s")
        
        self.load_initial_hue()
        self.is_loading = False


    def set_app_window(self):
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
        except:
            pass

    def setup_icon(self):
        try:
            logo_path = resolve_logo_path()
            if not logo_path:
                return

            # 1. Set internal window icon (Title bar, Alt-Tab)
            pil_img = Image.open(logo_path).convert("RGBA")
            self.logo_img_ctk = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(160, 160))
            
            # Background Logo (large + transparent)
            faded = pil_img.copy()
            alpha = faded.split()[3].point(lambda p: int(p * 0.12))
            faded.putalpha(alpha)
            bg_logo_size = (1100, 1100)
            self.bg_logo_ctk = ctk.CTkImage(light_image=faded, dark_image=faded, size=bg_logo_size)
            self.lbl_bg_logo.configure(image=self.bg_logo_ctk)
            self.lbl_bg_logo.lift(self.canvas_bg)
            
            # To simulate 3D/Opacity, we can blend the image with background if PIL is used
            # For now, let's keep it simple with self.bg_logo_ctk and place it under
            
            # 2. Generate temp .ico for Taskbar
            temp_ico = os.path.join(os.getenv('TEMP'), "hue_ctrl_temp.ico")
            pil_img.save(temp_ico, format='ICO', sizes=[(256, 256)])
            try:
                self.iconbitmap(temp_ico)
            except:
                pass # Iconbitmap sometimes fails on some persistent windows
            
            # 3. Set Logo in UI (Inside Scroll Frame)
            self.lbl_logo = ctk.CTkLabel(self.logo_frame, image=self.logo_img_ctk, text="")
            self.lbl_logo.pack()
            
        except:
            pass

    def on_window_resize(self, event):
        if self.resize_job is not None:
            self.after_cancel(self.resize_job)
        self.resize_job = self.after(33, self.draw_gradient)
        # Update background logo position if needed (already anchored center)

    def draw_gradient(self, event=None):
        self.resize_job = None
        self.canvas_bg.delete("gradient")
        w = self.winfo_width()
        h = self.winfo_height()
        
        # Black to Dark Grey
        limit = h
        for i in range(limit):
            # Calculate color from black (0,0,0) to dark grey (40,40,40)
            rel = i / limit
            c = int(40 * rel)
            color = f"#{c:02x}{c:02x}{c:02x}"
            # Draw from bottom up to invert (darker at bottom as requested)
            self.canvas_bg.create_line(0, h-i, w, h-i, fill=color, tags="gradient")

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
                return

            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Use more robust regex that doesn't rely on 'window.' or ';'
                # and handles potential missing values by providing defaults
                self.current_hue = int(re.search(r'GLOBAL_HUE_OFFSET\s*=\s*(\d+)', content).group(1)) if re.search(r'GLOBAL_HUE_OFFSET\s*=\s*(\d+)', content) else 0
                self.current_brightness = float(re.search(r'GLOBAL_BRIGHTNESS\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'GLOBAL_BRIGHTNESS\s*=\s*([\d\.]+)', content) else 1.0
                self.current_color_brightness = float(re.search(r'GLOBAL_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'GLOBAL_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content) else 1.0
                self.current_color_saturation = float(re.search(r'GLOBAL_COLOR_SATURATION\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'GLOBAL_COLOR_SATURATION\s*=\s*([\d\.]+)', content) else 1.0
                self.star_hue = int(re.search(r'STAR_HUE_OFFSET\s*=\s*(\d+)', content).group(1)) if re.search(r'STAR_HUE_OFFSET\s*=\s*(\d+)', content) else 190
                self.star_shade = float(re.search(r'STAR_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'STAR_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content) else 1.0
                self.star_secondary_hue = int(re.search(r'STAR_SECONDARY_HUE_OFFSET\s*=\s*(\d+)', content).group(1)) if re.search(r'STAR_SECONDARY_HUE_OFFSET\s*=\s*(\d+)', content) else 205
                self.star_secondary_shade = float(re.search(r'STAR_SECONDARY_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'STAR_SECONDARY_COLOR_BRIGHTNESS\s*=\s*([\d\.]+)', content) else 1.6
                self.star_secondary_offset = int(re.search(r'STAR_SECONDARY_OFFSET_DEG\s*=\s*(\d+)', content).group(1)) if re.search(r'STAR_SECONDARY_OFFSET_DEG\s*=\s*(\d+)', content) else 120
                self.star_spin_speed = float(re.search(r'STAR_SPIN_SPEED\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'STAR_SPIN_SPEED\s*=\s*([\d\.]+)', content) else 10.0
                self.gloss_intensity = float(re.search(r'GLOSSY_INTENSITY\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'GLOSSY_INTENSITY\s*=\s*([\d\.]+)', content) else 1.0
                self.rim_light_intensity = float(re.search(r'RIM_LIGHT_INTENSITY\s*=\s*([\d\.]+)', content).group(1)) if re.search(r'RIM_LIGHT_INTENSITY\s*=\s*([\d\.]+)', content) else 1.0
                self.daily_kicks_goal = int(re.search(r'DAILY_KICKS_GOAL\s*=\s*(\d+)', content).group(1)) if re.search(r'DAILY_KICKS_GOAL\s*=\s*(\d+)', content) else 10000
                self.sub_goal_config = int(re.search(r'SUB_GOAL_CONFIG\s*=\s*(\d+)', content).group(1)) if re.search(r'SUB_GOAL_CONFIG\s*=\s*(\d+)', content) else 50
                
                # Glows
                m1 = re.search(r'GLOW_KICK_DOCK\s*=\s*(true|false)', content)
                m2 = re.search(r'GLOW_SUB_DOCK\s*=\s*(true|false)', content)
                m3 = re.search(r'GLOW_KICK_RECT\s*=\s*(true|false)', content)
                m4 = re.search(r'GLOW_SUB_RECT\s*=\s*(true|false)', content)
                
                if m1 and "true" in m1.group(1): self.sw_glow_kick_dock.select()
                else: self.sw_glow_kick_dock.deselect()
                if m2 and "true" in m2.group(1): self.sw_glow_sub_dock.select()
                else: self.sw_glow_sub_dock.deselect()
                if m3 and "true" in m3.group(1): self.sw_glow_kick_rect.select()
                else: self.sw_glow_kick_rect.deselect()
                if m4 and "true" in m4.group(1): self.sw_glow_sub_rect.select()
                else: self.sw_glow_sub_rect.deselect()

                # Borders
                b1 = re.search(r'SHOW_BORDER_KICK_DOCK\s*=\s*(true|false)', content)
                b2 = re.search(r'SHOW_BORDER_SUB_DOCK\s*=\s*(true|false)', content)
                b3 = re.search(r'SHOW_BORDER_KICK_RECT\s*=\s*(true|false)', content)

                if b1 and "true" in b1.group(1): self.sw_border_kick_dock.select()
                else: self.sw_border_kick_dock.deselect()

                if b2 and "true" in b2.group(1): self.sw_border_sub_dock.select()
                else: self.sw_border_sub_dock.deselect()

                if b3 and "true" in b3.group(1): self.sw_border_kick_rect.select()
                else: self.sw_border_kick_rect.deselect()

                # Set slider positions
                self.slider.set(self.current_hue)
                self.slider_bright.set(self.current_brightness)
                self.slider_shade.set(self.current_color_brightness)
                self.slider_sat.set(self.current_color_saturation)
                self.slider_star_hue.set(self.star_hue)
                self.slider_star_shade.set(self.star_shade)
                self.slider_star_hue_2.set(self.star_secondary_hue)
                self.slider_star_shade_2.set(self.star_secondary_shade)
                self.slider_star_offset_2.set(self.star_secondary_offset)
                self.slider_star_speed.set(self.star_spin_speed)
                self.slider_gloss.set(self.gloss_intensity)
                self.slider_rim.set(self.rim_light_intensity)
                self.slider_kicks_goal.set(self.daily_kicks_goal)
                self.slider_sub_goal.set(self.sub_goal_config)

                self.lbl_value.configure(text=f"{self.current_hue} deg")
                self.lbl_bright_val.configure(text=f"{int(self.current_brightness*100)}%")
                self.lbl_shade_val.configure(text=f"{int(self.current_color_brightness*100)}%")
                self.lbl_sat_val.configure(text=f"{int(self.current_color_saturation*100)}%")
                self.lbl_star_hue.configure(text=f"{self.star_hue} deg")
                self.lbl_star_shade.configure(text=f"{int(self.star_shade*100)}%")
                self.lbl_star_hue_2.configure(text=f"{self.star_secondary_hue} deg")
                self.lbl_star_shade_2.configure(text=f"{int(self.star_secondary_shade*100)}%")
                self.lbl_star_offset_2.configure(text=f"{self.star_secondary_offset} deg")
                self.lbl_gloss.configure(text=f"{int(self.gloss_intensity*100)}%")
                self.lbl_rim.configure(text=f"{int(self.rim_light_intensity*100)}%")
                self.lbl_kicks_goal.configure(text=f"{self.daily_kicks_goal:,}")
                self.lbl_sub_goal.configure(text=f"{self.sub_goal_config}")

        except Exception as e:
            print(f"Load Settings error: {e}")
            self.current_hue = DEFAULTS["GLOBAL_HUE_OFFSET"]
            self.current_brightness = DEFAULTS["GLOBAL_BRIGHTNESS"]
            self.current_color_brightness = DEFAULTS["GLOBAL_COLOR_BRIGHTNESS"]
            self.current_color_saturation = DEFAULTS["GLOBAL_COLOR_SATURATION"]
            self.star_hue = DEFAULTS["STAR_HUE_OFFSET"]
            self.star_shade = DEFAULTS["STAR_COLOR_BRIGHTNESS"]
            self.star_secondary_hue = DEFAULTS["STAR_SECONDARY_HUE_OFFSET"]
            self.star_secondary_shade = DEFAULTS["STAR_SECONDARY_COLOR_BRIGHTNESS"]
            self.star_secondary_offset = DEFAULTS["STAR_SECONDARY_OFFSET_DEG"]
            self.star_spin_speed = DEFAULTS["STAR_SPIN_SPEED"]
            self.gloss_intensity = DEFAULTS["GLOSSY_INTENSITY"]
            self.rim_light_intensity = DEFAULTS["RIM_LIGHT_INTENSITY"]

    def on_slider_change(self, value):
        self.current_hue = int(float(value))
        self.lbl_value.configure(text=f"{self.current_hue} deg")
        self.debounce_write()

    def on_brightness_change(self, value):
        # Value is 0.2 to 2.0
        self.current_brightness = round(float(value), 2)
        self.lbl_bright_val.configure(text=f"{int(self.current_brightness*100)}%")
        self.debounce_write()

    def on_shade_change(self, value):
        self.current_color_brightness = round(float(value), 2)
        self.lbl_shade_val.configure(text=f"{int(self.current_color_brightness*100)}%")
        self.debounce_write()

    def on_saturation_change(self, value):
        self.current_color_saturation = round(float(value), 2)
        self.lbl_sat_val.configure(text=f"{int(self.current_color_saturation*100)}%")
        self.debounce_write()

    def on_star_hue_change(self, value):
        self.star_hue = int(float(value))
        self.lbl_star_hue.configure(text=f"{self.star_hue} deg")
        self.debounce_write()

    def on_star_shade_change(self, value):
        self.star_shade = round(float(value), 2)
        self.lbl_star_shade.configure(text=f"{int(self.star_shade*100)}%")
        self.debounce_write()

    def on_star_hue_2_change(self, value):
        self.star_secondary_hue = int(float(value))
        self.lbl_star_hue_2.configure(text=f"{self.star_secondary_hue} deg")
        self.debounce_write()

    def on_star_shade_2_change(self, value):
        self.star_secondary_shade = round(float(value), 2)
        self.lbl_star_shade_2.configure(text=f"{int(self.star_secondary_shade*100)}%")
        self.debounce_write()

    def on_star_offset_2_change(self, value):
        self.star_secondary_offset = int(float(value))
        self.lbl_star_offset_2.configure(text=f"{self.star_secondary_offset} deg")
        self.debounce_write()

    def on_star_speed_change(self, value):
        self.star_spin_speed = round(float(value), 1)
        self.lbl_star_speed.configure(text=f"{self.star_spin_speed:.1f}s")
        self.debounce_write()

    def on_gloss_change(self, value):
        self.gloss_intensity = round(float(value), 2)
        self.lbl_gloss.configure(text=f"{int(self.gloss_intensity*100)}%")
        self.debounce_write()

    def on_rim_change(self, value):
        self.rim_light_intensity = round(float(value), 2)
        self.lbl_rim.configure(text=f"{int(self.rim_light_intensity*100)}%")
        self.debounce_write()

    def on_kicks_goal_change(self, value):
        self.daily_kicks_goal = int(float(value))
        self.lbl_kicks_goal.configure(text=f"{self.daily_kicks_goal:,}")
        self.debounce_write()

    def on_sub_goal_change(self, value):
        self.sub_goal_config = int(float(value))
        self.lbl_sub_goal.configure(text=f"{self.sub_goal_config}")
        self.debounce_write()

    def on_toggle_change(self):
        if self.pending_write_job is not None:
            self.after_cancel(self.pending_write_job)
            self.pending_write_job = None
        self.write_settings()

    def debounce_write(self):
        if self.is_loading:
            return
        if self.pending_write_job is not None:
            self.after_cancel(self.pending_write_job)
        self.pending_write_job = self.after(int(self.write_delay * 1000), self._flush_pending_write)

    def _flush_pending_write(self):
        self.pending_write_job = None
        self.write_settings()

    def _set_js_assignment(self, content, key, value):
        pattern = rf'(window\.{re.escape(key)}\s*=\s*)([^;]+)(;)'
        replacement = rf'\g<1>{value}\g<3>'
        new_content, count = re.subn(pattern, replacement, content)
        if count == 0:
            suffix = "" if new_content.endswith("\n") else "\n"
            new_content += f"{suffix}window.{key} = {value};\n"
        return new_content

    def write_settings(self, is_default=False):
        try:
            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
            values = {
                "GLOBAL_HUE_OFFSET": str(self.current_hue),
                "GLOBAL_BRIGHTNESS": f"{self.current_brightness:.2f}",
                "GLOBAL_COLOR_BRIGHTNESS": f"{self.current_color_brightness:.2f}",
                "GLOBAL_COLOR_SATURATION": f"{self.current_color_saturation:.2f}",
                "STAR_HUE_OFFSET": str(self.star_hue),
                "STAR_COLOR_BRIGHTNESS": f"{self.star_shade:.2f}",
                "STAR_SECONDARY_HUE_OFFSET": str(self.star_secondary_hue),
                "STAR_SECONDARY_COLOR_BRIGHTNESS": f"{self.star_secondary_shade:.2f}",
                "STAR_SECONDARY_OFFSET_DEG": str(self.star_secondary_offset),
                "STAR_SPIN_SPEED": f"{self.star_spin_speed:.1f}",
                "GLOSSY_INTENSITY": f"{self.gloss_intensity:.2f}",
                "RIM_LIGHT_INTENSITY": f"{self.rim_light_intensity:.2f}",
                "DAILY_KICKS_GOAL": str(self.daily_kicks_goal),
                "SUB_GOAL_CONFIG": str(self.sub_goal_config),
                "GLOW_KICK_DOCK": "true" if self.sw_glow_kick_dock.get() else "false",
                "GLOW_SUB_DOCK": "true" if self.sw_glow_sub_dock.get() else "false",
                "GLOW_KICK_RECT": "true" if self.sw_glow_kick_rect.get() else "false",
                "GLOW_SUB_RECT": "true" if self.sw_glow_sub_rect.get() else "false",
                "SHOW_BORDER_KICK_DOCK": "true" if self.sw_border_kick_dock.get() else "false",
                "SHOW_BORDER_SUB_DOCK": "true" if self.sw_border_sub_dock.get() else "false",
                "SHOW_BORDER_KICK_RECT": "true" if self.sw_border_kick_rect.get() else "false",
            }
            if is_default:
                values["GLOBAL_HUE_DEFAULT"] = str(self.current_hue)

            payload = tuple(sorted(values.items()))
            if not is_default and payload == self.last_saved_payload:
                return

            for key, value in values.items():
                content = self._set_js_assignment(content, key, value)

            settings_dir = os.path.dirname(SETTINGS_PATH)
            with tempfile.NamedTemporaryFile("w", delete=False, dir=settings_dir, suffix=".tmp", encoding="utf-8") as tf:
                tf.write(content)
                temp_path = tf.name
            os.replace(temp_path, SETTINGS_PATH)
            self.last_saved_payload = payload
            self.lbl_status.configure(text="SETTINGS PERSISTED" if is_default else "SYNCING...")
        except Exception as e:
            print(f"Write Settings error: {e}")
            self.lbl_status.configure(text="ERROR WRITING FILE")

    def save_defaults(self):
        self.write_settings(is_default=True)
        self.lbl_status.configure(text="DEFAULTS SAVED!")

    def restore_defaults(self):
        self.is_loading = True
        try:
            self.current_hue = DEFAULTS["GLOBAL_HUE_OFFSET"]
            self.current_brightness = DEFAULTS["GLOBAL_BRIGHTNESS"]
            self.current_color_brightness = DEFAULTS["GLOBAL_COLOR_BRIGHTNESS"]
            self.current_color_saturation = DEFAULTS["GLOBAL_COLOR_SATURATION"]
            self.star_hue = DEFAULTS["STAR_HUE_OFFSET"]
            self.star_shade = DEFAULTS["STAR_COLOR_BRIGHTNESS"]
            self.star_secondary_hue = DEFAULTS["STAR_SECONDARY_HUE_OFFSET"]
            self.star_secondary_shade = DEFAULTS["STAR_SECONDARY_COLOR_BRIGHTNESS"]
            self.star_secondary_offset = DEFAULTS["STAR_SECONDARY_OFFSET_DEG"]
            self.star_spin_speed = DEFAULTS["STAR_SPIN_SPEED"]
            self.gloss_intensity = DEFAULTS["GLOSSY_INTENSITY"]
            self.rim_light_intensity = DEFAULTS["RIM_LIGHT_INTENSITY"]
            self.daily_kicks_goal = DEFAULTS["DAILY_KICKS_GOAL"]
            self.sub_goal_config = DEFAULTS["SUB_GOAL_CONFIG"]

            self.slider.set(self.current_hue)
            self.slider_bright.set(self.current_brightness)
            self.slider_shade.set(self.current_color_brightness)
            self.slider_sat.set(self.current_color_saturation)
            self.slider_star_hue.set(self.star_hue)
            self.slider_star_shade.set(self.star_shade)
            self.slider_star_hue_2.set(self.star_secondary_hue)
            self.slider_star_shade_2.set(self.star_secondary_shade)
            self.slider_star_offset_2.set(self.star_secondary_offset)
            self.slider_star_speed.set(self.star_spin_speed)
            self.slider_gloss.set(self.gloss_intensity)
            self.slider_rim.set(self.rim_light_intensity)
            self.slider_kicks_goal.set(self.daily_kicks_goal)
            self.slider_sub_goal.set(self.sub_goal_config)

            self.lbl_value.configure(text=f"{self.current_hue} deg")
            self.lbl_bright_val.configure(text=f"{int(self.current_brightness*100)}%")
            self.lbl_shade_val.configure(text=f"{int(self.current_color_brightness*100)}%")
            self.lbl_sat_val.configure(text=f"{int(self.current_color_saturation*100)}%")
            self.lbl_star_hue.configure(text=f"{self.star_hue} deg")
            self.lbl_star_shade.configure(text=f"{int(self.star_shade*100)}%")
            self.lbl_star_hue_2.configure(text=f"{self.star_secondary_hue} deg")
            self.lbl_star_shade_2.configure(text=f"{int(self.star_secondary_shade*100)}%")
            self.lbl_star_offset_2.configure(text=f"{self.star_secondary_offset} deg")
            self.lbl_star_speed.configure(text=f"{self.star_spin_speed:.1f}s")
            self.lbl_gloss.configure(text=f"{int(self.gloss_intensity*100)}%")
            self.lbl_rim.configure(text=f"{int(self.rim_light_intensity*100)}%")
            self.lbl_kicks_goal.configure(text=f"{self.daily_kicks_goal:,}")
            self.lbl_sub_goal.configure(text=f"{self.sub_goal_config}")

            if DEFAULTS["GLOW_KICK_DOCK"]:
                self.sw_glow_kick_dock.select()
            else:
                self.sw_glow_kick_dock.deselect()
            if DEFAULTS["GLOW_SUB_DOCK"]:
                self.sw_glow_sub_dock.select()
            else:
                self.sw_glow_sub_dock.deselect()
            if DEFAULTS["GLOW_KICK_RECT"]:
                self.sw_glow_kick_rect.select()
            else:
                self.sw_glow_kick_rect.deselect()
            if DEFAULTS["GLOW_SUB_RECT"]:
                self.sw_glow_sub_rect.select()
            else:
                self.sw_glow_sub_rect.deselect()
            if DEFAULTS["SHOW_BORDER_KICK_DOCK"]:
                self.sw_border_kick_dock.select()
            else:
                self.sw_border_kick_dock.deselect()
            if DEFAULTS["SHOW_BORDER_SUB_DOCK"]:
                self.sw_border_sub_dock.select()
            else:
                self.sw_border_sub_dock.deselect()
            if DEFAULTS["SHOW_BORDER_KICK_RECT"]:
                self.sw_border_kick_rect.select()
            else:
                self.sw_border_kick_rect.deselect()
        finally:
            self.is_loading = False

        if self.pending_write_job is not None:
            self.after_cancel(self.pending_write_job)
            self.pending_write_job = None
        self.write_settings()
        self.lbl_status.configure(text="RESTORED TO DEFAULTS")

if __name__ == "__main__":
    c = HueControllerApp()
    c.mainloop()

