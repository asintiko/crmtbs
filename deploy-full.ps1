# Полный скрипт для сборки и деплоя на сервер
# Использование: .\deploy-full.ps1

$ErrorActionPreference = "Stop"

$SERVER_IP = "144.31.17.123"
$SERVER_PORT = "1122"
$SERVER_USER = "root"
$SERVER_PASSWORD = "PiZ3ED3y6GC5"
$REMOTE_PATH = "/tmp/inventory-desktop.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Деплой Inventory Desktop на сервер" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Шаг 1: Сборка приложения
Write-Host "[1/4] Сборка приложения..." -ForegroundColor Yellow
try {
    npm run build:win
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка при сборке"
    }
    Write-Host "✓ Сборка завершена успешно" -ForegroundColor Green
} catch {
    Write-Host "✗ Ошибка при сборке: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Шаг 2: Поиск exe файла
Write-Host "[2/4] Поиск собранного exe файла..." -ForegroundColor Yellow
$EXE_FILES = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Setup*" -or $_.Name -like "*portable*" }

if (-not $EXE_FILES -or $EXE_FILES.Count -eq 0) {
    Write-Host "✗ Файл exe не найден в папке release" -ForegroundColor Red
    Write-Host "  Попробуйте запустить сборку вручную: npm run build:win" -ForegroundColor Yellow
    exit 1
}

# Выбираем Setup файл, если есть, иначе portable
$EXE_FILE = $EXE_FILES | Where-Object { $_.Name -like "*Setup*" } | Select-Object -First 1
if (-not $EXE_FILE) {
    $EXE_FILE = $EXE_FILES | Select-Object -First 1
}

Write-Host "✓ Найден файл: $($EXE_FILE.FullName)" -ForegroundColor Green
Write-Host "  Размер: $([math]::Round($EXE_FILE.Length / 1MB, 2)) MB" -ForegroundColor Gray

Write-Host ""

# Шаг 3: Проверка SSH доступа
Write-Host "[3/4] Проверка SSH доступа к серверу..." -ForegroundColor Yellow
try {
    # Проверяем доступность сервера
    $testConnection = Test-NetConnection -ComputerName $SERVER_IP -Port $SERVER_PORT -WarningAction SilentlyContinue
    if (-not $testConnection.TcpTestSucceeded) {
        throw "Сервер недоступен на порту $SERVER_PORT"
    }
    Write-Host "✓ Сервер доступен" -ForegroundColor Green
} catch {
    Write-Host "✗ Не удалось подключиться к серверу: $_" -ForegroundColor Red
    Write-Host "  Проверьте доступность сервера $SERVER_IP:$SERVER_PORT" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Шаг 4: Загрузка на сервер
Write-Host "[4/4] Загрузка файла на сервер..." -ForegroundColor Yellow
Write-Host "  Сервер: ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}" -ForegroundColor Gray
Write-Host "  Путь: $REMOTE_PATH" -ForegroundColor Gray
Write-Host ""

# Используем scp для загрузки
# Для автоматической загрузки с паролем можно использовать sshpass (Linux) или Posh-SSH (PowerShell модуль)
# Здесь используем стандартный scp, который может запросить пароль

$scpCommand = "scp -P $SERVER_PORT `"$($EXE_FILE.FullName)`" ${SERVER_USER}@${SERVER_IP}:$REMOTE_PATH"

Write-Host "Выполняется команда:" -ForegroundColor Gray
Write-Host "  $scpCommand" -ForegroundColor DarkGray
Write-Host ""
Write-Host "⚠ Если запросится пароль, введите: $SERVER_PASSWORD" -ForegroundColor Yellow
Write-Host ""

try {
    # Выполняем команду через cmd для лучшей совместимости
    $process = Start-Process -FilePath "scp" -ArgumentList "-P", $SERVER_PORT, "`"$($EXE_FILE.FullName)`"", "${SERVER_USER}@${SERVER_IP}:$REMOTE_PATH" -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✓ Файл успешно загружен на сервер" -ForegroundColor Green
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Деплой завершен успешно!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Файл находится на сервере по пути:" -ForegroundColor Cyan
        Write-Host "  $REMOTE_PATH" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Ошибка при загрузке (код выхода: $($process.ExitCode))"
    }
} catch {
    Write-Host "✗ Ошибка при загрузке: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Альтернативные способы загрузки:" -ForegroundColor Yellow
    Write-Host "1. Используйте WinSCP или FileZilla для загрузки файла" -ForegroundColor Gray
    Write-Host "2. Используйте модуль Posh-SSH:" -ForegroundColor Gray
    Write-Host "   Install-Module Posh-SSH" -ForegroundColor DarkGray
    Write-Host "   Import-Module Posh-SSH" -ForegroundColor DarkGray
    Write-Host "   Set-SCPFile -ComputerName $SERVER_IP -Port $SERVER_PORT -Credential (Get-Credential) -LocalFile `"$($EXE_FILE.FullName)`" -RemotePath `"$REMOTE_PATH`"" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}



