@echo off

cd lore
start /MIN /B "" node loreofthetokels.js 
cd ..
start /MIN /B "" npm run lore
