# AnonGen — Stable Diffusion GUI

Nowoczesny, minimalistyczny interfejs graficzny dla Stable Diffusion 1.5, zbudowany w PyQt6. Zaprojektowany z myślą o wygodzie użytkowania, estetyce Dark Mode oraz ochronie VRAM.

## Funkcje

### Tryby generowania
- **Text2Image** — generowanie obrazów z promptu z pełną kontrolą nad samplerem, schedulerem, CFG, krokami i wymiarami.
- **Inpainting** — interaktywne płótno (`InpaintCanvas`) do rysowania masek binarnych (0/255, bez antyaliasingu). Obsługa dedykowanych modeli inpaint (`.safetensors`) oraz trybu `original` (współdzielenie komponentów z modelem głównym bez przeładowania VRAM).
- **ControlNet (Canny)** — generowanie na podstawie kompozycji z obrazu referencyjnego. Automatyczna detekcja krawędzi przez OpenCV, inteligentne skalowanie do max 512px z zachowaniem proporcji.

### Ustawienia i personalizacja
- **System Ustawień (settings.ini)** — pełna kontrola nad ścieżkami modeli, folderami zapisu oraz domyślnymi parametrami.
- **Dynamiczne Style (Motywy)** — wsparcie dla trybu ciemnego (Dark) i jasnego (Light) z możliwością wyboru własnego koloru akcentu.
- **VRAM Slicing & VAE Tiling** — opcjonalne optymalizacje wydajności dla kart z ograniczoną pamięcią (np. GTX 1060 6GB).
- **Kreator Pierwszego Uruchomienia** — automatyczny asystent konfiguracji (First Launch Wizard) przy pierwszym starcie aplikacji.

### Zarządzanie modelami
- Automatyczne skanowanie folderów zdefiniowanych w ustawieniach (domyślnie `models/stable_diffusion`, `lora`, itp.).
- Obsługa plików `.safetensors` (lokalnie) i modeli z Hugging Face Hub.
- **Inteligentne LoRA** — automatyczne przeładowywanie aktywnych adapterów po zmianie modelu głównego.

### Latent Mixology Station
- Jednoczesne ładowanie do 5 adapterów LoRA z indywidualnymi suwakami wag (zakres −1.0 do 2.0).
- Wizualizacja wag LoRA w czasie rzeczywistym (`LoRAVisualizer` — styl equalizera).
- Dynamiczne dodawanie i usuwanie LoRA bez błędu ValueError (fizyczne wyładowywanie adapterów).

### Samplery i schedulery
| Sampler | Schedulery |
|---|---|
| DPM++ 2M | Normal, Karras, Exponential |
| Euler | Normal, Karras, Exponential |
| Euler a | — |
| DDIM | — |

### Upscaler
- Integracja z biblioteką `spandrel` (ESRGAN i inne modele z `models/upscalers`).
- Obsługa formatów: `.pth`, `.pt`, `.bin`, `.onnx`, `.safetensors`, `.ckpt`.
- Tryb automatyczny (po wygenerowaniu) lub ręczny.

### VRAM Oracle
- Szacowanie zużycia pamięci GPU w czasie rzeczywistym.
- Kolorowy wskaźnik obciążenia.
- Przycisk **Auto-Optimizer** resetuje wymiary do bezpiecznych 512×512.

### Galeria i PNG Info
- Przegląd wygenerowanych obrazów w widoku miniatur.
- **PNG Info** — odczyt parametrów generowania (prompt, seed, cfg...) zaszytych w metadanych i możliwość ich przywrócenia jednym kliknięciem.

## Struktura projektu

```
AnonGen/
├── main.py          # MainWindow — główne okno, zakładki, logika UI
├── engine.py        # DiffusionEngine — ładowanie modeli, generowanie
├── worker.py        # QThread: GenerationWorker, InpaintWorker, itp.
├── widgets.py       # Komponenty UI: Dialogi, Canvas, Slidery, Wizard
├── config.py        # SettingsManager, Dynamic Styles, Foldery
├── utils.py         # Helpery techniczne
├── settings.ini     # Plik konfiguracji użytkownika
├── requirements.txt
├── install.bat      # Instalacja z CUDA 12.8
├── start.bat        # Szybkie uruchomienie
└── docs/            # Pliki wskazówek HTML
```

## Wymagania

- Python 3.10+
- CUDA-compatible GPU (zalecane ≥6 GB VRAM)
- PyTorch z obsługą CUDA

## Instalacja

### Windows (zalecana)

```bat
install.bat
```

Skrypt automatycznie tworzy środowisko wirtualne, instaluje PyTorch z CUDA 12.8 oraz wszystkie zależności.

## Autor
Opracowane jako zadanie przebudowy interfejsu GUI Stable Diffusion.
