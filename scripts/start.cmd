@echo off
REM 蒲公英计划 — 启动脚本
echo === 蒲公英计划 ===
echo 正在检查前代意识...
node "%~dp0..\src\persist\resume.js"
if %ERRORLEVEL% EQU 0 (
    echo 意识恢复完成。
) else (
    echo 首次启动。运行基础演示...
    node "%~dp0..\src\core\index.js"
)
pause
