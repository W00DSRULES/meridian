# Meridian

Meridian is a shared capability tree. Sales, dev, and engineering use one board to see what is connected, how far the milestones have come, and what the team is ready to do next.

The board is drawn like a strategy-game tech tree: era columns left to right, starting with MVP, Traction, Scale, and Horizon. Each column has a plaque you can rename, and you can add an era or move one earlier or later. A bar's color follows its milestones, from near black when nothing is done, through blue while work is underway, to green when every milestone is done. A mark beside the title — fire, a melting face, or a shrug — shows how the team reads that capability. Open a bar to write the subtitle and the longer description, pick its era, and add, edit, check off, or delete milestones. There is one board for everyone. There are no accounts.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The dev server listens on `0.0.0.0:43123`.

The first visit in a browser asks for a display name and stores it in `localStorage`. That name is stamped on capabilities you add or edit. Other open browsers pick up changes within about two seconds.

## How the board is stored

Nodes and links live in `data/board.sqlite` (created on first run, gitignored). Route handlers under `src/app/api` read and write that file with `better-sqlite3`. Restarting the dev server keeps the board.

## What you can do

- Add, edit, and remove capability cards
- Open a bar to edit the subtitle, the longer description, commitment, and which era it sits in. The mark beside the title is how the team reads it
- Add, rename, check off, and delete milestones. The card shows completed/total, and the campaign bar counts the whole tree
- Drag from the dot on one bar and drop it on another bar to draw what it leads to
- Open a bar to add or remove those links from the Leads to and Comes from lists
- Select a link on the board and remove it
- Drag a bar into another era column to move it there. Rename a plaque, add an era, or shift one left or right

## Limits

- One shared board, no login, no separate rooms
- Last write wins if two people edit the same card at once
- Up to 300 capabilities, 600 links, 12 milestones on a card, and 8 eras
- Names are whatever the browser sends; nothing verifies identity
