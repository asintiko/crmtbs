# Скрипт для деплоя на сервер (PowerShell)
# Использование: .\deploy.ps1

$SERVER_IP = "144.31.17.123"
$SERVER_PORT = "1122"
$SERVER_USER = "root"
$SERVER_PASSWORD = "PiZ3ED3y6GC5"

Write-Host "🔨 Сборка приложения..." -ForegroundColor Cyan
npm run build:win

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при сборке" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Поиск собранного exe..." -ForegroundColor Cyan
$EXE_FILE = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse | Select-Object -First 1

if (-not $EXE_FILE) {
    Write-Host "❌ Файл exe не найден" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Загрузка на сервер..." -ForegroundColor Cyan
Write-Host "Файл: $($EXE_FILE.FullName)" -ForegroundColor Yellow

# Используем scp для загрузки (требует установленный OpenSSH или WinSCP)
# Для Windows может потребоваться установка OpenSSH Client
try {
    scp -P $SERVER_PORT "$($EXE_FILE.FullName)" "${SERVER_USER}@${SERVER_IP}:/tmp/inventory-desktop.exe"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Файл успешно загружен на сервер" -ForegroundColor Green
        Write-Host "📝 Файл находится в /tmp/inventory-desktop.exe на сервере" -ForegroundColor Yellow
    } else {
        throw "Ошибка при загрузке"
    }
} catch {
    Write-Host "❌ Ошибка при загрузке файла" -ForegroundColor Red
    Write-Host "💡 Убедитесь, что:" -ForegroundColor Yellow
    Write-Host "   - OpenSSH Client установлен (Add-WindowsCapability -Online -Name OpenSSH.Client)" -ForegroundColor Yellow
    Write-Host "   - SSH ключ настроен или пароль доступен" -ForegroundColor Yellow
    Write-Host "   - Сервер доступен по адресу ${SERVER_IP}:${SERVER_PORT}" -ForegroundColor Yellow
    exit 1
}



