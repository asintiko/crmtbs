@echo off
chcp 65001 >nul
echo ========================================
echo   Деплой Inventory Desktop на сервер
echo ========================================
echo.

echo [1/4] Сборка приложения...
call npm run build:win
if errorlevel 1 (
    echo Ошибка при сборке
    exit /b 1
)
echo Сборка завершена успешно
echo.

echo [2/4] Поиск exe файла...
for /r release %%f in (*.exe) do (
    if exist "%%f" (
        echo Найден файл: %%f
        set "EXE_FILE=%%f"
        goto :found
    )
)
echo Файл exe не найден
exit /b 1

:found
echo.

echo [3/4] Загрузка на сервер...
echo Сервер: root@144.31.17.123:1122
echo Путь: /tmp/inventory-desktop.exe
echo.
echo Выполняется команда scp...
echo При запросе пароля введите: PiZ3ED3y6GC5
echo.

scp -P 1122 "%EXE_FILE%" root@144.31.17.123:/tmp/inventory-desktop.exe

if errorlevel 1 (
    echo.
    echo Ошибка при загрузке
    echo Убедитесь, что:
    echo   - OpenSSH Client установлен
    echo   - Сервер доступен
    exit /b 1
)

echo.
echo ========================================
echo   Деплой завершен успешно!
echo ========================================
echo.
echo Файл на сервере: /tmp/inventory-desktop.exe
echo.



