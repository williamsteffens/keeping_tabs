# Keeping Tabs

Firefox MV3 extension with:

- A dedicated manager window opened from the toolbar.
- Best-effort positioning centered over the focused browser window.
- Duplicate URL groups across windows (fragments ignored; queries retained).
- Review-and-confirm flow for closing selected duplicate tabs.
- One-click unloading of inactive tabs, plus individual selection.
- Automatic unloading after a configurable inactivity threshold.
- Badge count of discarded tabs.

## Build and install temporarily

Requires Node.js 22.12 or newer and npm.

```sh
npm install
npm run build
```

1. In Firefox, open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `dist/manifest.json`.
3. Click the extension's toolbar button to open the manager.
4. Open **Settings** inside the manager to configure automatic unloading.

Load the built extension from `dist/`. `src/manifest.json` is a build input;
TypeScript source files cannot be loaded directly as an extension.

Temporary add-ons are removed when Firefox restarts. For permanent use,
package/sign the contents of `dist/` through Mozilla's add-on distribution
process.

## Development

```sh
npm run dev
```

Vite watches the source and rebuilds the extension in `dist/`. After a rebuild,
click **Reload** for the extension in Firefox's debugging page and reopen the
manager window. This workflow runs the extension with Firefox's `browser` APIs.

```sh
npm run typecheck
npm test
npm run build
```

TypeScript runs in strict mode. The production build checks types before Vite
bundles the manager page, styles, and background script. The manifest is copied
to the output, and the background entry retains its manifest path. Development
watch builds transpile TypeScript; run the type check separately during edits.

## Notes

- Tab titles and URLs stay local; no tab information is sent anywhere.
- Duplicate matching ignores URL fragments but retains query parameters.
- Active and pinned tabs are not preselected for closure. Manual selection is
  allowed, and the confirmation dialog identifies those tabs.
- The currently active tab cannot be discarded by `tabs.discard()`.
- Firefox/platform window placement can override the requested popup position.

## Project structure

- `src/manifest.json`: source Firefox extension manifest.
- `vite.config.ts`: manager/background entries and manifest packaging.
- `tsconfig.json`: strict TypeScript configuration.
- `src/core/background/background.ts`: lifecycle, toolbar, alarms, and messages.
- `src/core/settings.ts`: shared defaults and stored settings access.
- `src/core/types.ts`, `src/core/messages.ts`: types and message contracts.
- `src/core/tabs.ts`: queries for tabs with usable IDs.
- `src/modules/tabs/`: duplicate detection and tab inactivity tracking.
- `src/ui/manager.html`, `src/ui/manager.css`, `src/ui/manager.ts`: manager window.
- `src/ui/components/`, `src/ui/utils.ts`: rendering and DOM helpers.
- `src/options/settings.ts`: settings view rendering and save handling.
- `tests/`: duplicate matching, escaping, and message validation checks.
- `dist/`: generated extension ready to load in Firefox (ignored by Git).
