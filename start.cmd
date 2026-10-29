@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo 第一次运行，先装依赖...
  call pnpm install
  if errorlevel 1 goto fail
)

if not exist "apps\web\node_modules\vite\bin\vite.js" (
  echo 前端依赖缺失，重装一次...
  call pnpm install
  if errorlevel 1 goto fail
)

start "" http://localhost:5173
node dev.mjs
goto end

:fail
echo.
echo 安装失败。检查 Node 版本是否在 22 以上：node -v
pause

:end
