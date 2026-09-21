@echo off
chcp 65001 >nul
echo ============================================
echo   炸红题库 - 防火墙配置工具
echo ============================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请以管理员身份运行此脚本！
    echo.
    echo 方法：右键点击此文件，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo [信息] 正在配置防火墙规则...
echo.

:: 删除已存在的规则（如果有）
C:\Windows\System32\netsh.exe advfirewall firewall delete rule name="炸红题库" >nul 2>&1
C:\Windows\System32\netsh.exe advfirewall firewall delete rule name="炸红题库-热点" >nul 2>&1
C:\Windows\System32\netsh.exe advfirewall firewall delete rule name="题库刷题系统" >nul 2>&1

:: 添加入站规则（允许所有网络类型访问本机50000端口）
echo [1/3] 添加主规则（所有配置文件）...
C:\Windows\System32\netsh.exe advfirewall firewall add rule name="炸红题库" dir=in action=allow protocol=tcp localport=50000 profile=any

:: 添加热点专用规则（公共网络）
echo [2/3] 添加热点规则...
C:\Windows\System32\netsh.exe advfirewall firewall add rule name="炸红题库-热点" dir=in action=allow protocol=tcp localport=50000 profile=public

:: 确保 ICMPv4 允许（用于 ping 测试）
echo [3/3] 允许 ping 请求...
C:\Windows\System32\netsh.exe advfirewall firewall add rule name="炸红题库-Ping" dir=in action=allow protocol=icmpv4 >nul 2>&1

if %errorLevel% equ 0 (
    echo.
    echo [成功] 防火墙规则已添加！
    echo.
    echo ============================================
    echo   配置完成！
    echo ============================================
    echo.
    echo 【WiFi局域网】手机和电脑连接同一WiFi
    echo   访问地址由 main.py 启动时显示
    echo.
    echo 【电脑热点】手机连接电脑开的热点
    echo   访问地址: http://192.168.137.1:50000
    echo.
    echo 【注意】如果还是无法访问，请检查：
    echo   1. 确认手机和电脑在同一网络
    echo   2. 尝试关闭电脑上的第三方杀毒软件
    echo   3. 在电脑上用浏览器先访问确认服务正常
    echo.
) else (
    echo.
    echo [错误] 添加防火墙规则失败！
    echo.
)

pause
