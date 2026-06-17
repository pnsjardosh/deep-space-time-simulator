# Deep Space Time Simulator

Standalone educational simulator for galactic-scale motion and pole-star precession.

## Run Locally

```bash
npm start
```

Then open:

```text
http://127.0.0.1:4180/
```

## Current Scope

- Solar System location in the Orion-Cygnus Spur / Local Arm.
- Approximate orbit around the Milky Way's galactic center.
- Deep-time playback with manual year entry beyond +/-50,000 years.
- Playback speeds from 100 years/sec to 10 million years/sec.
- North and south pole-star candidates from axial precession.

## Data And Visual Sources

- Milky Way background: NASA/JPL-Caltech Spitzer artist concept PIA10748.
- Structure model: Sun in Orion Spur between Sagittarius and Perseus arms; Milky Way with central bar and major Perseus / Scutum-Centaurus arms.
- Timing model: educational galactic year approximation of about 230 million years.

This is an educational visualization, not a full numerical galactic dynamics simulator.

At 100 years/sec, true galactic rotation is nearly invisible because one solar orbit around the Milky Way is roughly 230 million years. Use million-year playback speeds to see galaxy-scale motion.
