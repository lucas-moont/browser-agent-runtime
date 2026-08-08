# Browser Agent Runtime

Chrome Manifest V3 extension scaffold: Vite + React + TypeScript + `@crxjs/vite-plugin`, with a side panel shell opened from the toolbar action.

## Scripts

- `npm run dev` — Vite + CRXJS development build (watch)
- `npm run build` — typecheck and production build into `dist/`
- `npm test` — Vitest smoke tests

## Load unpacked in Chrome

1. Run `npm install`, then `npm run build`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist` folder in this repo.
5. Pin the extension, then click the toolbar action to open the side panel titled **Browser Agent Runtime**.

For iterative development, use `npm run dev` and reload the unpacked extension after CRXJS updates the output.

## Scope

This commit is scaffold only. Agent runtime, tools, and Chrome Built-in AI adapters are not implemented yet.
