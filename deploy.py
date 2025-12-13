#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автоматический деплой на сервер
Использование: python deploy.py
"""

import subprocess
import os
import sys
import glob
from pathlib import Path

SERVER_IP = "144.31.17.123"
SERVER_PORT = "1122"
SERVER_USER = "root"
SERVER_PASSWORD = "PiZ3ED3y6GC5"
REMOTE_PATH = "/tmp/inventory-desktop.exe"

def run_command(cmd, check=True):
    """Выполнить команду"""
    print(f"Выполняется: {' '.join(cmd)}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if check and result.returncode != 0:
        print(f"Ошибка: {result.stderr}")
        sys.exit(1)
    return result

def main():
    print("=" * 50)
    print("  Деплой Inventory Desktop на сервер")
    print("=" * 50)
    print()
    
    # Шаг 1: Сборка
    print("[1/4] Сборка приложения...")
    try:
        run_command("npm run build:win")
        print("✓ Сборка завершена")
    except Exception as e:
        print(f"✗ Ошибка при сборке: {e}")
        sys.exit(1)
    print()
    
    # Шаг 2: Поиск exe
    print("[2/4] Поиск exe файла...")
    exe_files = list(Path("release").rglob("*.exe"))
    
    if not exe_files:
        print("✗ Файл exe не найден")
        sys.exit(1)
    
    # Предпочитаем Setup файл
    setup_file = next((f for f in exe_files if "Setup" in f.name), None)
    exe_file = setup_file if setup_file else exe_files[0]
    
    print(f"✓ Найден: {exe_file}")
    size_mb = exe_file.stat().st_size / (1024 * 1024)
    print(f"  Размер: {size_mb:.2f} MB")
    print()
    
    # Шаг 3: Загрузка
    print("[3/4] Загрузка на сервер...")
    print(f"  Сервер: {SERVER_USER}@{SERVER_IP}:{SERVER_PORT}")
    print(f"  Путь: {REMOTE_PATH}")
    print()
    
    # Используем scp с паролем через sshpass (если доступен) или ожидаем ввода
    scp_cmd = f'scp -P {SERVER_PORT} "{exe_file}" {SERVER_USER}@{SERVER_IP}:{REMOTE_PATH}'
    
    print("Выполняется команда scp...")
    print(f"При запросе пароля введите: {SERVER_PASSWORD}")
    print()
    
    try:
        # Пробуем использовать sshpass если доступен
        result = run_command(f'where sshpass', check=False)
        if result.returncode == 0:
            scp_cmd = f'sshpass -p "{SERVER_PASSWORD}" {scp_cmd}'
        
        run_command(scp_cmd)
        print("✓ Файл загружен успешно")
    except Exception as e:
        print(f"✗ Ошибка при загрузке: {e}")
        print()
        print("Альтернативные способы:")
        print("1. Используйте WinSCP или FileZilla")
        print("2. Выполните команду вручную:")
        print(f"   {scp_cmd}")
        sys.exit(1)
    
    print()
    print("=" * 50)
    print("  Деплой завершен успешно!")
    print("=" * 50)
    print()
    print(f"Файл на сервере: {REMOTE_PATH}")
    print()

if __name__ == "__main__":
    main()



