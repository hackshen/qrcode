// 构建后清理：background / http-rules-manager 是纯脚本 entry，
// rsbuild 1.0 无法按 entry 禁用 HTML 产出，多余的 html 在此删除
import { rmSync, existsSync } from 'node:fs';

const stray = [
    'build/background.html',
    'build/http-rules-manager.html',
];

for (const f of stray) {
    if (existsSync(f)) {
        rmSync(f);
        console.log(`🧹 已清理多余产物: ${f}`);
    }
}
