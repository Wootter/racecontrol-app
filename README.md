# RaceLeague Driver Panel — Desktop App

## Installation

1. Install Node.js from https://nodejs.org (v18 or higher)
2. Open a terminal in this folder
3. Run: npm install
4. Run: npm start

## Building an .exe installer

1. Run: npm run build
2. Find the installer in the `dist/` folder
3. Run the installer — app will appear in Start Menu

## First launch

1. Enter your API URL (from your Discord log channel)
2. Select your driver name from the dropdown
3. Enter your Discord ID
4. Set your keybinds (default: F1=Blue Flag, F2=Next Lap, F3=Pitting)
5. Click "Save & Launch Panel"

## Features

- Global hotkeys — work even when ERLC is fullscreen
- Real-time flag notifications with audio through your speakers
- Live leaderboard
- Pitting toggle (one key in/out)
- 7 second cooldown with visual bar
- Always on top option
- Runs in system tray
