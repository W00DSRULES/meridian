# Meridian

Meridian is a shared capability tree. Sales, dev, and engineering use one board to see what is connected, what the team is good at, bad at, or neutral on, and what is being done now, left alone, or the natural next step.

The board is drawn like a strategy-game tech tree: four eras from left to right, cards in those columns, and directed links from a prerequisite to what it leads to. There is one board for everyone. There are no accounts.

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
- Mark proficiency (good at, bad at, neutral) and commitment (doing now, not doing, next step)
- Drag a card into another era column to rearrange it
- Drag from the gold notch on the right of a card to the left of another to draw a “leads to” link
- Select a link and remove it

## Limits

- One shared board, no login, no separate rooms
- Last write wins if two people edit the same card at once
- Up to 300 capabilities and 600 links
- Names are whatever the browser sends; nothing verifies identity
