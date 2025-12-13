# Автоматический деплой с использованием Posh-SSH
# Использование: .\deploy-auto.ps1

$ErrorActionPreference = "Stop"

$SERVER_IP = "144.31.17.123"
$SERVER_PORT = "1122"
$SERVER_USER = "root"
$SERVER_PASSWORD = "PiZ3ED3y6GC5"
$REMOTE_PATH = "/tmp/inventory-desktop.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Автоматический деплой на сервер" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Posh-SSH модуля
Write-Host "[Проверка] Проверка модуля Posh-SSH..." -ForegroundColor Yellow
$poshSSHInstalled = Get-Module -ListAvailable -Name Posh-SSH

if (-not $poshSSHInstalled) {
    Write-Host "⚠ Модуль Posh-SSH не установлен" -ForegroundColor Yellow
    Write-Host "  Устанавливаю модуль..." -ForegroundColor Gray
    try {
        Install-Module -Name Posh-SSH -Scope CurrentUser -Force -SkipPublisherCheck
        Write-Host "✓ Модуль установлен" -ForegroundColor Green
    } catch {
        Write-Host "✗ Не удалось установить модуль: $_" -ForegroundColor Red
        Write-Host "  Попробуйте запустить от имени администратора или установить вручную:" -ForegroundColor Yellow
        Write-Host "  Install-Module -Name Posh-SSH -Scope CurrentUser" -ForegroundColor Gray
        exit 1
    }
}

Import-Module Posh-SSH -ErrorAction Stop
Write-Host "✓ Модуль Posh-SSH загружен" -ForegroundColor Green
Write-Host ""

# Шаг 1: Сборка
Write-Host "[1/4] Сборка приложения..." -ForegroundColor Yellow
try {
    npm run build:win
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка при сборке"
    }
    Write-Host "✓ Сборка завершена" -ForegroundColor Green
} catch {
    Write-Host "✗ Ошибка при сборке: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Шаг 2: Поиск exe
Write-Host "[2/4] Поиск exe файла..." -ForegroundColor Yellow
$EXE_FILES = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Setup*" -or $_.Name -like "*portable*" }

if (-not $EXE_FILES -or $EXE_FILES.Count -eq 0) {
    Write-Host "✗ Файл exe не найден" -ForegroundColor Red
    exit 1
}

$EXE_FILE = $EXE_FILES | Where-Object { $_.Name -like "*Setup*" } | Select-Object -First 1
if (-not $EXE_FILE) {
    $EXE_FILE = $EXE_FILES | Select-Object -First 1
}

Write-Host "✓ Найден: $($EXE_FILE.Name)" -ForegroundColor Green
Write-Host "  Размер: $([math]::Round($EXE_FILE.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Шаг 3: Подключение к серверу
Write-Host "[3/4] Подключение к серверу..." -ForegroundColor Yellow
Write-Host "  $SERVER_USER@${SERVER_IP}:${SERVER_PORT}" -ForegroundColor Gray

$securePassword = ConvertTo-SecureString $SERVER_PASSWORD -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($SERVER_USER, $securePassword)

try {
    $session = New-SSHSession -ComputerName $SERVER_IP -Port $SERVER_PORT -Credential $credential -AcceptKey -ErrorAction Stop
    Write-Host "✓ Подключение установлено" -ForegroundColor Green
} catch {
    Write-Host "✗ Ошибка подключения: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Шаг 4: Загрузка файла
Write-Host "[4/4] Загрузка файла на сервер..." -ForegroundColor Yellow
Write-Host "  Локальный: $($EXE_FILE.FullName)" -ForegroundColor Gray
Write-Host "  Удаленный: $REMOTE_PATH" -ForegroundColor Gray

try {
    Set-SCPFile -SessionId $session.SessionId -LocalFile $EXE_FILE.FullName -RemotePath $REMOTE_PATH -ErrorAction Stop
    Write-Host "✓ Файл загружен успешно" -ForegroundColor Green
} catch {
    Write-Host "✗ Ошибка при загрузке: $_" -ForegroundColor Red
    Remove-SSHSession -SessionId $session.SessionId | Out-Null
    exit 1
}

# Закрываем сессию
Remove-SSHSession -SessionId $session.SessionId | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Деплой завершен успешно!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Файл на сервере: $REMOTE_PATH" -ForegroundColor Cyan
Write-Host ""



