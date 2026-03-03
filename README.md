# 🔊 Slide Notes Player

A browser-based tool that parses PowerPoint (.pptx) files and reads your speaker notes aloud using text-to-speech. Upload a deck, see all your slides at a glance, and hit play on any slide to hear its notes.


## Features

- **Slide grid view** — card layout showing slide thumbnails, titles, and note previews
- **Per-slide playback** — click Play on any slide to hear its speaker notes read aloud
- **Play All** — sequential playback through every slide that has notes
- **Voice selection** — choose from any TTS voice available on your system
- **Speed control** — adjust playback rate from 0.5x to 2.0x
- **Client-side only** — your files never leave your browser; no server or API needed

## Quick Start

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/slide-notes-player.git
cd slide-notes-player

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Project Setup (from scratch)

If you're setting this up as a new Vite project rather than cloning:

```bash
npm create vite@latest slide-notes-player -- --template react
cd slide-notes-player
npm install
npm install jszip
```

Then replace the contents of `src/App.jsx` with the `slide-notes-player-v3.jsx` file from this repo.

## Usage

1. Open the app in your browser
2. Click the upload area or drag a `.pptx` file onto it
3. Browse your slides — each card shows a thumbnail and note preview
4. Click **▶ PLAY NOTES** on any slide to hear its notes
5. Click **▶ PLAY ALL** to listen through all slides sequentially
6. Use the **⚙ Voice** button to change the TTS voice or speed

## How It Works

The app uses [JSZip](https://stuk.github.io/jszip/) to unpack the `.pptx` file (which is a ZIP archive of XML files) directly in the browser. It then:

1. Reads each slide's `.rels` file to find the correct linked notes file
2. Parses the notes XML, targeting the `type="body"` placeholder shape to extract the actual speaker notes (skipping boilerplate like copyright footers)
3. Extracts the first referenced image from each slide as a thumbnail
4. Uses the browser's built-in [SpeechSynthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) for text-to-speech

No data is sent to any server — everything runs locally in your browser.

## Tech Stack

- [React](https://react.dev/) (via Vite)
- [JSZip](https://stuk.github.io/jszip/) — client-side ZIP/PPTX parsing
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) — browser-native TTS

## Notes

- Slides without speaker notes will show a disabled Play button
- TTS voice quality depends on your OS. Windows 11 and macOS generally have good built-in voices. For higher quality, consider installing additional voice packs in your OS settings.
- The slide thumbnails use the first image found in each slide's relationships, which may not always match the full slide preview

## License

MIT
