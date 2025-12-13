import fs from 'node:fs';
import path from 'node:path';
export function createBackup(dbPath, documentsDir) {
    fs.mkdirSync(documentsDir, { recursive: true });
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    var target = path.join(documentsDir, "inventory-".concat(stamp, ".db"));
    fs.copyFileSync(dbPath, target);
    return target;
}
