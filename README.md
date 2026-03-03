# 🔊 Slide Notes Player

A browser-based tool that parses PowerPoint (.pptx) files and reads your slide content aloud using text-to-speech. Upload a deck, see all your slides at a glance, and hit play to hear notes, slide text, or both.


## Features

- **Slide grid view** — card layout showing slide thumbnails, titles, and content previews
- **Read mode toggle** — switch between reading Notes only, Slide text only, or Both
- **Per-slide playback** — click Play on any slide to hear its content read aloud
- **Play All** — sequential playback through every slide that has content
- **Voice selection** — choose from any TTS voice available on your system
- **Speed control** — adjust playback rate from 0.5x to 2.0x
- **Client-side only** — your files never leave your browser; no server or API needed

## Quick Start

Requires [Node.js](https://nodejs.org/) (v18+).
```bash
git clone https://github.com/YOUR_USERNAME/slide-notes-player.git
cd slide-notes-player
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Project Setup (from scratch)

If you're setting this up as a new Vite + React project rather than cloning:
```bash
npm create vite@latest slide-notes-player -- --template react
cd slide-notes-player
npm install
npm install jszip
```

Then replace the contents of `src/App.jsx` with the `App.jsx` file from this repo and run `npm run dev`.

## Usage

1. Open the app in your browser
2. Click the upload area or drag a `.pptx` file onto it
3. Use the **Notes | Slides | Both** toggle to choose what gets read aloud
   - **Notes** — reads only the speaker notes
   - **Slides** — reads the visible text on each slide
   - **Both** — reads slide text first, then the notes
4. Click **▶ PLAY** on any slide to hear its content
5. Click **▶ PLAY ALL** to listen through all slides sequentially
6. Use the **⚙ Voice** button to change the TTS voice or speed
7. Click the text preview on any card to expand and read the full content

## How It Works

The app uses [JSZip](https://stuk.github.io/jszip/) to unpack the `.pptx` file (which is a ZIP archive of XML files) directly in the browser. It then:

1. Reads each slide's `.rels` file to find the correct linked notes file
2. Parses the notes XML, targeting the `type="body"` placeholder shape to extract the actual speaker notes (skipping boilerplate like copyright footers)
3. Extracts visible text from each slide's XML
4. Pulls the first referenced image from each slide as a thumbnail
5. Uses the browser's built-in [SpeechSynthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) for text-to-speech

No data is sent to any server — everything runs locally in your browser.

## Tech Stack

- [React](https://react.dev/) (via Vite)
- [JSZip](https://stuk.github.io/jszip/) — client-side ZIP/PPTX parsing
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) — browser-native TTS

## Notes

- Slides without content for the selected mode will show a disabled Play button
- TTS voice quality depends on your OS. Windows 11 and macOS generally have good built-in voices. For higher quality, consider installing additional voice packs in your OS settings.
- The slide thumbnails use the first image found in each slide's relationships, which may not always match the full slide preview

## License

MIT
