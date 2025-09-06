@echo off
setlocal enableextensions
set RES_DIR=%~1
if "%RES_DIR%"=="" (
  echo Missing RESOURCE_DIR argument
  exit /b 1
)

pushd "%RES_DIR%"
call npm run lint || exit /b 1
call npm run build || exit /b 1
popd

endlocal

