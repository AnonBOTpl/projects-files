# AnonGen — Stable Diffusion GUI

Nowoczesny, minimalistyczny interfejs graficzny dla Stable Diffusion 1.5, zbudowany w PyQt6. Zaprojektowany z myślą o wygodzie użytkowania, estetyce Dark Mode oraz ochronie VRAM.

## Funkcje

### Tryby generowania
- **Text2Image** — generowanie obrazów z promptu z pełną kontrolą nad samplerem, schedulerem, CFG, krokami i wymiarami.
- **Inpainting** — interaktywne płótno (`InpaintCanvas`) do rysowania masek binarnych (0/255, bez antyaliasingu). Obsługa dedykowanych modeli inpaint (`.safetensors`) oraz trybu `original` (współdzielenie komponentów z modelem głównym bez przeładowania VRAM).
- **ControlNet (Canny)** — generowanie na podstawie kompozycji z obrazu referencyjnego. Automatyczna detekcja krawędzi przez OpenCV, inteligentne skalowanie do max 512px z zachowaniem proporcji.

### Zarządzanie modelami
- Automatyczne skanowanie folderów `models/stable_diffusion`, `models/lora`, `models/controlnet`, `models/inpaint`, `models/upscalers`.
- Obsługa plików `.safetensors` (lokalnie) i modeli z Hugging Face Hub.
- Możliwość wyboru modelu bazowego z dowolnej lokalizacji na dysku.

### Latent Mixology Station
- Jednoczesne ładowanie do 5 adapterów LoRA z indywidualnymi suwakami wag (zakres −1.0 do 2.0).
- Wizualizacja wag LoRA w czasie rzeczywistym (`LoRAVisualizer` — styl equalizera).
- Dynamiczne dodawanie i usuwanie LoRA bez przeładowania modelu bazowego.

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
- Tryb automatyczny (po wygenerowaniu) lub ręczny (przycisk „Zastosuj Upscaler").
- Opcja trzymania modelu w VRAM między kolejnymi użyciami.

### VRAM Oracle
- Szacowanie zużycia pamięci GPU w czasie rzeczywistym na podstawie rozdzielczości (`2.5 + (w×h / 512²) × 1.5` GB).
- Kolorowy wskaźnik: zielony (<4.5 GB), pomarańczowy (<5.5 GB), czerwony (≥5.5 GB).
- Przycisk Auto-Optimizer resetuje wymiary do bezpiecznych 512×512.

### Galeria
- Przegląd wygenerowanych obrazów z folderu `output/txt2img` w widoku miniatur (200×200 px).
- Podgląd szczegółowy z metadanymi PNG (`GalleryDetailWindow`).

### UX i automatyzacja
- Zapis metadanych generowania (prompt, seed, CFG, kroki, sampler) bezpośrednio w pliku PNG.
- Automatyczne tworzenie struktury folderów przy starcie aplikacji.
- Przycisk „Wyślij do Inpaint" — natychmiastowy transfer obrazu z T2I do edytora masek.
- Kopiowanie wygenerowanego obrazu do schowka systemowego.
- Pełnoekranowy podgląd obrazu (`ImageViewer`) po kliknięciu miniatury.
- Drag & drop obrazów referencyjnych w zakładce ControlNet.
- Pasek postępu zsynchronizowany z krokami diffusji (callback `callback_on_step_end`).

## Struktura projektu

```
AnonGen/
├── main.py          # MainWindow — główne okno, zakładki, logika UI
├── engine.py        # DiffusionEngine — ładowanie modeli, generowanie
├── worker.py        # QThread: GenerationWorker, InpaintWorker, ControlNetWorker, UpscaleWorker
├── widgets.py       # Komponenty UI: ImageViewer, InpaintCanvas, ParameterSlider, LoRAItem, LoRAVisualizer…
├── config.py        # Stylesheet, lista folderów, konfiguracja loggera
├── utils.py         # qimage_to_pil() — konwersja QImage → PIL przez QBuffer
├── test_engine.py   # Podstawowy test silnika
├── requirements.txt
├── install.bat      # Tworzenie venv + instalacja z CUDA 12.8
├── start.bat        # Uruchomienie w venv
├── docs/
│   ├── tips_inpaint.html
│   └── tips_controlnet.html
├── models/
│   ├── stable_diffusion/
│   ├── lora/
│   ├── controlnet/
│   ├── inpaint/
│   └── upscalers/
└── output/
    ├── txt2img/
    ├── inpaint/
    ├── controlnet/
    ├── upscaled/
    └── debug/
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

### Ręcznie

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# lub: source venv/bin/activate  # Linux/macOS

pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

## Uruchomienie

```bat
start.bat
```

lub ręcznie:

```bash
python main.py
```

## Zależności

| Biblioteka | Wersja |
|---|---|
| diffusers | 0.36.0 |
| transformers | 4.57.6 |
| accelerate | 1.13.0 |
| peft | 0.19.1 |
| safetensors | 0.7.0 |
| huggingface-hub | 0.36.2 |
| Pillow | 12.2.0 |
| PyQt6 | 6.7.1 |
| spandrel | 0.4.0 |
| opencv-python | — |

## Modele

Aplikacja obsługuje modele w formacie `.safetensors`. Umieść je w odpowiednich podfolderach `models/` przed uruchomieniem. Kompatybilne z modelami dla Stable Diffusion 1.5 (nie SD 2.x ani SDXL).

Przykładowe źródła modeli: [Civitai](https://civitai.com), [Hugging Face](https://huggingface.co).
