# Meridian

Meridian is a shared capability tree. A campaign is one saved tech tree that several people edit together. Sales, dev, and engineering use it to see what is connected, how far the milestones have come, and what the team is ready to do next.

The board is drawn like a strategy-game tech tree: era columns left to right, starting with MVP, Traction, Scale, and Horizon. Each column has a plaque you can rename, and you can add an era or move one earlier or later. A bar's color follows its milestones, from near black when nothing is done, through blue while work is underway, to green when every milestone is done. A mark beside the title — fire, a melting face, or a shrug — shows how the team reads that capability. Open a bar to write the subtitle and the longer description, pick its era, and add, edit, check off, or delete milestones. There are no accounts.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The dev server listens on `0.0.0.0:43123`.

The first visit in a browser asks for a display name and stores it in `localStorage`. That name is stamped on capabilities you add or edit. Home lists the campaigns this browser has created or joined. Invite copies a link; anyone who opens it joins that campaign and sees edits within about two seconds.

## How the board is stored

Campaigns, eras, techs, milestones, and links live in Supabase. The Next.js server and the CLI talk to Supabase with the service role key. The browser never sees that key.

Copy `.env.example` to `.env.local` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not prefix either one with `NEXT_PUBLIC_`. Do not commit real keys. `.env.local` is gitignored.

Run `supabase/schema.sql` once in the Supabase SQL editor. That creates the tables and the `bump_campaign` function. Row level security is on and there are no anon policies, so the public API key cannot read the tables.

When those values are set and the tables are empty, the first request seeds the example tree as a campaign named Example tree. Edits save as they happen. If the variables are missing, the app says so: Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

## CLI

An agent can read and edit a campaign without the UI. The CLI uses the same Supabase tables as the app.

```bash
npm run meridian -- --help
node cli/meridian.mjs --help
```

Stdout is one JSON object, except `--help`, which prints the text below. Pass flags, or pipe a JSON object on stdin. Flags win when both are set. Exit 0 on success and on `--help`. Exit 1 when Supabase or the request fails. Exit 2 on bad usage.

`node cli/meridian.mjs` prints JSON only. `npm run meridian -- <command>` runs that same file. npm also prints a two-line script banner, so an agent parsing JSON should use `npm run --silent meridian -- <command>`.

```text
meridian campaigns list
meridian campaigns create --name <name> [--author <name>]
meridian tree dump --campaign <id>
meridian techs create --campaign <id> --title <title> [--description <text>] [--detail <text>] [--glyph <glyph>] [--proficiency good|bad|neutral] [--commitment doing|not_doing|next] [--era <id-or-name>] [--author <name>]
meridian techs update --campaign <id> --id <tech-id> [--title <title>] [--description <text>] [--detail <text>] [--glyph <glyph>] [--proficiency good|bad|neutral] [--commitment doing|not_doing|next] [--era <id-or-name>] [--author <name>]
meridian techs delete --campaign <id> --id <tech-id>
meridian techs move --campaign <id> --id <tech-id> --era <id-or-name> [--author <name>]
meridian milestones add --campaign <id> --tech <tech-id> --name <name> [--done true|false] [--author <name>]
meridian milestones set --campaign <id> --tech <tech-id> --id <milestone-id> --done true|false [--name <name>] [--author <name>]
meridian links add --campaign <id> --from <tech-id> --to <tech-id> [--author <name>]
meridian links remove --campaign <id> (--id <link-id> | --from <tech-id> --to <tech-id>)
meridian eras rename --campaign <id> (--id <era-id> | --era <id-or-name>) --name <name> [--author <name>]
```

`--author` defaults to `Meridian CLI`. `techs create` defaults proficiency to `neutral` and commitment to `next`. `milestones add` defaults `--done` to false. A dumped tree is `{ campaign, revision, eras, techs, links }` with milestones nested on each tech. Glyphs are compass, quill, lantern, lens, sprout, beacon, keystone, and anchor.

`techs create` accepts a `milestones` array on stdin, each item `{ "name", "done" }`.

## What you can do

- Add, edit, and remove capability cards
- Open a bar to edit the subtitle, the longer description, commitment, and which era it sits in. The mark beside the title is how the team reads it
- Add, rename, check off, and delete milestones. The card shows completed/total, and the progress bar counts the whole tree
- Drag from the dot on one bar and drop it on another bar to draw what it leads to
- Open a bar to add or remove those links from the Leads to and Comes from lists
- Select a link on the board and remove it
- Drag a bar into another era column to move it there. Rename a plaque, add an era, or shift one left or right
- Create a campaign, reopen it from the list, and invite others with a link

## Limits

- No login. A campaign is shared with anyone who has its link
- Last write wins if two people edit the same card at once
- Up to 300 capabilities, 600 links, 12 milestones on a card, and 8 eras
- Names are whatever the browser sends; nothing verifies identity
