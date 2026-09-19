// 本地打包：npm run zip
// 流程：npm run build → 从 manifest.json 读版本号 → build/ 压缩为 release/devkit-pro-v{version}.zip
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const buildDir = resolve(root, 'build');
const releaseDir = resolve(root, 'release');

// 1. 构建
console.log('🏗  构建中...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// 2. 版本号以 manifest.json 为准（发布产物的版本）
const { version } = JSON.parse(readFileSync(resolve(root, 'src/extension/manifest.json'), 'utf8'));

// 3. 压缩（zip -r，macOS/Linux 自带；Windows 需 WSL 或 Git Bash）
// 排除 *.map：hidden-source-map 生成但不被引用，发布包里是死重（879KB）
const zipName = `devkit-pro-v${version}.zip`;
const zipPath = resolve(releaseDir, zipName);
mkdirSync(releaseDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath); // 覆盖旧包（zip 会追加而非替换）
execSync(`cd "${buildDir}" && zip -rq "${zipPath}" . -x "*.map"`, { stdio: 'inherit' });

const sizeKB = (existsSync(zipPath) ? readFileSync(zipPath).length / 1024 : 0).toFixed(1);
console.log(`\n📦 打包完成: release/${zipName}（${sizeKB} KB）`);
