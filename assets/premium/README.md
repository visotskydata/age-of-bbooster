Premium assets setup
====================

1. Copy `manifest.example.json` to `manifest.json`.
2. Put your premium `.glb` files into `assets/premium/`.
3. Update file names and animation names in `manifest.json`.
4. Reload the game.

Notes
-----

- `models.<key>.urls` is priority ordered.
  First URL that loads successfully will be used.
- `targetHeight` helps normalize model scale.
- `yawOffset` can fix forward direction mismatch.
- `classActions` controls player attack/cast clips.
- `mobModelMap` maps mob type to model key from `models`.
- `mobActions` controls mob `idle/run/walk/attack` clip names.
