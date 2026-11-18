# NIGHT RIDE

A browser-based, atmospheric motorcycle riding prototype built with Vite, React, TypeScript, Three.js, and React Three Fiber. The highway, lights, scenery, and rain use procedural geometry; vehicle GLBs load from public Poly Pizza CDN assets with procedural fallbacks when offline.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Production build: `npm run build`.

## Controls

- **W / Up Arrow** accelerate; **S / Down Arrow** brake; **A / Left Arrow** and **D / Right Arrow** steer.
- **C** swaps chase and cockpit cameras; **P** toggles Auto-Ride; **H** hides/restores the entire ride HUD; **Esc** pauses/resumes.
- Manual movement input immediately cancels Auto-Ride. The on-screen touch controls have been removed for a cleaner view.

## Progress

- [x] Milestone 1: stable keyboard input, acceleration, braking, continuous lateral steering, speed readout, continuous road, and chase/cockpit cameras. Tested in browser.
- [x] Milestone 2 foundation: procedural night highway, lamps, fog, roadside scenery, wet-road material, and rain particles.
- [x] Milestone 3 foundation: four environment choices, weather/time presets, distinct light/heavy rain, and occasional thunderstorm flashes.
- [x] Milestone 4 foundation: local-file playlist, play/pause, automatic next track, music volume, and generated speed-responsive engine, wind, and rain sound layers.
- [x] Milestone 5 foundation: four selectable bike profiles with different handling, top speeds, body details, paint colors, and specifications.
- [x] Milestone 6 foundation: main menu, HUD, pause overlay, setup panel, and locally saved preferences.
- [x] Four-lane highway with three lane dividers, shoulders, and roadside barriers.
- [x] Recycled traffic with cars, SUVs/vans, headlamps/taillamps, Off/Low/Medium/High density, and speed-reduction collision feedback.
- [x] Headlight and target are parented to the motorcycle so they follow its lateral movement, lean, and camera mode.
- [x] Bike detailing pass: metallic engine/exhaust pieces, mirrors, sculpted tank/fairing, brighter LED, cockpit display/rev lights, and a simple brake backfire pulse.
- [x] Rain finish: lower-roughness wet asphalt, cockpit visor frame and animated rain streaks, plus mild camera sway.
- [x] Procedural Lo-Fi loop begins on Start Ride with a fade-in, bass/chord bed, and soft generated beat. The HUD shows the Lo-Fi title and animated spectrum; imported local tracks override the generated loop.
- [x] Auto-Ride uses P or the HUD toggle, targets 133–138 km/h up to a 150 km/h cap, reads live traffic positions, changes between clear same-direction lanes, and brakes when a lane change is unavailable.
- [x] Garage catalog now contains 12 model entries grouped into Sport, Naked, Touring, and Retro, with individual color defaults and handling/performance values.
- [x] Reduced ride HUD to camera, environment, Auto-Ride, music, and the H hint; speed remains visible. H hides all HUD elements and H restores them.
- [x] Generated Lo-Fi, Synthwave, and Phonk variations are selectable; passing traffic has a stereo-panned Doppler-style synthesized pass-by, and wind pitch rises with speed.
- [x] Traffic vehicles gained truck cargo bodies, metallic hubs/trim, grille and bumper details; Neon City billboards and Mountain Pass silhouettes are procedural.
- [x] Controls hotfix: global capture listeners now normalize physical key codes, so W/A/S/D, arrows, P, H, and C work regardless of keyboard layout or UI focus; arrow/space scrolling is suppressed during rides.
- [x] Garage hotfix: selecting a catalog ID remounts the actual bike model immediately; each model variant changes its wheelbase and handlebar stance alongside category-specific geometry.
- [x] Traffic-light hotfix: car/truck body heights and headlamp/tail-lamp placements are road-relative; the leading traffic vehicles use forward-aimed spotlights and close-range point lights.
- [x] Capture-phase window keyboard input is not blocked by focused UI elements; keys clear on browser blur/tab changes and while menus are open. `?debug=keys` shows an optional key indicator.
- [x] Generated radio uses low-passed, slowly changing warm chords with a quiet vinyl-noise bed; engine, wind, rain, and traffic tones are softened and have separate volume controls.
- [x] Road slabs meet without overlap, lane paint is lifted and depth-biased, and the camera uses a bounded near/far range to reduce depth artifacts.
- [x] Rain drops use independent fall rates, randomized spawn heights, lateral wind, and per-drop turbulence for continuous, non-synchronous motion.
- [x] First pointer or keyboard interaction resumes Web Audio and starts the radio from the menu; the ride HUD has a visible Play Music/Mute fallback. The procedural mix has a stronger, smooth master level.
- [x] Category-specific procedural silhouettes: sport fairings and nose, exposed naked-bike frame, touring fairing and panniers, retro round lamp and wire-spoke approximation.
- [x] Production build passed. Browser smoke-check verified ride startup, throttle/speed, camera toggle, Lo-Fi UI, and rain selection/particles/visor.
- [x] Hotfix browser check: W and Up accelerated (speed reached 78 and 27 km/h); S braked to 0; P enabled Auto-Ride and A cancelled it; C changed camera; H hid/restored HUD; selecting Grand Tour updated the selected bike profile and visible chase model. Browser console showed no errors.
- [x] Horizon hotfix: 72 recycled 12 m road segments cover about 804 m ahead and 60 m behind the rider. The active spawn buffer scales from 600 m to 800 m with speed, with 140 instanced streetlights and 180 instanced roadside trees recycled in the same long corridor. The camera far plane scales up to 830 m, while matching exponential fog (`#080812`, density `0.008`; denser for Fog weather) softens the distant boundary.
- [x] Rain now recycles each independently moving drop at ground level with a newly randomized spawn position and fall profile. Refined bike engine/seat silhouettes and added front brake-disc detailing.
- [x] High-speed browser check: throttle reached 228 km/h without a control or render failure; the extended roadway and fogged horizon remained visible. Production build and whitespace checks passed.
- [x] Removed the repeating overhead tunnel roof that could sit above the chase camera; softened the ride control panel and made H hide the speed, controls, captions, visor, debug readout, and transient ride notices together.
- [x] Procedural horizon upgrade: road tiles, lamps, and roadside scenery recycle individually behind the rider; 140 lamp posts and 180 tree instances are pre-generated and batched to reduce draw calls across the longer pool.
- [x] Horizon browser check at 137 km/h with Auto-Ride: the road and scenery remained present through the horizon fog without a visible pool edge; production build and whitespace checks passed.
- [x] Performance hotfix: disabled renderer shadows, removed 35 roadside point lights and traffic-car dynamic lights, batched asphalt/rails/shoulders/lane paint into five instanced draws, and only refresh recycled prop matrices when needed. Speedometer and engine audio now update from refs in the animation loop without React state renders.
- [x] Graphics presets now cap render scale (Low 0.6–0.85, Medium 1.0–1.2, High 1.0–1.5), tune stars/rain/fog, simplify wet asphalt and headlight lighting on Low, and cap traffic count by quality. Medium is the fresh-install default.
- [x] Browser frame probe measured 60 FPS at Medium and High with Medium traffic (178 draw calls in the High preset). Open the optional diagnostic using `http://localhost:5173/?debug=fps`; no browser console errors were observed.
- [x] Visual overhaul: the bike now uses beveled extruded fairings/tank, lathed tires and rims, merged spoke/tread geometry, a tubular frame/forks/exhaust, carbon texture, clearcoat paint, an articulated rider, and a live cockpit dash. Traffic bodies and cabins are sculpted profiles with suspension motion; jersey barriers, reflective markers, directional gantries, lamp pools, and a roadside night stop enrich the highway. Quality-aware bloom/vignette, smoothed fog, speed FOV/lean, and edge wind streaks preserve the existing ride, garage, and recycling systems.
- [x] Vehicle graphics upgrade: Three.js `GLTFLoader` loads an attributed Suzuki SV650 motorcycle model plus sports car, SUV, and pickup traffic models; loaded paint responds to garage color, wheels rotate with speed, and procedural vehicles remain available offline. Three.js `RoomEnvironment`/PMREM supplies reflections; wet asphalt uses generated normal/roughness maps and clearcoat; ACES tone mapping and the existing bloom pipeline finish the image.

### External model credits

- Motorcycle, Suzuki SV650 by Paul Spooner via [Poly Pizza](https://poly.pizza/m/1yfyze7uGxS), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Sports Car, SUV, and Pickup Truck by Quaternius via Poly Pizza, licensed [CC0](https://creativecommons.org/publicdomain/zero/1.0/): [Sports Car](https://poly.pizza/m/1mkmFkAz5v), [SUV](https://poly.pizza/m/xsMtZhBkxL), [Pickup Truck](https://poly.pizza/m/qn4grQgHm8).

## Current limitations

This is an early prototype. The external vehicle models are low-poly assets rather than scanned/high-poly models; the motorcycle falls back to original procedural geometry offline, and the 12 garage entries share the same loaded bike model with individual handling/color settings. Wet-road sheen uses environment reflections and generated PBR normal/roughness maps, not planar reflections or a custom ripple shader. Bloom and vignette are screen-space post-processing effects; volumetric shafts, depth of field, and screen-space wheel splashes are not implemented. Tunnel sections and a lightweight Web Audio echo are enabled; the road remains straight, with smooth lateral arcade handling. Traffic lighting is emissive-only for performance, and Doppler audio is synthetic rather than recorded. Gamepad support and a rotating garage preview remain. The local playlist supports import, seek, previous/next, and removal; shuffle/repeat are not implemented. Generated genre loops are lightweight Web Audio synthesis, not recorded commercial or licensed tracks. Imported audio stays in page memory and is not uploaded or saved across reloads. Target-laptop performance and local-file playback still need dedicated verification. Vite reports a production bundle chunk-size warning.

