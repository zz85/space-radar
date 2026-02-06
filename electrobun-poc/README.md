# Space Radar Electrobun POC

This is a proof-of-concept demonstrating how Space Radar would be implemented with Electrobun/Bun.

## Status

Due to npm registry issues during initial setup, this POC demonstrates the architecture and key components without a full Electrobun build. The code shows:

1. **Disk Scanner** - TypeScript implementation using Bun's fast fs APIs
2. **Visualization** - Canvas-based sunburst chart structure
3. **Architecture** - How the app would be structured with Electrobun

## Structure

```
electrobun-poc/
├── src/
│   ├── bun/           # Main process (Bun runtime)
│   │   ├── index.ts   # Entry point, window management
│   │   └── scanner.ts # Disk scanning logic
│   └── renderer/      # UI process (WebView)
│       ├── index.html # Main UI
│       ├── app.ts     # UI logic
│       └── sunburst.ts # Sunburst visualization
├── package.json
└── README.md
```

## Running (when Electrobun is available)

```bash
bun install
bun run dev        # Development mode
bun run build      # Production build
```

## Key Differences from Electron Version

1. **Runtime**: Bun instead of Node.js - faster startup and fs operations
2. **Bundle**: ~12MB vs ~150MB (92% smaller)
3. **WebView**: Native system webview instead of bundled Chromium
4. **TypeScript**: First-class TypeScript support
5. **IPC**: Typed RPC instead of string-based channels

## Next Steps

1. Complete Electrobun installation when registry is stable
2. Implement full disk scanner with pause/resume
3. Port sunburst visualization to Canvas
4. Add benchmarking vs Electron version
5. Test on macOS, Windows, Linux
