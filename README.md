# GENESIS

A living medieval city simulation built with Three.js. Watch as a city grows itself from empty land over hours — roads snake outward from a central market, buildings cluster along them, citizens develop routines, and the city finds its own internal logic.

This is not a game. It's a living artwork.

## How It Works

Open the browser and watch. A vast empty landscape — rolling hills, a river, ancient trees — slowly transforms into a thriving medieval settlement. Every run produces a unique city driven by emergent simulation systems.

## Technical Stack

- **Three.js** — All geometry built procedurally from primitives
- **Vite** — Development and build tooling
- **Vanilla JS** — No framework overhead

## Systems

- **Terrain** — Simplex noise elevation, rivers, forests
- **Road Network** — A* pathfinding with noise perturbation for organic curves
- **Building Spawner** — Zone-based placement with unique procedural geometry per type
- **Citizen Agents** — Daily schedules, pathfinding, foot traffic
- **Day/Night Cycle** — Dynamic lighting, god rays, candlelit windows
- **Decay & Renewal** — Buildings age, collapse, and make way for new growth
- **Weather & Seasons** — Rain, snow, seasonal color shifts
- **Post-Processing** — Bloom, film grain, depth of field, color grading

## Running

```bash
npm install
npm run dev
```

## License

MIT
