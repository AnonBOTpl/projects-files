import os
import json
from PyQt6.QtWidgets import *
from PyQt6.QtCore import Qt, pyqtSignal, QSize, QRect, QPoint
from PyQt6.QtGui import (
    QPixmap, QIcon, QFont, QColor, QPalette, QPainter, QPen, QBrush,
    QImage, QIntValidator, QUndoStack, QUndoCommand, QPainterPath
)
from PIL import Image as PILImage
from utils import qimage_to_pil
from config import logger, settings, get_style, tr

class WelcomeDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("welcome_title"))
        self.setMinimumSize(450, 300)

        layout = QVBoxLayout(self)
        lbl_welcome = QLabel(tr("welcome_header"))
        lbl_welcome.setStyleSheet("font-size: 24px; font-weight: bold; color: #00d4ff;")
        lbl_welcome.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(lbl_welcome)

        layout.addWidget(QLabel(tr("welcome_lang")))
        self.lang_combo = QComboBox()
        self.lang_combo.addItem("Polski", "pl")
        self.lang_combo.addItem("English", "en")
        layout.addWidget(self.lang_combo)

        layout.addWidget(QLabel(tr("welcome_theme")))
        self.theme_combo = QComboBox()
        self.theme_combo.addItem(tr("theme_dark"), "dark")
        self.theme_combo.addItem(tr("theme_light"), "light")
        layout.addWidget(self.theme_combo)

        layout.addStretch()
        btn_finish = QPushButton(tr("btn_finish"))
        btn_finish.setObjectName("GenerateBtn")
        btn_finish.clicked.connect(self.save_and_close)
        layout.addWidget(btn_finish)

    def save_and_close(self):
        lang = self.lang_combo.currentData()
        theme = self.theme_combo.currentData()
        settings.set('UI', 'language', lang)
        settings.set('UI', 'theme', theme)
        settings.save()
        self.accept()

class SettingsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("settings_title"))
        self.setMinimumSize(600, 450)
        self.parent_win = parent

        layout = QVBoxLayout(self)
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs)

        # 1. Performance
        perf_tab = QWidget(); self.tabs.addTab(perf_tab, tr("settings_tab_perf")); perf_l = QVBoxLayout(perf_tab)
        self.vram_slice = QCheckBox(tr("settings_vram_slice"))
        self.vram_slice.setChecked(settings.get_bool('Performance', 'vram_slicing'))
        perf_l.addWidget(self.vram_slice); perf_l.addStretch()

        # 2. Paths
        paths_tab = QWidget(); self.tabs.addTab(paths_tab, tr("settings_tab_paths")); paths_l = QVBoxLayout(paths_tab)
        self.path_edits = {}
        for key, val in settings.config['Paths'].items():
            h = QHBoxLayout()
            h.addWidget(QLabel(key.replace('_', ' ').title() + ":"))
            edit = QLineEdit(val); self.path_edits[key] = edit
            h.addWidget(edit)
            btn = QPushButton("..."); btn.setFixedWidth(30)
            btn.clicked.connect(lambda checked, k=key: self.browse_path(k))
            h.addWidget(btn)
            paths_l.addLayout(h)
        paths_l.addStretch()

        # 3. Preferences
        pref_tab = QWidget(); self.tabs.addTab(pref_tab, tr("settings_tab_pref")); pref_l = QVBoxLayout(pref_tab)
        self.sampler_combo = QComboBox(); self.sampler_combo.addItems(["DPM++ 2M", "Euler", "Euler a", "DDIM"])
        self.sampler_combo.setCurrentText(settings.get('Generation', 'default_sampler'))
        self.sched_combo = QComboBox(); self.sched_combo.addItems(["Normal", "Karras", "Exponential"])
        self.sched_combo.setCurrentText(settings.get('Generation', 'default_scheduler'))
        pref_l.addWidget(QLabel(tr("settings_default_sampler"))); pref_l.addWidget(self.sampler_combo)
        pref_l.addWidget(QLabel(tr("settings_default_scheduler"))); pref_l.addWidget(self.sched_combo)
        pref_l.addStretch()

        # 4. Appearance
        ui_tab = QWidget(); self.tabs.addTab(ui_tab, tr("settings_tab_ui")); ui_l = QVBoxLayout(ui_tab)

        ui_l.addWidget(QLabel(tr("settings_lang")))
        self.lang_combo = QComboBox()
        self.lang_combo.addItem("Polski", "pl")
        self.lang_combo.addItem("English", "en")
        self.lang_combo.setCurrentIndex(0 if settings.get('UI', 'language') == 'pl' else 1)
        ui_l.addWidget(self.lang_combo)

        lbl_info = QLabel(tr("settings_restart_info"))
        lbl_info.setStyleSheet("color: #888; font-size: 10px; font-style: italic;")
        ui_l.addWidget(lbl_info)

        ui_l.addWidget(QLabel(tr("settings_theme")))
        self.theme_combo = QComboBox()
        self.theme_combo.addItem("dark", "dark")
        self.theme_combo.addItem("light", "light")
        self.theme_combo.setCurrentText(settings.get('UI', 'theme'))
        ui_l.addWidget(self.theme_combo)

        self.accent_btn = QPushButton(tr("settings_accent"))
        self.curr_accent = settings.get('UI', 'accent_color')
        self.accent_btn.setStyleSheet(f"background-color: {self.curr_accent}; color: black; border: 2px solid white;")
        self.accent_btn.clicked.connect(self.pick_color)
        ui_l.addWidget(self.accent_btn)
        ui_l.addStretch()

        # Bottom Buttons
        btn_box = QHBoxLayout()
        btn_imp = QPushButton(tr("btn_import")); btn_imp.clicked.connect(self.import_settings)
        btn_exp = QPushButton(tr("btn_export")); btn_exp.clicked.connect(self.export_settings)
        btn_save = QPushButton(tr("btn_save_close")); btn_save.setObjectName("GenerateBtn")
        btn_save.clicked.connect(self.save_and_close)
        btn_box.addWidget(btn_imp); btn_box.addWidget(btn_exp); btn_box.addStretch(); btn_box.addWidget(btn_save)
        layout.addLayout(btn_box)

    def browse_path(self, key):
        d = QFileDialog.getExistingDirectory(self, tr("dialog_select_dir"), self.path_edits[key].text())
        if d: self.path_edits[key].setText(d)

    def pick_color(self):
        c = QColorDialog.getColor(QColor(self.curr_accent), self)
        if c.isValid():
            self.curr_accent = c.name()
            self.accent_btn.setStyleSheet(f"background-color: {self.curr_accent}; color: black; border: 2px solid white;")

    def save_and_close(self):
        settings.set('Performance', 'vram_slicing', self.vram_slice.isChecked())
        for k, edit in self.path_edits.items():
            p = edit.text()
            settings.set('Paths', k, p)
            os.makedirs(p, exist_ok=True)
        settings.set('Generation', 'default_sampler', self.sampler_combo.currentText())
        settings.set('Generation', 'default_scheduler', self.sched_combo.currentText())
        settings.set('UI', 'language', self.lang_combo.currentData())
        settings.set('UI', 'theme', self.theme_combo.currentText())
        settings.set('UI', 'accent_color', self.curr_accent)
        settings.save()

        
        if self.parent_win:
            self.parent_win.apply_settings_ui()
        self.accept()

    def import_settings(self):
        f, _ = QFileDialog.getOpenFileName(self, tr("dialog_import_settings"), "", "INI Files (*.ini)")
        if f: settings.import_settings(f); self.accept()

    def export_settings(self):
        f, _ = QFileDialog.getSaveFileName(self, tr("dialog_export_settings"), "settings_backup.ini", "INI Files (*.ini)")
        if f: settings.export_settings(f)

class FloatingTips(QDialog):
    def __init__(self, title, file_path, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setWindowFlags(Qt.WindowType.Tool | Qt.WindowType.WindowStaysOnTopHint)
        self.setStyleSheet("background-color: #1e1e1e; border: 1px solid #333;")
        self.setMinimumWidth(400)

        l = QVBoxLayout(self)
        self.browser = QTextBrowser()
        self.browser.setStyleSheet("background-color: transparent; border: none; color: #e0e0e0;")
        self.browser.setOpenExternalLinks(True)

        content = ""
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception as e:
                content = f"Błąd odczytu pliku: {e}"
        else:
            content = f"Brak pliku wskazówek: {file_path}"

        if file_path.endswith(".html"):
            self.browser.setHtml(content)
        else:
            self.browser.setPlainText(content)

        l.addWidget(self.browser)

        btn_close = QPushButton(tr("btn_close"))
        btn_close.clicked.connect(self.close)
        l.addWidget(btn_close)

        # Auto-rozmiar wysokości
        self.browser.document().contentsChanged.connect(self.adjust_height)
        self.adjust_height()

    def adjust_height(self):
        doc_height = self.browser.document().size().height()
        target_height = min(int(doc_height) + 100, 600)
        self.resize(self.width(), target_height)

class GalleryDetailWindow(QDialog):
    def __init__(self, path, parent=None):
        super().__init__(parent)
        self.setWindowTitle(tr("gallery_details_title"))
        self.setWindowFlags(Qt.WindowType.Tool)
        self.setStyleSheet("background-color: #1e1e1e;")
        self.setMinimumSize(900, 600)
        self.path = path
        self.parent_win = parent

        l = QHBoxLayout(self)

        # Lewa strona - podgląd
        self.preview = QLabel()
        self.preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pix = QPixmap(path)
        self.preview.setPixmap(pix.scaled(500, 500, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        l.addWidget(self.preview, 1)

        # Prawa strona - parametry
        r_l = QVBoxLayout()
        self.browser = QTextBrowser()
        self.browser.setStyleSheet("background-color: #121212; border: none; color: #00d4ff; font-family: Consolas, monospace;")

        self.params = {}
        try:
            img = PILImage.open(path)
            raw_params = img.text.get("sd_params")
            if raw_params:
                self.params = json.loads(raw_params)
                text = f"<h3>{tr('gallery_params_header')}</h3><hr>"
                for k, v in self.params.items():
                    text += f"<b>{k.upper()}:</b> {v}<br>"
                self.browser.setHtml(text)
            else:
                self.browser.setPlainText(tr("gallery_no_meta"))
        except Exception as e:
            self.browser.setPlainText(f"{tr('gallery_read_error')}{e}")

        r_l.addWidget(self.browser)

        btn_send = QPushButton(tr("btn_send_to_t2i"))
        btn_send.setObjectName("GenerateBtn")
        btn_send.clicked.connect(self.send_to_t2i)
        r_l.addWidget(btn_send)

        l.addLayout(r_l, 1)

    def send_to_t2i(self):
        if not self.params: return
        w = self.parent_win
        w.t2i_prompt.setPlainText(self.params.get("prompt", ""))
        w.t2i_neg.setPlainText(self.params.get("neg_prompt", ""))
        w.s_steps.spin.setValue(int(self.params.get("steps", 20)))
        w.s_cfg.spin.setValue(float(self.params.get("cfg", 6.0)))
        w.s_w.spin.setValue(int(self.params.get("width", 512)))
        w.s_h.spin.setValue(int(self.params.get("height", 512)))
        w.s_seed.setText(str(self.params.get("seed", -1)))

        sampler = self.params.get("sampler")
        if sampler:
            idx = w.sampler_combo.findText(sampler)
            if idx >= 0: w.sampler_combo.setCurrentIndex(idx)

        scheduler = self.params.get("scheduler")
        if scheduler:
            idx = w.scheduler_combo.findText(scheduler)
            if idx >= 0: w.scheduler_combo.setCurrentIndex(idx)

        w.tabs.setCurrentIndex(0)
        self.close()

class ImageViewer(QDialog):
    def __init__(self, pixmap, parent=None):
        super().__init__(parent)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Dialog); self.setStyleSheet("background-color: rgba(0, 0, 0, 240);")
        # Centrowanie na ekranie
        screen_geo = self.screen().availableGeometry()
        self.setGeometry(screen_geo)

        l = QVBoxLayout(self); l.setContentsMargins(0,0,0,0); self.label = QLabel(); self.label.setAlignment(Qt.AlignmentFlag.AlignCenter); self.label.setPixmap(pixmap.scaled(self.screen().availableGeometry().size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)); l.addWidget(self.label)
        self.show()
    def mousePressEvent(self, e): self.accept()
    def keyPressEvent(self, e):
        if e.key() == Qt.Key.Key_Escape: self.accept()

class ClickableLabel(QLabel):
    clicked = pyqtSignal(QPixmap)
    def __init__(self, text="", parent=None):
        super().__init__(text, parent); self.pixmap_cached = None
    def set_image(self, path_or_pixmap):
        self.pixmap_cached = QPixmap(path_or_pixmap) if isinstance(path_or_pixmap, str) else path_or_pixmap
        if self.pixmap_cached:
            self.setPixmap(self.pixmap_cached.scaled(self.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
    def update_scaling(self):
        if self.pixmap_cached:
            self.setPixmap(self.pixmap_cached.scaled(self.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
    def mousePressEvent(self, e):
        if self.pixmap_cached: self.clicked.emit(self.pixmap_cached)

class DrawCommand(QUndoCommand):
    def __init__(self, scene, path_item):
        super().__init__()
        self.scene = scene
        self.path_item = path_item
    def redo(self):
        self.scene.addItem(self.path_item)
    def undo(self):
        self.scene.removeItem(self.path_item)

class InpaintCanvas(QGraphicsView):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene()
        self.setScene(self.scene)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setBackgroundBrush(QBrush(QColor(26, 26, 26)))

        self.base_pixmap_item = QGraphicsPixmapItem()
        self.scene.addItem(self.base_pixmap_item)

        self.undo_stack = QUndoStack(self)
        self.brush_size = 20
        self.current_path_item = None
        self.last_point = QPoint()

    def set_base_image(self, pixmap):
        scaled = pixmap.scaled(512, 512, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
        self.base_pixmap_item.setPixmap(scaled)
        self.scene.setSceneRect(0, 0, scaled.width(), scaled.height())
        # Wyczyszczenie historii przy nowym obrazie
        self.undo_stack.clear()
        # Wyczyszczenie poprzednich masek
        for item in self.scene.items():
            if isinstance(item, QGraphicsPathItem):
                self.scene.removeItem(item)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            scene_pos = self.mapToScene(event.pos())
            self.last_point = scene_pos
            path = QPainterPath()
            path.moveTo(scene_pos)

            self.current_path_item = QGraphicsPathItem()
            self.current_path_item.setPath(path)
            self.current_path_item.setPen(QPen(Qt.GlobalColor.white, self.brush_size, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap, Qt.PenJoinStyle.RoundJoin))
            self.scene.addItem(self.current_path_item)

    def mouseMoveEvent(self, event):
        if (event.buttons() & Qt.MouseButton.LeftButton) and self.current_path_item:
            scene_pos = self.mapToScene(event.pos())
            path = self.current_path_item.path()
            path.lineTo(scene_pos)
            self.current_path_item.setPath(path)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton and self.current_path_item:
            item = self.current_path_item
            self.current_path_item = None
            # Usuń tymczasowy i dodaj przez UndoStack
            self.scene.removeItem(item)
            command = DrawCommand(self.scene, item)
            self.undo_stack.push(command)

    def keyPressEvent(self, event):
        if event.modifiers() & Qt.KeyboardModifier.ControlModifier:
            if event.key() == Qt.Key.Key_Z:
                self.undo_stack.undo()
            elif event.key() == Qt.Key.Key_Y:
                self.undo_stack.redo()
        super().keyPressEvent(event)

    def get_mask_pil(self):
        # Renderowanie samej maski (bez obrazu bazowego)
        size = self.scene.sceneRect().size().toSize()
        if size.isEmpty(): return PILImage.new("L", (512, 512), 0)

        mask_image = QImage(size, QImage.Format.Format_RGBA8888)
        mask_image.fill(Qt.GlobalColor.black)

        painter = QPainter(mask_image)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Ukryj obraz bazowy na czas renderowania maski
        self.base_pixmap_item.hide()
        self.scene.render(painter)
        self.base_pixmap_item.show()
        painter.end()

        pil_mask = qimage_to_pil(mask_image).convert("L")
        binary_mask = pil_mask.point(lambda p: 255 if p > 10 else 0)
        binary_mask.save("output/debug_mask.png")
        return binary_mask

    def get_image_pil(self):
        pix = self.base_pixmap_item.pixmap()
        if pix.isNull(): return PILImage.new("RGB", (512, 512), (0,0,0))
        return qimage_to_pil(pix.toImage())

class ParameterSlider(QWidget):
    changed = pyqtSignal()
    def __init__(self, label, min_val, max_val, default, step=1, is_float=False):
        super().__init__(); l = QVBoxLayout(self); l.setContentsMargins(0, 2, 0, 2); l.setSpacing(0)
        h = QHBoxLayout(); lbl = QLabel(label); lbl.setStyleSheet("color: #aaa; font-size: 11px;"); h.addWidget(lbl); h.addStretch()
        self.spin = QDoubleSpinBox() if is_float else QSpinBox()
        self.spin.setRange(min_val, max_val); self.spin.setFixedWidth(65); self.spin.setAlignment(Qt.AlignmentFlag.AlignCenter); self.spin.setValue(default)
        if is_float: self.spin.setSingleStep(step)
        self.spin.valueChanged.connect(lambda: self.changed.emit()); h.addWidget(self.spin); l.addLayout(h)
        self.slider = QSlider(Qt.Orientation.Horizontal)
        if is_float: self.slider.setRange(int(min_val * 100), int(max_val * 100)); self.slider.setValue(int(default * 100))
        else: self.slider.setRange(min_val, max_val); self.slider.setValue(default)
        self.slider.valueChanged.connect(self.on_slider_move); self.spin.valueChanged.connect(self.on_spin_move); l.addWidget(self.slider)
    def on_slider_move(self, v):
        self.spin.blockSignals(True); self.spin.setValue(v / 100.0 if isinstance(self.spin, QDoubleSpinBox) else v); self.spin.blockSignals(False); self.changed.emit()
    def on_spin_move(self, v):
        self.slider.blockSignals(True); self.slider.setValue(int(v * 100) if isinstance(self.spin, QDoubleSpinBox) else v); self.slider.blockSignals(False); self.changed.emit()
    def value(self): return self.spin.value()

class LoRAItem(QWidget):
    removed = pyqtSignal(str); changed = pyqtSignal()
    def __init__(self, name, path):
        super().__init__(); self.name = name; self.path = path
        l = QVBoxLayout(self); l.setContentsMargins(0, 5, 0, 5); l.setSpacing(2)
        h = QHBoxLayout(); lbl = QLabel(name); lbl.setStyleSheet("font-weight: bold; color: #888; font-size: 11px;")
        btn = QPushButton("X"); btn.setObjectName("RemoveBtn"); btn.setFixedSize(16, 16); btn.clicked.connect(lambda: self.removed.emit(self.name))
        h.addWidget(lbl); h.addStretch(); h.addWidget(btn); l.addLayout(h)
        ctrls = QHBoxLayout(); ctrls.setSpacing(10); self.slider = QSlider(Qt.Orientation.Horizontal); self.slider.setRange(-100, 200); self.slider.setValue(100); self.slider.setFixedHeight(20)
        self.spin = QDoubleSpinBox(); self.spin.setRange(-1.0, 2.0); self.spin.setValue(1.0); self.spin.setFixedWidth(45); self.spin.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.slider.valueChanged.connect(self.on_changed); self.spin.valueChanged.connect(self.on_spin_changed); ctrls.addWidget(self.slider); ctrls.addWidget(self.spin); l.addLayout(ctrls)
    def on_changed(self, v): self.spin.blockSignals(True); self.spin.setValue(v / 100.0); self.spin.blockSignals(False); self.changed.emit()
    def on_spin_changed(self, v): self.slider.blockSignals(True); self.slider.setValue(int(v * 100)); self.slider.blockSignals(False); self.changed.emit()
    def weight(self): return self.spin.value()

class LoRAVisualizer(QWidget):
    def __init__(self):
        super().__init__(); self.setMinimumHeight(60); self.weights = []
    def update_weights(self, w): self.weights = w; self.update()
    def paintEvent(self, e):
        p = QPainter(self); p.setRenderHint(QPainter.RenderHint.Antialiasing); w, h = self.width(), self.height()
        p.setBrush(QBrush(QColor(25, 25, 25))); p.setPen(Qt.PenStyle.NoPen); p.drawRoundedRect(0, 0, w, h, 5, 5)
        if not self.weights: p.setPen(QColor(80, 80, 80)); p.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, tr("opt_no_lora")); return
        m = 15; count = len(self.weights); bw = (w - 2 * m) / max(count, 1)
        for i, (name, weight) in enumerate(self.weights):
            nw = max(0, min(1, (weight + 1) / 3.0)); bh = int(nw * (h - 2 * m)); x = int(m + i * bw)
            p.setBrush(QBrush(QColor(0, 212, 255))); p.drawRoundedRect(QRect(x + 5, h - m - bh, int(bw - 10), bh), 2, 2)
