# Group Loot

Group Loot adds a shared party loot bag to Foundry VTT.
All players can view and edit loot and currency while data is safely stored inside the world and synchronized in real time.

A bag icon is added to the Scene Controls for quick access.

![group loot](https://github.com/user-attachments/assets/5d55c32b-cbef-49d2-bf25-7d8959eafe23)


**Quick Note:** Only a GM can see the "Clear" option. We all know a Dave that would accidentally click it.

## Features

Shared party loot list (item name, quantity, notes)

Shared party currency (Platinum, Gold, Silver, Copper)

Real-time updates across all connected clients

GM-authoritative persistence (no permission juggling)

No Actors, Journals, or Items created

## Data Storage

All data is stored inside the Foundry world using a hidden world setting.

Storage details:

Module ID: group-loot

Setting Key: lootData

Scope: world

Visible in Settings UI: No

### What this means

- No external database

- No files to manage

- No APIs or tokens

- Persists across reloads and server restarts

- Travels with your world backup

## Stored Data Structure

Loot is stored as a small JSON object:
```
{
  "items": [
    {
      "id": "abc123",
      "name": "Longsword",
      "qty": 1,
      "notes": ""
    }
  ],
  "currency": {
    "pp": 0,
    "gp": 125,
    "sp": 40,
    "cp": 12
  }
}
```

This structure is versioned internally to allow future upgrades.

## Multiplayer Synchronization

Foundry restricts world-scope setting writes to the GM.
Group Loot uses a GM-authoritative request model:

1. A player makes a change in the UI.
2. The module sends a request over the module socket channel.
3. A connected GM client receives and validates the request.
4. The GM persists the update using game.settings.set(...).
5. Foundry broadcasts the updated setting to all clients.
6. Any open Group Loot windows automatically re-render.

Players request changes → GM persists them → everyone stays in sync

_If no GM is connected, players will be notified that changes cannot be saved._

## Concurrency & Safety

Changes are applied as small patch operations:
add / update / delete / clear

Requests are processed in order by the GM.

Designed for typical tabletop usage (party inventory tracking).

No documents (Actors, Journals, Items) are created or modified.

## Compatibility

Foundry VTT: v13+

System: System-agnostic

## Installation

Install via the Foundry package manager or manually by placing the module folder in:

FoundryVTT/Data/modules/group-loot
