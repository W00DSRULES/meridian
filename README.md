# Meridian

Meridian is a shared capability tree. Sales, dev, and engineering use one board to see what is connected, how far the milestones have come, and what the team is ready to do next.

The board is drawn like a strategy-game tech tree: era plaques across the top, framed cards in columns, and gold links from a prerequisite to what it leads to. A card's border color is the team's read on it (good at, bad at, or neutral). Open a card to write the longer description and to add, edit, check off, or delete milestones. There is one board for everyone. There are no accounts.

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
- Open a card to edit the subtitle, the longer description, proficiency, and commitment
- Add, rename, check off, and delete milestones. The card shows completed/total
- Drag a card into another era column to rearrange it
- Drag from the gold notch on the right of a card to the left of another to draw a “leads to” link
- Select a link and remove it

## Limits

- One shared board, no login, no separate rooms
- Last write wins if two people edit the same card at once
- Up to 300 capabilities, 600 links, and 12 milestones on a card
- Names are whatever the browser sends; nothing verifies identity
