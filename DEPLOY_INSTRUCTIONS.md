# Инструкция по деплою

Из-за технических ограничений терминала, автоматический деплой через скрипты может не работать. Используйте один из следующих способов:

## Способ 1: Через PowerShell (рекомендуется)

Откройте PowerShell **отдельно** (не через терминал Cursor) и выполните:

```powershell
cd C:\Users\Дмитрий\Documents\crmtbs
.\deploy-auto.ps1
```

Скрипт автоматически:
1. Установит модуль Posh-SSH (если нужно)
2. Соберет приложение
3. Загрузит на сервер

## Способ 2: Через Python

Если у вас установлен Python:

```bash
python deploy.py
```

## Способ 3: Ручной деплой

### 1. Сборка
```bash
npm run build:win
```

### 2. Поиск файла
Найдите exe файл в папке `release/`:
- `Inventory Desktop-Windows-0.1.0-Setup.exe` (установщик)
- `Inventory Desktop-Windows-0.1.0-portable.exe` (portable)

### 3. Загрузка через scp
```bash
scp -P 1122 "release/Inventory Desktop-Windows-0.1.0-Setup.exe" root@144.31.17.123:/tmp/inventory-desktop.exe
```

Пароль: `PiZ3ED3y6GC5`

### 4. Загрузка через WinSCP
1. Откройте WinSCP
2. Создайте соединение:
   - Хост: `144.31.17.123`
   - Порт: `1122`
   - Пользователь: `root`
   - Пароль: `PiZ3ED3y6GC5`
3. Подключитесь
4. Перетащите exe файл в `/tmp/inventory-desktop.exe`

## Данные для подключения

- **IP:** 144.31.17.123
- **Порт:** 1122
- **Пользователь:** root
- **Пароль:** PiZ3ED3y6GC5
- **Путь на сервере:** /tmp/inventory-desktop.exe



