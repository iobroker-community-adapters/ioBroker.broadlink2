@echo off

echo "test.bat started:" %*
SET iobd=c:\iobroker\Test2\nodejs
cd /d "%iobd%"
rem Ensure this Node.js and npm are first in the PATH
set "PATH=%iobd%\..\env\npm;%iobd%;%PATH%"

setlocal enabledelayedexpansion
pushd "%iobd%"

rem Figure out the Node.js version.
set print_version=.\node.exe -p -e "process.versions.node + ' (' + process.arch + ')'"
for /F "usebackq delims=" %%v in (`%print_version%`) do set version=%%v

rem Print message.
if exist npm.cmd (
  echo Your environment has been set up for using Node.js !version! and npm.
  echo.
) else (
  echo Your environment has been set up for using Node.js !version!.
  echo.
)

popd
endlocal

rem Set marker
set "iob_node_marker=true"

rem Change directory to iobroker root
cd /d "%iobd%\.."
rem cd /d c:\iobroker\Test2
echo upload %1
cmd /C .\iob.bat upload %1
IF /I NOT %3==n node %3=localhost:9229  %2/%1.js --force --logs --nolazy