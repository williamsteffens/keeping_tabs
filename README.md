# Keeping Tabs

Firefox MV3 extension with:

- An Alt+K tab picker with title/URL search, activity badges, and window filters.
- A searchable command palette opened from the toolbar or with `Alt+Shift+K`.
- An optional page overlay with a blurred background.
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
4. Click the **Settings** gear in the manager to configure automatic unloading.

Press **Alt+K** (**Option+K** on macOS) to search all open tabs. Use arrow
keys and Enter to switch to a tab, including tabs in another window. Filter
by Active, Inactive, or Unloaded, choose a window, and toggle **Group by window**.
“Active” means the selected tab in each Firefox window. Tabs are listed by
recent access when grouping is off. Selecting a tab closes the picker.
The picker follows the manager’s window/overlay setting and is also available
through **Search open tabs** or the **Tabs** button. Check or change Alt+K
under **Settings → Tab picker shortcut**, or in Firefox’s
**Manage Extension Shortcuts** page. Firefox may leave a shortcut unassigned
when another extension or browser shortcut conflicts.

The manager shortcut is `Alt+Shift+K` (`Option+Shift+K` on macOS).
To change it, click the **Settings** gear in the manager, focus **Open manager shortcut**,
press the desired keys, and click **Save shortcut**. To disable it, click
**Clear**, then **Save shortcut**. You can also use Firefox's
**Manage Extension Shortcuts** page.

Type to filter commands, use the arrow keys to select, and press Enter to run.
**Unload all inactive tabs** runs directly from the command list. Duplicate
review and individual unloading open inside the same manager. The gear
button in the header opens settings.
Use the back button or Escape to return to commands. In the command list,
Escape clears a search first, then closes the manager.

In **Settings**, choose **Page overlay** under **Open manager as** and save.
The toolbar button and shortcut will then open the manager above the current
page, with the background dimmed and blurred. Close it with **Close**, Escape,
or by clicking outside the manager. Activating the toolbar button or shortcut
again also closes it. The preference takes effect the next time you open it.
Pages that Firefox protects from script injection open a separate window.

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
- Active tabs and all Firefox `about:` pages are excluded from unloading.
  “Ready to unload” counts only eligible loaded tabs. Unload results count
  tabs confirmed as discarded by Firefox, since the API can silently skip tabs.
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
- `src/ui/overlay.ts`: top-layer page overlay and background blur.
- `src/options/settings.ts`: settings view rendering and save handling.
- `tests/`: duplicate matching, escaping, and message validation checks.
- `dist/`: generated extension ready to load in Firefox (ignored by Git).
