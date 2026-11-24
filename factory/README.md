# IRONVALE — Planetary Factory

A Satisfactory-inspired first-person factory-building game that runs in the browser (Three.js, no build step).

## Run
Serve the **repository root** (the game imports Three.js from `../lib`) and open `/factory/`:

```bash
cd /path/to/Nocturne
python3 -m http.server 8123
# open http://localhost:8123/factory/
```

## What's in it
- **Procedural 1.5 km world** – domain-warped fBm continents, ridged mountains, winding rivers, lakes, desert mesas; 7 biomes
  (beach, grassland, forest, swamp, desert, highlands, snowfields) in a muted natural palette, with trees, fallen logs, stumps, ferns, mushrooms, cattails, lily pads, pebbles, rock spires, ice formations and grass.
- **Landmarks** – a crashed drop pod at the landing site, standing-stone circles, desert rock arches, overgrown forest ruins and abandoned survey towers.
- **150 resource nodes in 12 types** – iron, copper, limestone, coal, caterium, sulfur, quartz, bauxite, uranium, plus tin, titanium and ruby – each Impure / Normal / Pure,
  often found in clusters, matched to biomes (uranium and quartz high in the snow, sulfur in the desert, bauxite in swamps …).
  Press **V** to scan and reveal them on the compass, minimap and map.
- **Wildlife** – deer, rabbits, snow hares, mountain goats, camels, lizards, frogs (prey that flee); boars and bears (fight back);
  wolf packs and sand scorpions (hunters, bolder at night); flocks of birds and vultures, fish schools that leap, fireflies at night.
- **Factory sim** – grid-based buildings that flatten the terrain, conveyor belts (drag to paint), splitters, miners, smelters,
  constructors, assemblers, foundries, storage, delivery depot, and a power grid (solar, coal, nuclear; solar dies at night).
  31 recipes from ore to computers, power cores, titanium frames and uranium fuel rods (tin + copper → bronze in the Foundry).
- **Upgrades (U)** – 10 upgrade lines (running boots, jump springs, vitality, pickaxe, scanner, belt Mk2/Mk3, miner/machine overclock, efficiency core, solar efficiency), paid in items and gated by milestones.
- **Chromebook-friendly** – Graphics Auto/Low/Medium/High (Auto picks Low on ChromeOS or ≤4 cores). Low: no shadows/AA, reduced grass, trees and view distance, fewer animals simulated; resolution scales dynamically to hold ~40+ fps. Change it on the title or pause screen (reloads).
- **Progression** – deliver items to a Delivery Depot to finish 6 milestones that unlock machines, boots and the final Beacon.
- Day/night cycle, weather-less sky with clouds and stars, auto-save (localStorage).

## Mining
Hold LMB (⛏ on touch) on a resource node for its ore, or on any loose rock, boulder, rock spire or ice formation. Rocks crack and shrink with each strike, then break with a bonus drop. What they drop depends on the biome (e.g. sulfur and ruby in the desert, quartz, titanium and uranium in the snow). The Prospector Pickaxe upgrade mines faster and yields more.

## Phone and tablet
The title screen asks whether you're on a computer or a phone/tablet. Touch mode gives a move stick (left), drag-to-look, action buttons (swing/place, E, jump, run, rotate, cancel, deconstruct, eat) and a menu row (build, bag, upgrades, goals, map, scan, pause). It uses Low graphics and asks for fullscreen landscape.

## Controls
WASD move · Shift sprint · Space jump · Mouse look · **LMB** swing / place · **RMB / Esc** cancel · **E** hold to hand-mine a node / use machines ·
**Q** build menu · **R / wheel** rotate · **X** deconstruct · **G** copy building · **Tab** inventory + hand crafting · **V** scan · **M** map ·
**J** milestones · **U** upgrades · **F** eat meat · **O** toggle shadows · **H** help.
