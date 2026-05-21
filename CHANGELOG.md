# Changelog

## [2.5.0] - 2026-05-21
### Dodano
- **First Launch Wizard:** Nowy kreator powitalny ułatwiający wstępną konfigurację (język, motyw).
- **Zarządzanie LoRA:** Automatyczne przeładowywanie aktywnych adapterów LoRA po zmianie modelu głównego.
- **Poprawki UI:** Rozbudowane style dla trybu jasnego (Light Mode) oraz ulepszone renderowanie list rozwijanych.
### Naprawiono
- Krytyczny błąd `ValueError` przy zmianie modelu (utrata referencji do adapterów).
- Problemy z czytelnością interfejsu w trybie jasnym.

## [2.4.0] - 2026-05-21
### Dodano
- **System Ustawień:** Wdrożenie `settings.ini` zarządzanego przez `SettingsManager`.
- **Panel Konfiguracyjny:** Nowe okno ustawień pozwalające na zmianę ścieżek, kolorów i parametrów wydajności.
- **VRAM Slicing:** Możliwość włączenia optymalizacji VAE Slicing i Tiling dla kart 6GB.
- **Dynamiczne Style:** Całkowite przejście na generowany arkusz CSS zależny od wybranego koloru akcentu i motywu.

## [2.3.0] - 2026-05-21
### Dodano
- **Diagnostyka Inpaintingu:** Dodano logowanie parametrów (`[DEBUG INPAINT]`) oraz automatyczny zapis maski do `output/debug_mask.png`.
- **Rozszerzone skanowanie:** Upscalery obsługują teraz dodatkowe rozszerzenia `.pth` oraz `.pt`.
### Naprawiono
- **Poprawa Maski:** Inpainting generuje teraz idealnie binarną maskę (0/255) bez antyaliasingu, co rozwiązuje problemy z interpretacją przez model AI.
- **Logika Ścieżek:** Naprawiono błędy w skanowaniu modeli upscalerów.

## [2.2.0] - 2026-05-21
### Dodano
- **Naprawa Inpaintingu:** Model poprawnie interpretuje maskę dzięki konwersji do formatu binarnego (B&W).
- **Zintegrowany Denoising:** Suwak siły odszumiania jest teraz poprawnie przekazywany do silnika Inpaint.
- **Optymalizacja UX Panelu:** Przycisk wyboru modelu bazowego z dysku ("...") przeniesiony obok listy rozwijanej.
- **Globalny Upscaler:** Ustawienia upscalera są teraz zawsze dostępne w panelu bocznym.
### Naprawiono
- Krytyczny błąd ignorowania maski przez pipeline inpaintingu.
- Poprawiono ścieżki skanowania modeli upscalerów.

## [2.1.0] - 2024-05-22
### Dodano
- **Globalny Skaner Modeli:** Sidebar automatycznie skanuje folder `models/stable_diffusion` i pozwala na wybór z listy.
- **Zarządzanie Modelem Inpaint:** Nowy przycisk "Załaduj model inpaint" z logiką zwalniania modelu bazowego dla oszczędności VRAM.
- **Współdzielenie Komponentów:** ControlNet i Inpainting ("original") wykorzystują teraz komponenty już załadowanego modelu głównego.
### Naprawiono
- Wyeliminowano błędy Out Of Memory (OOM) w module ControlNet poprzez optymalizację ładowania potoku.
- Naprawiono błąd `AttributeError` w Inpaintingu (użycie `StableDiffusionInpaintPipeline`).
### Zmieniono
- Poprawiono logikę wyboru modelu z dysku (dodano opcję "Wybierz z innej lokalizacji...").

## [2.0.1] - 2024-05-22
### Naprawiono
- Krytyczny błąd `ValueError` podczas konwersji obrazów `QImage` do formatu PIL (poprawka buforowania pamięci).
- Błędy `NameError` w obsłudze zdarzeń myszy i przeciągania plików.
- Poprawiono przesyłanie parametrów Inpaintingu (Negative Prompt).
### Zmieniono
- Zoptymalizowano proces konwersji obrazów: teraz odbywa się poprzez bezpieczny `QBuffer`, co gwarantuje stabilność przy niestandardowych proporcjach obrazu.

## [2.0.0] - 2024-05-22
### Dodano
- **Globalna Architektura UI:** Przebudowa interfejsu na profesjonalny układ: stały panel boczny (Global Sidebar) i system 3 zakładek (Tabs).
- **Zarządzanie Modelami Specjalistycznymi:** Wsparcie dla ładowania lokalnych modeli Inpaint i ControlNet (.safetensors).
- **Zaawansowany Inpainting:** Dedykowana zakładka z płótnem, suwakami Steps, CFG oraz Denoising Strength.
- **Pełny Moduł ControlNet:** Zakładka z obsługą obrazów referencyjnych, preprocesorem Canny i kontrolą siły (Weight).
- **Izolacja Parametrów:** Każdy tryb pracy (T2I, Inpaint, CN) posiada teraz własny, niezależny zestaw ustawień.
### Zmieniono
- Panel boczny skupia się teraz wyłącznie na ustawieniach globalnych (Model bazowy, LoRA, VRAM).

## [1.9.0] - 2024-05-22
### Dodano
- **Nowa Struktura Projektu:** Zautomatyzowane tworzenie kompletnego drzewa folderów dla modeli i wyników.
- **Profesjonalne Logowanie:** Wdrożenie modułu `logging` zastępującego `print()`. Szczegółowe raportowanie operacji VRAM i skalowania.
- **Optymalizacja Płótna:** Nowa mechanika rysowania maski w Inpaintingu (osobna warstwa QPixmap), eliminująca opóźnienia CPU.
- **Globalna Ochrona VRAM:** Obowiązkowe, proporcjonalne skalowanie wszystkich obrazów wejściowych (max 512px).
### Zmieniono
- Uporządkowano ścieżki zapisu: wyniki są teraz segregowane do podfolderów `output/txt2img`, `output/inpaint` itp.

## [1.8.0] - 2024-05-22
### Dodano
- **Moduł ControlNet (Canny):** Trzecia zakładka umożliwiająca generowanie obrazów na podstawie kompozycji z obrazu referencyjnego.
- **Inteligentne Skalowanie:** Obrazy w ControlNet są automatycznie skalowane (max 512px) z rygorystycznym zachowaniem proporcji (Aspect Ratio).
- Integracja `StableDiffusionControlNetPipeline` oraz detekcji krawędzi OpenCV (Canny).
- Zarządzanie VRAM dla ControlNet: automatyczne czyszczenie cache przed generacją.
### Zmieniono
- Zaktualizowano `requirements.txt` o bibliotekę `opencv-python`.

## [1.7.0] - 2024-05-22
### Dodano
- **System Zakładek:** Przebudowano UI na karty (Text2Image, Inpainting) dla lepszej organizacji pracy.
- **Moduł Inpainting:** Nowe narzędzie do edycji obrazów z interaktywnym płótnem do rysowania masek.
- **Mostek Text2Inpaint:** Przycisk "Wyślij do Inpaint" pozwalający na błyskawiczne przeniesienie generacji do edycji.
- Obsługa `AutoPipelineForInpainting` w silniku.
### Naprawiono
- Krytyczny błąd `sipBadCatcherResult` przy zamykaniu podglądu pełnoekranowego.
- Poprawiono skalowanie obrazów w widoku Side-by-side (teraz są równej wielkości).
- Zoptymalizowano wydajność: obrazy są trzymane w pamięci RAM, eliminując opóźnienia przy zmianie rozmiaru okna.
- Zwiększono szerokość pól numerycznych w sidebarze (wsparcie dla 4-cyfrowych wartości).

## [1.6.0] - 2024-05-22
### Dodano
- **Interaktywny Podgląd Side-by-side:** Dynamiczne porównanie obrazu oryginalnego i powiększonego po użyciu upscalera.
- **Pełnoekranowy Image Viewer:** Możliwość powiększenia dowolnego obrazu do rozmiarów ekranu po kliknięciu.
- **Dedykowana Struktura Plików:** Automatyczne sortowanie wyników (baza w `output/`, upscaler w `output/upscaled/`).
- **Sygnały etapowe:** Worker informuje UI o zakończeniu bazy jeszcze przed rozpoczęciem upscalingu.
### Naprawiono
- Krytyczny błąd ścieżek zapisu: obrazy nie trafiają już do katalogu głównego (root).

## [1.5.1] - 2024-05-22
### Zmieniono
- Poprawa ergonomii (UX): Przycisk "Zastosuj Upscaler" został przeniesiony pod obrazek dla łatwiejszego dostępu.
- Dodano przycisk "Kopiuj" obok wyświetlanego ziarna (Seed), umożliwiający szybkie skopiowanie wartości do schowka.
- Optymalizacja układu głównego panelu.

## [1.5.0] - 2024-05-22
### Dodano
- **Moduł Upscalera:** Integracja z biblioteką `spandrel` pozwalająca na wysokiej jakości powiększanie obrazów.
- Obsługa modeli upscalerów (np. ESRGAN) z katalogu `models/upscalers`.
- Możliwość automatycznego upscalingu po wygenerowaniu obrazu.
- System cache'owania modeli upscalerów z opcją oszczędzania VRAM.
- Nowy wątek roboczy `UpscaleWorker` dla asynchronicznego post-processingu.

## [1.4.0] - 2024-05-22
### Zmieniono
- Zaktualizowano `requirements.txt`: nowsze wersje `diffusers`, `transformers`, `accelerate`.
- Zaktualizowano `start.bat`.
- Dodano `install.bat` z obsługą CUDA 12.8 i automatycznym tworzeniem venv.
- Optymalizacja środowiska pod przyszłe moduły (np. upscaler).

## [1.3.1] - 2024-05-22
### Naprawiono
- Błąd `OverflowError` w polu ziarna (Seed) poprzez ograniczenie zakresu walidatora.
### Zmieniono
- Zamieniono suwak ziarna na dedykowane pole tekstowe `QLineEdit` dla lepszego UX.

## [1.3.0] - 2024-05-22
### Dodano
- **System Seed:** Pełna kontrola nad ziarnem generacji (-1 dla losowego).
- Wyświetlanie faktycznie użytego ziarna po zakończeniu procesu.
- Generator ziarna zintegrowany z backendem (torch.Generator).
### Zmieniono
- Pola Prompt i Negative Prompt korzystają teraz z `QPlainTextEdit` (wymuszony surowy tekst bez formatowania).
- Zaktualizowano `worker.py` do obsługi przesyłania ziarna.

## [1.2.1] - 2024-05-22
### Dodano
- Przywrócono przycisk "Przeglądaj" dla wyboru modelu.
### Zmieniono
- Odświeżono wygląd sekcji parametrów: ukryto strzałki w SpinBoxach, poprawiono wyrównanie i kolorystykę kontrolek.
- Zoptymalizowano układ sidebar dla lepszej czytelności.

## [1.2.0] - 2024-05-22
### Dodano
- **Latent Mixology Station:** Możliwość ładowania do 5 modeli LoRA jednocześnie z indywidualnymi suwakami wag (-1.0 do 2.0).
- **VRAM Oracle:** System szacowania zużycia pamięci VRAM w czasie rzeczywistym z ostrzeżeniami kolorystycznymi.
- **LoRA Visualizer:** Estetyczna wizualizacja wag LoRA w formie "equalizera" w panelu bocznym.
- **Auto-Optimizer:** Funkcja automatycznego korygowania rozdzielczości do bezpiecznych wartości.
### Zmieniono
- Zaktualizowano `engine.py`, aby obsługiwał wiele adapterów LoRA równocześnie.

## [1.1.1] - 2024-05-22
### Naprawiono
- Błąd `AttributeError: 'MainWindow' object has no attribute 'last_generated_path'` podczas inicjalizacji okna.
- Poprawiono kolejność wywołań w `__init__`, aby zapobiec crashom przy starcie aplikacji w trybie zmaksymalizowanym.

## [1.1.0] - 2024-05-22
### Zmieniono
- Całkowita przebudowa interfejsu graficznego (GUI) przy użyciu PyQt6.
- Wprowadzono nowoczesny styl Dark Mode (ciemny grafit z neonowym błękitem).
- Zmieniono układ okna: dodano panel boczny (Sidebar) na parametry i wczytywanie modeli.
- Główny obszar okna skupia się teraz na ogromnym podglądzie wygenerowanego obrazu.
- Dodano dedykowane pole dla Negative Prompt.
- Zaimplementowano niestandardowe kontrolki suwaków połączone z polami tekstowymi dla precyzyjnej regulacji parametrów.
- Zastąpiono tekstowy licznik kroków graficznym paskiem postępu.
- Dodano funkcje "Otwórz folder output" oraz "Kopiuj do schowka".
- Aplikacja teraz domyślnie uruchamia się w trybie zmaksymalizowanym.
- Zautomatyzowano proces zarządzania plikami: obrazy są teraz automatycznie przenoszone do folderu `output/`, który jest tworzony przy starcie aplikacji.

## [1.0.0] - Wersja początkowa
- Podstawowy interfejs PyQt6.
- Integracja z Diffusers (Stable Diffusion 1.5).
- Obsługa modeli Safetensors i LoRA.
