import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'extensions');
const destDir = path.join(__dirname, '..', 'dist', 'extensions');

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(function (childItemName) {
            copyRecursiveSync(path.join(src, childItemName),
                path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy everything except the builder dirs
const excludes = ['equalizer', 'graph-color-wheel', 'preference-bound', 'target-customizer'];

fs.readdirSync(srcDir).forEach(item => {
    if (item === 'extensions.config.js' || !excludes.includes(item)) {
        copyRecursiveSync(path.join(srcDir, item), path.join(destDir, item));
    }
});
