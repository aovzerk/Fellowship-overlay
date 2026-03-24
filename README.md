> [!IMPORTANT]
> If you are worried about using this overlay, we have confirmation from the developers that it is allowed and players will not be punished for using it before official in-game support.
>
> **Developer statement (CR_Jupiter):**
> 
> "Hello! I am back with news about the overlay:
>
> Adding trackers to relics, spirit abilities and more is something we want to be doing anyways (that is also including current pull % etc.) so we won't be punishing players who want to use it before official in-game support
>
> Anyone who want's to use it can, go ham 🍔"
>
> Source: CR_Jupiter  
> https://discord.com/channels/1254866410258038845/1268395520846467226/1485956620503617697

# Fellowship Overlay

Lightweight in-game overlay for tracking party members, relics, Spirit values, skill cooldowns, and recent actions in real time using combat logs.

> [!IMPORTANT]
> You must enable **ADVANCED COMBAT LOGS** in the game settings, otherwise the overlay will not receive the data it needs to work correctly.

## Join the Community

**Discord community:** [https://discord.gg/82BeHyQEeR](https://discord.gg/82BeHyQEeR)

## Features

- Real-time player tracking from the combat log
- Displays:
  - Spirit (numeric only)
  - Equipped relics with cooldown visualization
  - Selected skill cooldowns based on gem bonuses
  - Recent Skills
  - Pack percent (in dev)
- Smart Spirit highlighting based on gem bonuses
- Draggable UI
- Tray icon with access to settings

## How Overlay Input Works

The overlay can work in two modes:

- **Locked overlay**
  - The overlay is **click-through**
  - All mouse clicks pass through the overlay into the game
  - Use this mode while playing normally

- **Unlocked overlay**
  - The overlay is **not click-through**
  - The overlay captures mouse input
  - Use this mode when you want to drag or interact with overlay elements

## Controls

- **F8** — Toggle overlay lock state
  - When the overlay is **locked**, it passes all clicks through to the game
  - When the overlay is **unlocked**, it does **not** pass clicks through
- **F9** — Select log file
- **F10** — Shor or hide overlay
- **F11** — Open settings
## Tray

The application also runs in the **system tray**.

From the tray you can open the app and access **settings**.

## Screenshots

![Overlay Example](./screenshots/screenshot1.png)
![Overlay Example](./screenshots/screenshot2.png)
![Overlay Example](./screenshots/screenshot3.png)

## Installation

**Before using the overlay:**
- Enable **ADVANCED COMBAT LOGS** in the game settings

**Setup & Run:**
```bash
npm i          # install dependencies # Node.js 20+
npm start      # run in development mode
npm run dist   # build application
```
