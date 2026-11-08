# Heatmap Widgets

Calendar heatmaps pinned to your Windows 11 desktop. Create a theme, such as **Workout** or **Study**, and track each day's intensity with a single click directly on the widget.

## Installation

Run `dist/Heatmap Widgets Setup 0.1.0.exe`.

The installer is not digitally signed, so Windows SmartScreen may display a warning the first time you run it. To proceed, click **More info** and then **Run anyway**.

## How to Use

| Action | Result |
|---|---|
| Left-click a day | Increases its intensity, cycling from 0 to 4 |
| Right-click a day | Clears the day |
| Hover over a day | Displays the date and intensity level in the footer |
| Drag the title bar | Moves the widget, snapping it to the desktop icon grid when released |

The system tray icon provides access to the app menu:

- **Manage Heatmaps:** Create, rename, change the color of, and delete themes.
- **Start with Windows:** Enabled by default.
- **Quit:** Exits the app and closes all widgets.

Widgets stay behind other windows but above desktop icons. To see them, press `Win+D`. They do not rearrange desktop icons: a widget placed over an icon will cover it.

Each widget displays 6 months, starting from the month it was created. Once the fifth month ends, the first month disappears from view at each new month. For example, a heatmap created in November displays November through April. In April, it shifts forward to December through May. Days that disappear from view remain saved.

## Data Storage

All data is stored locally on your PC at:

`%APPDATA%\heatmap-widgets\data.json`

If the file becomes corrupted, the app saves a backup as `data.corrupt-<number>.json` in the same folder and starts with an empty dataset.

## Development

```bash
npm install
npm start           # Run the app
npm test            # Run unit tests
npm run test:e2e    # Run end-to-end tests
npm run dist        # Build the installer in dist/
```

End-to-end tests open actual widgets on the desktop for a few seconds. They use a temporary directory and do not modify your data.
