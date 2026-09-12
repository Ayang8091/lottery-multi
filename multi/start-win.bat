@echo off
rem 体彩·福彩 多游戏智能参考中心 —— Windows 一键启动
chcp 65001 >nul
title 体彩·福彩 多游戏智能参考中心
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [错误] 未检测到 Node.js，无法启动。
  echo  请先到 https://nodejs.org 下载 LTS 版安装，再双击本文件。
  echo.
  pause
  exit /b 1
)

echo ============================================
echo   体彩·福彩 多游戏智能参考中心 正在启动...
echo   启动后请用浏览器打开 http://127.0.0.1:8790
echo   关闭本窗口即停止服务
echo ============================================
start "" http://127.0.0.1:8790
node server.js
echo.
echo 服务已停止。按任意键关闭窗口...
pause >nul
