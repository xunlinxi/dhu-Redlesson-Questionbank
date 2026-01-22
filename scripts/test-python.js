/**
 * 测试 Python 环境安装
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

// ==================== 配置 ====================

const ELECTRON_DIR = path.join(__dirname, '..', 'electron');
const PYTHON_DIR = path.join(ELECTRON_DIR, 'python');
const PYTHON_EXE = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'python.exe')
    : path.join(PYTHON_DIR, 'bin', 'python3');

const SITE_PACKAGES = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'Lib', 'site-packages')
    : path.join(PYTHON_DIR, 'lib', 'python3.11', 'site-packages');

// ==================== 测试函数 ====================

/**
 * 测试 Python 解释器
 */
async function testPythonInterpreter() {
    console.log('\n🔍 测试 1: Python 解释器');
    console.log('='.repeat(50));

    try {
        const version = await runPython(['--version']);
        console.log('✅ Python 解释器正常');
        console.log(`   版本: ${version.trim()}`);
        return true;
    } catch (error) {
        console.log('❌ Python 解释器测试失败');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

/**
 * 测试模块导入
 */
async function testModuleImports() {
    console.log('\n🔍 测试 2: Python 模块导入');
    console.log('='.repeat(50));

    const testScript = `
import sys
sys.path.insert(0, r'${SITE_PACKAGES.replace(/\\/g, '\\\\')}')

tests = [
    ('docx', 'Document'),
    ('lxml', 'etree'),
]

results = []
for name, attr in tests:
    try:
        module = __import__(name)
        getattr(module, attr)
        results.append((name, 'OK', None))
    except ImportError as e:
        results.append((name, 'FAIL', str(e)))
    except Exception as e:
        results.append((name, 'ERROR', str(e)))

for name, status, error in results:
    if status == 'OK':
        print(f'✅ {name}: OK')
    else:
        print(f'❌ {name}: {status} - {error}')

all_ok = all(status == 'OK' for _, status, _ in results)
print(f'RESULT:{all_ok}')
`;

    try {
        const testPath = path.join(PYTHON_DIR, 'test_imports.py');
        fs.writeFileSync(testPath, testScript);

        const output = await runPython([testPath]);
        const allOk = output.includes('RESULT:True');

        fs.unlinkSync(testPath);

        if (allOk) {
            console.log('✅ 所有模块导入正常');
            return true;
        } else {
            console.log('❌ 部分模块导入失败');
            console.log(`   输出: ${output}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 模块导入测试失败');
        console.log(`   错误: ${error.message}`);
        return false;
    }
}

/**
 * 测试文件访问
 */
function testFileAccess() {
    console.log('\n🔍 测试 3: 文件访问权限');
    console.log('='.repeat(50));

    const files = [
        { path: PYTHON_EXE, name: 'Python 解释器' },
        { path: SITE_PACKAGES, name: 'site-packages 目录' },
        { path: path.join(SITE_PACKAGES, 'python_docx'), name: 'python-docx 包' },
        { path: path.join(SITE_PACKAGES, 'lxml'), name: 'lxml 包' }
    ];

    let allOk = true;

    files.forEach(file => {
        if (fs.existsSync(file.path)) {
            console.log(`✅ ${file.name}: 存在`);
        } else {
            console.log(`❌ ${file.name}: 不存在`);
            console.log(`   路径: ${file.path}`);
            allOk = false;
        }
    });

    if (allOk) {
        console.log('\n✅ 所有文件访问正常');
    } else {
        console.log('\n❌ 部分文件不存在');
    }

    return allOk;
}

/**
 * 运行 Python 命令
 */
function runPython(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(PYTHON_EXE, args, {
            cwd: PYTHON_DIR
        });

        let output = '';
        let errorOutput = '';

        proc.stdout.on('data', (data) => {
            output += data.toString();
        });

        proc.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(errorOutput || `命令失败，退出码: ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

// ==================== 主流程 ====================

async function runTests() {
    console.log('🧪 Python 环境测试');
    console.log('='.repeat(60));
    console.log(`📍 平台: ${process.platform} (${process.arch})`);
    console.log(`📍 Python: ${PYTHON_EXE}`);
    console.log(`📍 site-packages: ${SITE_PACKAGES}`);

    const results = [];

    // 测试 1: Python 解释器
    results.push(await testPythonInterpreter());

    // 测试 2: 模块导入
    results.push(await testModuleImports());

    // 测试 3: 文件访问
    results.push(testFileAccess());

    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试结果');
    console.log('='.repeat(60));

    const allPassed = results.every(r => r);

    if (allPassed) {
        console.log('\n✅ 所有测试通过！');
        console.log('\n🎉 Python 环境安装成功，可以开始使用了');
        console.log('\n🚀 下一步:');
        console.log('   1. 启动应用: cd electron && npm start');
        console.log('   2. 打包应用: cd electron && npm run build:win\n');
    } else {
        console.log('\n❌ 部分测试失败');
        console.log('\n💡 建议:');
        console.log('   1. 检查 Python 解释器是否正确安装');
        console.log('   2. 检查依赖库是否完整安装');
        console.log('   3. 查看详细错误信息');
        console.log('   4. 尝试重新安装: cd electron && npm run setup-python\n');
    }

    process.exit(allPassed ? 0 : 1);
}

// 运行测试
runTests().catch(error => {
    console.error('\n❌ 测试过程出错:', error.message);
    process.exit(1);
});
