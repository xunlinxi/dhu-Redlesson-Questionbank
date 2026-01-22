/**
 * 自动下载并安装 Python Embedded
 * 用于 Electron 应用嵌入式 Python 环境
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

// ==================== 配置 ====================

// Python 3.11.7 Embedded (稳定版本)
const PYTHON_VERSION = '3.11.7';
const DOWNLOAD_BASE = 'https://www.python.org/ftp/python';

// 平台配置
const PLATFORMS = {
    win32: {
        name: 'Windows',
        url: `${DOWNLOAD_BASE}/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
        filename: `python-${PYTHON_VERSION}-embed-amd64.zip`,
        extractDir: path.join(__dirname, '..', 'electron', 'python'),
        command: 'python.exe'
    },
    darwin: {
        name: 'macOS',
        // macOS 不提供 embedded 版本，需要特殊处理
        url: null,
        filename: null,
        extractDir: path.join(__dirname, '..', 'electron', 'python'),
        command: 'python3'
    },
    linux: {
        name: 'Linux',
        url: `${DOWNLOAD_BASE}/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz`,
        filename: `Python-${PYTHON_VERSION}.tgz`,
        extractDir: path.join(__dirname, '..', 'electron', 'python'),
        command: 'python3'
    }
};

// ==================== 工具函数 ====================

/**
 * 下载文件
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        console.log(`📥 下载: ${url}`);
        console.log(`💾 保存到: ${destPath}`);

        const file = fs.createWriteStream(destPath);

        protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // 处理重定向
                fs.unlinkSync(destPath);
                downloadFile(response.headers.location, destPath)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`下载失败，状态码: ${response.statusCode}`));
                return;
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize) {
                    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\r⏳ 下载进度: ${progress}%`);
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n✅ 下载完成');
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

/**
 * 解压 ZIP 文件 (Windows)
 */
function extractZip(zipPath, destDir) {
    console.log(`\n📦 解压: ${zipPath}`);
    console.log(`📂 到: ${destDir}`);

    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(destDir, true);
        console.log('✅ 解压完成');
        return true;
    } catch (error) {
        console.error('❌ 解压失败:', error.message);
        return false;
    }
}

/**
 * 配置 Python (创建 pip 配置等)
 */
function configurePython(pythonDir) {
    console.log('\n⚙️  配置 Python 环境...');

    const pthFile = path.join(pythonDir, 'python311._pth');

    if (fs.existsSync(pthFile)) {
        // 修改 _pth 文件，允许导入 site-packages
        const content = fs.readFileSync(pthFile, 'utf-8');
        const lines = content.split('\n');

        // 如果最后一行不是 `import site`，则添加
        if (!lines.includes('import site')) {
            lines.push('import site');
            fs.writeFileSync(pthFile, lines.join('\n'));
            console.log('✅ 已启用 site-packages 支持');
        }
    }

    // 创建 site-packages 目录
    const sitePackages = process.platform === 'win32'
        ? path.join(pythonDir, 'Lib', 'site-packages')
        : path.join(pythonDir, 'lib', 'python3.11', 'site-packages');

    fs.ensureDirSync(sitePackages);
    console.log(`✅ 已创建: ${sitePackages}`);

    return true;
}

/**
 * 验证 Python 安装
 */
function verifyPython(pythonExe) {
    console.log('\n🔍 验证 Python 安装...');

    try {
        const version = execSync(`"${pythonExe}" --version`, { encoding: 'utf-8' });
        console.log(`✅ Python 版本: ${version.trim()}`);

        const testCode = 'import sys; print("Python works!")';
        const output = execSync(`"${pythonExe}" -c "${testCode}"`, { encoding: 'utf-8' });
        console.log(`✅ Python 测试: ${output.trim()}`);

        return true;
    } catch (error) {
        console.error('❌ Python 验证失败:', error.message);
        return false;
    }
}

// ==================== 主流程 ====================

async function installPythonEmbedded() {
    console.log('🚀 开始安装 Python Embedded...');
    console.log(`📍 平台: ${process.platform} (${process.arch})`);
    console.log(`📍 Python 版本: ${PYTHON_VERSION}\n`);

    const platform = PLATFORMS[process.platform];

    if (!platform) {
        console.error(`❌ 不支持的平台: ${process.platform}`);
        process.exit(1);
    }

    // macOS 特殊处理
    if (process.platform === 'darwin') {
        console.log('\n⚠️  macOS 平台需要手动安装 Python\n');
        console.log('请选择以下方式之一：\n');
        console.log('方式 1: 使用 Homebrew');
        console.log('  brew install python@3.11\n');
        console.log('方式 2: 从官方网站下载');
        console.log('  https://www.python.org/downloads/release/python-3117/\n');
        console.log('方式 3: 使用 pyenv');
        console.log('  pyenv install 3.11.7\n');
        console.log('安装后，应用会自动使用系统 Python。\n');
        console.log('提示：开发环境建议使用 uv：');
        console.log('  pip install uv');
        console.log('  uv venv');
        console.log('  uv pip install python-docx\n');
        process.exit(0);
    }

    const downloadDir = path.join(__dirname, 'temp');
    const zipPath = path.join(downloadDir, platform.filename);

    try {
        // 创建临时目录
        fs.ensureDirSync(downloadDir);

        // 下载 Python Embedded
        if (!fs.existsSync(zipPath)) {
            await downloadFile(platform.url, zipPath);
        } else {
            console.log('✅ 文件已存在，跳过下载');
        }

        // 清理旧安装
        if (fs.existsSync(platform.extractDir)) {
            console.log('\n🗑️  清理旧安装...');
            fs.removeSync(platform.extractDir);
        }

        // 创建目标目录
        fs.ensureDirSync(platform.extractDir);

        // 解压文件
        let extractSuccess = false;
        if (process.platform === 'win32') {
            extractSuccess = extractZip(zipPath, platform.extractDir);
        } else {
            console.log('❌ Linux 平台暂不支持自动解压');
            process.exit(1);
        }

        if (!extractSuccess) {
            throw new Error('解压失败');
        }

        // 配置 Python
        configurePython(platform.extractDir);

        // 验证安装
        const pythonExe = path.join(platform.extractDir, platform.command);
        if (verifyPython(pythonExe)) {
            console.log('\n' + '='.repeat(50));
            console.log('✅ Python Embedded 安装成功！');
            console.log('='.repeat(50));
            console.log(`\n📍 安装位置: ${platform.extractDir}`);
            console.log(`📍 可执行文件: ${pythonExe}`);
            console.log(`\n📌 下一步: 安装 Python 依赖库`);
            console.log(`\n运行: node scripts/install-python-libs.js`);
            console.log('\n');
        } else {
            throw new Error('Python 验证失败');
        }

        // 清理临时文件
        console.log('🧹 清理临时文件...');
        fs.unlinkSync(zipPath);
        console.log('✅ 清理完成\n');

    } catch (error) {
        console.error('\n❌ 安装失败:', error.message);
        console.error('\n💡 提示:');
        console.error('1. 检查网络连接');
        console.error('2. 尝试手动下载并解压到指定目录');
        console.error(`3. 下载地址: ${platform.url}\n`);
        process.exit(1);
    }
}

// 运行安装
if (require.main === module) {
    installPythonEmbedded();
}

module.exports = { installPythonEmbedded };
