# Smash or Pass

Control panel + OBS display for a three-phase Smash or Pass stream.

1. **Phase 1:** every character is shown picture-only (Cold Read), then revealed, then rated Smash or Pass.
2. **Phase 2:** the Pass pile plays a single-elimination bracket.
3. **Phase 3:** the Smash pile plays a single-elimination bracket.

Piles that aren't a power of two get a play-in round (N - P matches, where P is the largest power of two below N); everyone else gets a bye.

## Run locally

```
npm install
npm run dev
```

Control panel: `http://localhost:5173/smash-or-pass/`
Display view: `http://localhost:5173/smash-or-pass/?view=display`

## Deploy to GitHub Pages

1. In `vite.config.ts`, set `REPO_NAME` to your repository name.
2. Push to `main`. In the repo settings, set Pages → Source to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push.

## OBS setup

- Display: add a **Browser Source** pointing at the `?view=display` URL (1920x1080). The page background is transparent.
- Control: add the plain URL as a **Custom Browser Dock** (View → Docks → Custom Browser Docks).
- The two views sync through `BroadcastChannel`, the `storage` event, and a 1-second storage poll. **Test this in your OBS before the stream**: dock and source need to share a browser profile. If they don't sync, open the control panel in a normal browser and capture the display as a window instead.

## Images

- Roster images live in `public/characters/<id>.jpg`. The expected filename for each character is the `image` field in `src/data/roster.json`. A missing image shows the character's initials.
- New Challenger redeems take either an image URL or a local file. Local files are downsized and stored inside the save, so they only exist in that browser.

## Running the show

- **Log a redeem** in the control panel, then approve or reject it from the queue.
- **New Challenger** only works during Phase 1; it adds to the end of the queue or plays next.
- **Lore Drop:** a viewer's lore pitch to sway Lady__Shady's verdict. Approve it to show it on screen; it closes on Done or the next verdict.
- **Lawyer Up:** Start 60s begins the countdown on the display.
- **Undo** reverts the last action. State autosaves to the browser after every action; Export/Import saves it to a file.
