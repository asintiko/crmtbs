# Конфигурация подписи приложений

## macOS

Сертификат для подписи macOS приложений настроен с SHA256 fingerprint:
`6HWVfgHrBmnBD5cTWmcD/97aOJxm9rcPwjVzJGY5S+s`

Electron Builder автоматически найдет сертификат в Keychain по этому fingerprint.

### Требования:
- Сертификат разработчика Apple должен быть установлен в Keychain
- Сертификат должен соответствовать указанному SHA256 fingerprint

### Альтернативный способ:
Если нужно использовать другой сертификат, установите переменную окружения:
```bash
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

## Windows

Для подписи Windows приложений используется SHA256 fingerprint:
`6HWVfgHrBmnBD5cTWmcD/97aOJxm9rcPwjVzJGY5S+s`

### Способ 1: Сертификат в хранилище Windows
Если сертификат установлен в хранилище сертификатов Windows, он будет найден автоматически.

### Способ 2: Файл сертификата
Если сертификат находится в файле, установите переменные окружения:
```bash
export WIN_CERT_FILE=path/to/certificate.pfx
export WIN_CERT_PASSWORD=your_certificate_password
```

## Файлы

- `entitlements.mac.plist` - права доступа для macOS приложения (hardened runtime)

