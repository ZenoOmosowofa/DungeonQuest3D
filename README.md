# Dungeon Quest 3D
This game is designed exclusively for PC platforms and will not be compatible with mobile devices such as phones.

A browser-based 3D roguelike built with `Three.js`. Choose a class, explore procedural dungeons, fight monster packs and bosses, collect coins and potions, and return to the Ancient Hub to prepare for the next run.

## Current Gameplay

Dungeon Quest 3D starts in the hub with a class selection screen. After choosing a class, you enter a safe town area with a hub map, health display, controls panel, and a town power panel that shows your total slash damage. From the hub you can enter the shop, spend coins on upgrades, and step into the dungeon portal to begin a run.

Inside the dungeon, the game switches to dungeon-specific UI with a minimap, health bar, movement and combat controls, and procedural floors filled with enemies, treasure chests, potions, and a boss exit loop. If you die, a game over screen appears with run stats and clicking it resets the run back to class selection and base-level progression.

## Classes

- **Tank**: 220 HP, base damage 15, starting slash 28, speed 5.8
- **Hunter**: 170 HP, base damage 20, starting slash 37, speed 6.8
- **Assassin**: 140 HP, base damage 24, starting slash 44, speed 7.2
- **Rogue**: 200 HP, base damage 18, starting slash 33, speed 7.0

Starting slash damage is based on the current critical slash multiplier used by the game.

## Features

- Class selection with unique starting stats
- Ancient Hub town with shop, health display, slash-damage display, and minimap
- Procedurally generated dungeon layouts with exploration turns and room-based encounters
- Enemy variety including slimes, goblins, orcs, and bosses
- Coins, potions, treasure chests, quests, and permanent reward upgrades
- Pause menu with stats, resources, quest text, and recent log entries
- Game over summary screen showing monsters slain, total health, and max slash damage
- Run reset flow that returns the player to class selection after death

## Controls

- `W A S D`: Move
- `Mouse`: Look around and attack
- `Shift`: Dash
- `Space`: Jump
- `Q`: Drink potion
- `E`: Interact
- `P`: Pause


## Project Files

- `index.html`: UI structure for HUD, overlays, store, and menus
- `style.css`: Layout, panel styling, transitions, and responsive presentation
- `game.js`: Core game loop, combat, dungeon generation, classes, enemies, HUD logic, and run state


