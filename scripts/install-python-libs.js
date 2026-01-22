/**
 * 安装 Python 依赖库到嵌入式 Python 环境
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

// ==================== 配置 ====================

const ELECTRON_DIR = path.join(__dirname, '..', 'electron');
const BACKEND_DIR = path.join(__dirname, '..', 'backend');

// 嵌入式 Python 路径
const PYTHON_DIR = path.join(ELECTRON_DIR, 'python');
const PYTHON_EXE = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'python.exe')
    : path.join(PYTHON_DIR, 'bin', 'python3');

// site-packages 路径
const SITE_PACKAGES = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'Lib', 'site-packages')
    : path.join(PYTHON_DIR, 'lib', 'python3.11', 'site-packages');

// get-pip.py URL
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

// 需要安装的依赖库
const REQUIRED_PACKAGES = [
    'python-docx==1.1.0',
    'lxml==5.1.0'
];

// ==================== 工具函数 ====================

/**
 * 下载 get-pip.py
 */
function downloadGetPip() {
    return new Promise((resolve, reject) => {
        const destPath = path.join(__dirname, 'get-pip.py');

        if (fs.existsSync(destPath)) {
            console.log('✅ get-pip.py 已存在');
            resolve(destPath);
            return;
        }

        console.log('📥 下载 get-pip.py...');
        console.log(`📍 URL: ${GET_PIP_URL}`);

        const file = fs.createWriteStream(destPath);

        https.get(GET_PIP_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败，状态码: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('✅ get-pip.py 下载完成');
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlinkSync(destPath);
            reject(err);
        });
    });
}

/**
 * 执行 Python 命令
 */
function runPythonCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔧 执行: python ${args.join(' ')}`);

        const proc = spawn(PYTHON_EXE, args, {
            cwd: PYTHON_DIR,
            env: {
                ...process.env,
                PYTHONPATH: SITE_PACKAGES
            },
            ...options
        });

        proc.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) console.log(output);
        });

        proc.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error) console.error(error);
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log('✅ 命令执行成功');
                resolve();
            } else {
                reject(new Error(`命令执行失败，退出码: ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * 检查 Python 是否可用
 */
async function checkPython() {
    console.log('🔍 检查 Python 环境...');

    if (!fs.existsSync(PYTHON_EXE)) {
        console.log('❌ Python 可执行文件不存在');
        console.log(`📍 预期位置: ${PYTHON_EXE}`);
        console.log('\n💡 请先运行:');
        console.log('   node scripts/download-python.js\n');
        return false;
    }

    try {
        await runPythonCommand(['--version']);
        return true;
    } catch (error) {
        console.error('❌ Python 检查失败:', error.message);
        return false;
    }
}

/**
 * 安装 pip
 */
async function installPip(getPipPath) {
    console.log('\n📦 安装 pip 到嵌入式环境...');
    console.log(`📍 目标目录: ${SITE_PACKAGES}`);

    try {
        await runPythonCommand([getPipPath, '--no-warn-script-location', '--target', SITE_PACKAGES]);
        return true;
    } catch (error) {
        console.error('❌ pip 安装失败:', error.message);
        return false;
    }
}

/**
 * 检查依赖是否已安装
 */
function isPackageInstalled(packageName) {
    const packagePath = path.join(SITE_PACKAGES, packageName.replace('-', '_'));
    return fs.existsSync(packagePath);
}

/**
 * 安装依赖包
 */
async function installPackages() {
    console.log('\n📚 安装 Python 依赖包...');

    const pipPath = process.platform === 'win32'
        ? path.join(SITE_PACKAGES, 'pip.exe')
        : path.join(SITE_PACKAGES, 'pip');

    if (!fs.existsSync(pipPath)) {
        console.error('❌ pip 不存在，请先安装 pip');
        return false;
    }

    for (const pkg of REQUIRED_PACKAGES) {
        const pkgName = pkg.split('==')[0];

        console.log(`\n${'='.repeat(50)}`);
        console.log(`📦 检查: ${pkg}`);
        console.log('='.repeat(50));

        if (isPackageInstalled(pkgName)) {
            console.log(`✅ ${pkgName} 已安装，跳过`);
            continue;
        }

        console.log(`⏳ 安装 ${pkgName}...`);

        try {
            const pipArgs = [
                pipPath,
                'install',
                pkg,
                '--target', SITE_PACKAGES,
                '--no-warn-script-location',
                '--upgrade'
            ];

            await runPythonCommand(pipArgs);
            console.log(`✅ ${pkgName} 安装成功`);
        } catch (error) {
            console.error(`❌ ${pkgName} 安装失败:`, error.message);
            console.log(`\n💡 提示: 可以手动安装`);
            console.log(`   "${pipPath}" install ${pkg} --target "${SITE_PACKAGES}"\n`);
        }
    }

    return true;
}

/**
 * 验证安装
 */
async function verifyInstallations() {
    console.log('\n🔍 验证依赖安装...');

    const testScript = `
import sys
sys.path.insert(0, r'${SITE_PACKAGES.replace(/\\/g, '\\\\')}')

try:
    from docx import Document
    print('✅ python-docx: OK')
except ImportError as e:
    print('❌ python-docx: FAIL -', e)

try:
    import lxml
    print('✅ lxml: OK')
except ImportError as e:
    print('❌ lxml: FAIL -', e)
`;

    try {
        const testPath = path.join(PYTHON_DIR, 'test_imports.py');
        fs.writeFileSync(testPath, testScript);

        await runPythonCommand([testPath]);

        fs.unlinkSync(testPath);
        return true;
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        return false;
    }
}

/**
 * 显示安装摘要
 */
function showSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Python 依赖安装完成！');
    console.log('='.repeat(60));
    console.log('\n📍 Python 环境:');
    console.log(`   解释器: ${PYTHON_EXE}`);
    console.log(`   包目录: ${SITE_PACKAGES}`);

    console.log('\n📦 已安装的包:');
    REQUIRED_PACKAGES.forEach(pkg => {
        const pkgName = pkg.split('==')[0];
        const status = isPackageInstalled(pkgName) ? '✅' : '❌';
        console.log(`   ${status} ${pkg}`);
    });

    console.log('\n🚀 下一步:');
    console.log('   1. 开发模式: cd electron && npm run dev');
    console.log('   2. 打包应用: cd electron && npm run build:win');
    console.log('\n');
}

// ==================== 主流程 ====================

async function installPythonLibs() {
    console.log('🚀 开始安装 Python 依赖...\n');

    try {
        // 1. 检查 Python 环境
        const pythonOk = await checkPython();
        if (!pythonOk) {
            process.exit(1);
        }

        // 2. 下载 get-pip.py
        const getPipPath = await downloadGetPip();

        // 3. 安装 pip
        const pipOk = await installPip(getPipPath);
        if (!pipOk) {
            console.log('\n⚠️  pip 安装失败，但尝试继续...\n');
        }

        // 4. 安装依赖包
        const packagesOk = await installPackages();
        if (!packagesOk) {
            console.log('\n⚠️  部分依赖安装失败\n');
        }

        // 5. 验证安装
        await verifyInstallations();

        // 6. 显示摘要
        showSummary();

    } catch (error) {
        console.error('\n❌ 安装过程出错:', error.message);
        console.error('\n💡 故障排除:');
        console.error('1. 检查网络连接');
        console.error('2. 确认 Python Embedded 已正确安装');
        console.error('3. 尝试手动安装依赖\n');
        process.exit(1);
    }
}

// 运行安装
if (require.main === module) {
    installPythonLibs();
}

module.exports = { installPythonLibs };
