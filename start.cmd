@echo off
chcp 65001 >nul
title modao-open
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8788/
  python -m http.server 8788 --bind 127.0.0.1
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8788/
  npx --yes http-server -p 8788 -a 127.0.0.1 -c-1
  goto :eof
)

echo 没找到 python 或 node。
echo 直接双击 index.html 也可以，但浏览器会拦截 ES module（需要本地服务器）。
pause
