@echo off
set VENV_DIR=.venv

if not exist "%VENV_DIR%" (
    echo Tworzenie czystego venv...
    python -m venv %VENV_DIR%
)

call %VENV_DIR%\Scripts\activate.bat

echo Krok 1/3: Instalowanie PyTorcha (CUDA 12.8)...
python -m pip install torch==2.7.1+cu128 torchvision==0.22.1+cu128 --extra-index-url https://download.pytorch.org/whl/cu128

echo Krok 2/3: Instalowanie xformers...
python -m pip install xformers==0.0.31.post1 --extra-index-url https://download.pytorch.org/whl/cu128 --no-deps

echo Krok 3/3: Instalowanie reszty bibliotek...
python -m pip install -r requirements.txt

echo Uruchamianie aplikacji...
python main.py

pause