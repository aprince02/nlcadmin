@echo off
setlocal enabledelayedexpansion
set "commit_msg=Automatic commit on %date% at %time%"
echo Pushing to GitHub...
git add .
git commit -m "!commit_msg!"
git push origin dev
