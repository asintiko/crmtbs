# Inventory Desktop

Electron + React + Vite + TypeScript + Tailwind. Локальная БД SQLite (better-sqlite3), офлайн-first. IPC-API вынесена в `electron/preload.ts` (`window.api` в рендере).

## Быстрый старт

```bash
npm install
npm run dev      # Vite + Electron, opens the app (сбрасывает ELECTRON_RUN_AS_NODE)
npm run build    # prod build + electron-builder
npm run lint
```

## Сборка и публикация

### Сборка для разных платформ

```bash
npm run build:win    # Сборка для Windows (NSIS установщик + portable exe)
npm run build:mac    # Сборка для macOS (DMG)
npm run build:linux # Сборка для Linux (AppImage)
```

### Подпись приложений

Приложение настроено для подписи с использованием сертификата SHA256: `6HWVfgHrBmnBD5cTWmcD/97aOJxm9rcPwjVzJGY5S+s`

#### macOS
- Сертификат будет автоматически найден в Keychain по SHA256 fingerprint
- Или установите переменную окружения `APPLE_IDENTITY` для указания другого сертификата
- Файл entitlements находится в `build/entitlements.mac.plist`

#### Windows
- Для подписи Windows установщика используйте переменные окружения:
  ```bash
  export WIN_CERT_FILE=path/to/certificate.pfx
  export WIN_CERT_PASSWORD=your_certificate_password
  ```
- Если сертификат находится в хранилище Windows, он будет найден по SHA256 fingerprint автоматически

### Публикация на GitHub Releases

Для публикации на GitHub Releases необходимо:

1. Создать GitHub Personal Access Token с правами `repo`:
   - Перейти в Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Создать новый токен с правами `repo`
   - Скопировать токен

2. Установить переменные окружения:
   ```bash
   export GH_TOKEN=your_github_token_here
   # Опционально для Windows:
   export WIN_CERT_FILE=path/to/certificate.pfx
   export WIN_CERT_PASSWORD=your_certificate_password
   ```

3. Опубликовать релиз:
   ```bash
   npm run publish      # Публикация для всех платформ
   npm run publish:win  # Публикация только для Windows
   ```

   Electron Builder автоматически:
   - Подпишет приложение используя настроенный сертификат
   - Соберет приложение для указанных платформ
   - Создаст GitHub Release с версией из `package.json`
   - Загрузит артефакты (установщики) в релиз

### Проверка обновлений

В приложении добавлена функция проверки обновлений через GitHub Releases:
- Откройте Настройки → Обновления
- Нажмите "Проверить" для проверки доступных обновлений
- Если доступно обновление, появится кнопка для перехода на страницу релиза

## Что уже сделано

- Каркас Electron + React + Tailwind с Dark/Light режимом (переключатель в UI).
- Модули UI: Дашборд, Склад, Журнал, Справочник, Настройки (макеты, таблицы, демоданные без форм).
- IPC/API: список/создание товаров и операций, сводка дашборда, ручной бэкап, пути к БД/бэкапам.
- База: better-sqlite3 в `userData` (`InventoryDatabase`), таблицы products/aliases/operations, пересчет остатков/брони/долгов, авто-бэкап в `Documents/InventoryBackups` при выходе.
- Проверка обновлений через GitHub Releases API (в настройках).
- Настроена публикация на GitHub через electron-builder.

## Структура

- `electron/` — main, preload, база (`database.ts`), бэкапы.
- `src/shared/` — общие типы и IPC-контракты.
- `src/lib/` — демоданные и утилиты форматирования.
- `src/providers/` — Theme и Inventory (фетч данных через IPC).
- `src/pages/` — экраны (дашборд/склад/журнал/справочник/настройки).
- `public/` — иконки, используется `electron-vite.svg` как favicon.

## Ближайшие задачи

- Формы создания/редактирования операций (Smart Combobox с синонимами) и товаров (архив вместо удаления).
- Валидации: предупреждение при списании в минус, блок удаления товаров с историей.
- Импорт из Excel (маппинг колонок, автосоздание справочника) при первом запуске.
- UI действий: фильтр журнала по товару, кнопка «История» на складе, ручной экспорт/импорт бэкапа.
- Финализация стилей (анимации/плавные переходы), упаковка инсталляторов через electron-builder.
