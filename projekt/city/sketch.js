let camPos;
let camAngle;

let speed = 4;

let lamps = [];

let people = [];
let streets = []; // Liste von Straßen-Segmenten
let roadNodes = [];
let roads = [];
let buildings = [];
let flyingCars = [];
let skyRoads = [];
let parks = [];
let trees = [];

let camPitch = 0; // Vertikaler Blickwinkel
let streetGrid = [];

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noCursor();

  camPos = createVector(0, 200, 600);
  camAngle = 0;
  camPitchLimit = HALF_PI;

  generateRoadNetwork();
  initCity();

  initParks();
  removeBuildingsInParks();

  initTrees(); // 🌳 NACH Gebäuden!

  initSkyRoads();
  initSkyCars();

  initLamps();
  initPeople();
}

function draw() {
  background(10);

  // Blickrichtung aus Yaw (camAngle) und Pitch (camPitch)
  let lookX = cos(camPitch) * cos(camAngle);
  let lookY = sin(camPitch);
  let lookZ = cos(camPitch) * sin(camAngle);

  let camTarget = createVector(camPos.x + lookX * 100, camPos.y + lookY * 100, camPos.z + lookZ * 100);

  camera(camPos.x, camPos.y, camPos.z, camTarget.x, camTarget.y, camTarget.z, 0, -1, 0);

  ambientLight(100);
  directionalLight(255, 200, 255, 0, -1, -1);

  drawGround();
  drawParks();
  drawTrees();

  drawStreets();
  drawLamps();
  drawBuildings();
  drawSkyRoads(); // nach drawStreets()

  for (let p of people) {
    p.update();
    p.show();
  }

  for (let car of flyingCars) {
    car.update();
    car.show();
  }

  handleControls();
}

function drawGround() {
  push();
  rotateX(HALF_PI);
  translate(0, 0, -2); // Boden leicht absenken
  fill(10);
  plane(2000, 2000);
  pop();
}

function initCity() {
  buildings = [];

  let attempts = 0;
  let maxBuildings = 520;

  while (buildings.length < maxBuildings && attempts < 9000) {
    attempts++;

    let x = random(-1800, 1800);
    let z = random(-1800, 1800);

    let zone = cityZone(x, z);
    let density = cityDensity(x, z);

    let nearest = nearestRoad(x, z);
    if (!nearest) continue;

    // ----------------------------
    // Zonen → Straßentyp-Zuordnung
    // ----------------------------
    if (zone === "CBD" && nearest.type === "LOCAL") continue;
    if (zone === "BUSINESS" && nearest.type === "LOCAL") continue;
    if (zone === "RESIDENTIAL" && nearest.type === "MAIN") continue;

    // ----------------------------
    // Abstand zur Straße
    // ----------------------------
    let dRoad = distanceToRoad(x, z);

    let minDist = {
      MAIN: 35,
      SECONDARY: 45,
      LOCAL: 60,
    }[nearest.type];

    let maxDist = {
      MAIN: 180,
      SECONDARY: 260,
      LOCAL: 420,
    }[nearest.type];

    if (dRoad < minDist || dRoad > maxDist) continue;

    // ----------------------------
    // Gebäudeparameter
    // ----------------------------
    let w, h;

    if (zone === "CBD") {
      w = random(60, 90);
      h = random(380, 650);
    } else if (zone === "BUSINESS") {
      w = random(50, 80);
      h = random(200, 420);
    } else {
      w = random(40, 70);
      h = random(60, 160);
    }

    buildings.push({
      x,
      z,
      w,
      h,
      zone,
    });
  }
}

function drawLamps() {
  for (let l of lamps) {
    push();
    translate(l.x, -l.h / 2, l.z);
    fill(80);
    box(5, l.h, 5);

    // Lampenkopf
    translate(0, -l.h / 2, 0);
    fill(200, 255, 255);
    emissiveMaterial(200, 255, 255); // Leuchten
    sphere(6);
    pop();
  }
}

function nearestRoad(x, z) {
  let best = null;
  let bestDist = Infinity;

  for (let road of roads) {
    for (let p of road.points) {
      let d = dist(x, z, p.x, p.z);
      if (d < bestDist) {
        bestDist = d;
        best = road;
      }
    }
  }

  return best;
}

function drawStreets() {
  push();
  noStroke();

  for (let road of roads) {
    let col = {
      MAIN: color(120),
      SECONDARY: color(95),
      LOCAL: color(70),
    }[road.type];

    fill(col);

    for (let i = 1; i < road.points.length; i++) {
      let a = road.points[i - 1];
      let b = road.points[i];

      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let len = sqrt(dx * dx + dz * dz);
      let angle = atan2(dz, dx);

      push();
      translate((a.x + b.x) / 2, 2, (a.z + b.z) / 2);
      rotateY(-angle);
      box(len, 4, road.width);
      pop();
    }
  }

  pop();
}

function initLamps() {
  lamps = [];

  for (let tile of streetGrid) {
    if (tile.isStreet && abs(tile.x % 200) === 0 && abs(tile.z % 200) === 0) {
      lamps.push({ x: tile.x + 40, z: tile.z + 40, h: 100 });
    }
  }
}

function drawBuildings() {
  for (let b of buildings) {
    let c;

    if (b.zone === "CBD") {
      c = color(140, 255, 255); // hell, dominant
    } else if (b.zone === "BUSINESS") {
      c = color(100, 220, 240);
    } else {
      c = color(80, 180, 200); // ruhiger
    }

    fill(c);

    push();
    translate(b.x, b.h / 2, b.z);
    box(b.w, b.h, b.w);
    pop();
  }
}

function generateStreets() {
  streets = [];

  let center = createVector(0, 0);
  let mainRoadCount = 4;
  let sideRoadCount = 60;

  // ----------------------------
  // 1. HAUPTSTRASSEN
  // ----------------------------
  for (let i = 0; i < mainRoadCount; i++) {
    let angle = i * (TWO_PI / mainRoadCount) + random(-0.2, 0.2);
    let length = random(1200, 1600);

    streets.push(
      createStreet(
        center.x,
        center.y,
        angle,
        length,
        12, // geringe Kurven
        40 // breite Straße
      )
    );
  }

  // ----------------------------
  // 2. NEBENSTRASSEN
  // ----------------------------
  for (let i = 0; i < sideRoadCount; i++) {
    let base = random(streets);
    let start = random(base.points);

    let angle = base.angle + random(-HALF_PI / 1.5, HALF_PI / 1.5);
    let length = random(200, 500);

    let road = createStreet(
      start.x,
      start.z,
      angle,
      length,
      40, // stärkere Kurven
      26
    );

    // Abstand prüfen
    if (!intersectsExisting(road, 50)) {
      streets.push(road);
    }
  }
}

function generateStreetGrid(gridSize = 11, blockSize = 100, streetWidth = 60) {
  streetGrid = [];

  let offset = (-(gridSize - 1) / 2) * blockSize;

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      let worldX = offset + x * blockSize;
      let worldZ = offset + z * blockSize;

      let isStreet = x % 2 === 0 || z % 2 === 0;

      streetGrid.push({
        x: worldX,
        z: worldZ,
        isStreet,
        streetWidth,
      });
    }
  }
}

function intersectsExisting(road, minDist) {
  for (let r of streets) {
    for (let p of r.points) {
      for (let q of road.points) {
        if (dist(p.x, p.z, q.x, q.z) < minDist) {
          return true;
        }
      }
    }
  }
  return false;
}

function createStreet(x, z, angle, length, curveStrength, width) {
  let points = [];
  let steps = length / 20;

  let cx = x;
  let cz = z;
  let a = angle;

  for (let i = 0; i < steps; i++) {
    points.push({ x: cx, z: cz });

    a += random(-curveStrength, curveStrength) * 0.001;
    cx += cos(a) * 20;
    cz += sin(a) * 20;

    if (abs(cx) > 1200 || abs(cz) > 1200) break;
  }

  return {
    points,
    angle,
    width,
  };
}

function initTrees() {
  trees = [];

  for (let park of parks) {
    let targetCount = floor(map(park.r, 120, 260, 14, 42));
    let attempts = 0;

    while (trees.length < targetCount && attempts < 4000) {
      attempts++;

      // Zufälliger Punkt IM Park
      let angle = random(TWO_PI);
      let radius = random(park.r * 0.2, park.r * 0.95);

      let x = park.x + cos(angle) * radius;
      let z = park.z + sin(angle) * radius;

      // ----------------------------
      // 1. Sicher im Park?
      // ----------------------------
      if (dist(x, z, park.x, park.z) > park.r) continue;

      // ----------------------------
      // 2. Abstand zu Straßen
      // ----------------------------
      if (distanceToRoad(x, z) < 55) continue;

      // ----------------------------
      // 3. Abstand zu Gebäuden
      // ----------------------------
      let nearBuilding = false;
      for (let b of buildings) {
        if (dist(x, z, b.x, b.z) < b.w / 2 + 35) {
          nearBuilding = true;
          break;
        }
      }
      if (nearBuilding) continue;

      // ----------------------------
      // 4. Abstand zu anderen Bäumen
      // ----------------------------
      let tooClose = false;
      for (let t of trees) {
        if (dist(x, z, t.x, t.z) < 24) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // ----------------------------
      // Baum akzeptieren
      // ----------------------------
      trees.push({
        x,
        z,
        trunkH: random(18, 34),
        crownR: random(12, 22),
      });
    }
  }
}

function drawTrees() {
  for (let t of trees) {
    // Stamm
    push();
    translate(t.x, t.trunkH / 2, t.z);
    fill(90, 60, 30);
    box(4, t.trunkH, 4);
    pop();

    // Krone
    push();
    translate(t.x, t.trunkH + t.crownR * 0.6, t.z);
    fill(40, random(120, 160), 60);
    sphere(t.crownR, 8, 6);
    pop();
  }
}

function generateRoadNetwork() {
  roads = [];
  roadNodes = [];

  let cityRadius = 1800;
  let spacing = 300;
  let gridExtent = 900;

  // ----------------------------
  // 1. URBANES RASTER (CBD + BUSINESS)
  // ----------------------------
  for (let x = -gridExtent; x <= gridExtent; x += spacing) {
    for (let z = -gridExtent; z <= gridExtent; z += spacing) {
      let a = { x, z };
      let b1 = { x: x + spacing, z };
      let b2 = { x, z: z + spacing };

      if (x + spacing <= gridExtent) {
        let r = createRoad(a, b1, "MAIN", false);
        if (r) roads.push(r);
      }

      if (z + spacing <= gridExtent) {
        let r = createRoad(a, b2, "MAIN", false);
        if (r) roads.push(r);
      }
    }
  }

  // ----------------------------
  // 1b. Wohnstraßen an Außenknoten
  // ----------------------------
  for (let x = -gridExtent; x <= gridExtent; x += spacing) {
    for (let z = -gridExtent; z <= gridExtent; z += spacing) {
      let isEdge = abs(x) === gridExtent || abs(z) === gridExtent;
      if (!isEdge) continue;

      let a = { x, z };
      let angle = random(TWO_PI);
      let length = random(280, 440);

      let b = {
        x: a.x + cos(angle) * length,
        z: a.z + sin(angle) * length,
      };

      if (cityZone(b.x, b.z) === "RESIDENTIAL" && !intersectsPark(b, 100)) {
        let r = createRoad(a, b, "LOCAL", true);
        if (r) roads.push(r);
      }
    }
  }

  // ----------------------------
  // 2. WOHNGEBIET-KNOTEN (NUR RESIDENTIAL)
  // ----------------------------
  let nodeCount = 90;

  for (let i = 0; i < nodeCount; i++) {
    let x = random(-cityRadius, cityRadius);
    let z = random(-cityRadius, cityRadius);

    if (cityZone(x, z) === "RESIDENTIAL") {
      if (!intersectsPark({ x, z }, 120)) {
        roadNodes.push({ x, z });
      }
    }
  }

  // ----------------------------
  // 3. WOHNSTRASSEN-NETZ
  // ----------------------------
  for (let a of roadNodes) {
    let neighbors = roadNodes
      .filter((b) => b !== a)
      .sort((p, q) => dist(a.x, a.z, p.x, p.z) - dist(a.x, a.z, q.x, q.z))
      .slice(0, 3);

    for (let b of neighbors) {
      let r = createRoad(a, b, "LOCAL", true);
      if (r) roads.push(r);
    }
  }

  // ----------------------------
  // 4. ÜBERGANG: WOHNEN → STADT
  // ----------------------------
  for (let node of roadNodes) {
    let d = dist(0, 0, node.x, node.z);

    if (d > gridExtent && d < gridExtent + 500) {
      let nearest = null;
      let nearestDist = Infinity;

      for (let x = -gridExtent; x <= gridExtent; x += spacing) {
        for (let z = -gridExtent; z <= gridExtent; z += spacing) {
          if (abs(x) === gridExtent || abs(z) === gridExtent) {
            let d2 = dist(node.x, node.z, x, z);
            if (d2 < nearestDist) {
              nearestDist = d2;
              nearest = { x, z };
            }
          }
        }
      }

      if (nearest) {
        let r = createRoad(node, nearest, "SECONDARY", false);
        if (r) roads.push(r);
      }
    }
  }
}

function initParks() {
  parks = [];

  let attempts = 0;
  let maxParks = 18;

  while (parks.length < maxParks && attempts < 3000) {
    attempts++;

    let x = random(-1600, 1600);
    let z = random(-1600, 1600);

    let zone = cityZone(x, z);
    if (zone === "CBD") continue;

    let density = cityDensity(x, z);
    if (density > 0.65) continue; // nicht zu zentral

    let nearest = nearestRoad(x, z);
    if (!nearest) continue;

    // Parks nicht an Hauptstraßen
    if (nearest.type === "MAIN") continue;

    // Parkgröße
    let r = random(120, 260);

    // Überlappung vermeiden
    let overlaps = false;
    for (let p of parks) {
      if (dist(x, z, p.x, p.z) < p.r + r + 60) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    parks.push({ x, z, r });
  }
}

function removeBuildingsInParks() {
  buildings = buildings.filter((b) => {
    for (let p of parks) {
      if (dist(b.x, b.z, p.x, p.z) < p.r) {
        return false;
      }
    }
    return true;
  });
}

function drawParks() {
  push();
  noStroke();
  fill(40, 120, 70);

  for (let p of parks) {
    push();
    translate(p.x, 1, p.z);
    rotateX(HALF_PI);
    ellipse(0, 0, p.r * 2, p.r * 2);
    pop();
  }

  pop();
}

function snapToExistingRoad(p, radius = 30) {
  for (let road of roads) {
    for (let rp of road.points) {
      if (dist(p.x, p.z, rp.x, rp.z) < radius) {
        // ❌ Kein Snap in Parks!
        if (!intersectsPark(rp, 40)) {
          return { x: rp.x, z: rp.z };
        }
      }
    }
  }
  return p;
}

function smoothPoints(points, factor = 0.4) {
  let newPoints = [];

  for (let i = 1; i < points.length - 1; i++) {
    let prev = points[i - 1];
    let next = points[i + 1];

    let midX = (prev.x + next.x) / 2;
    let midZ = (prev.z + next.z) / 2;

    newPoints.push({
      x: lerp(points[i].x, midX, factor),
      z: lerp(points[i].z, midZ, factor),
    });
  }

  // Behalte Anfang und Ende bei
  return [points[0], ...newPoints, points[points.length - 1]];
}

function distanceToRoad(x, z) {
  let minD = Infinity;

  for (let road of roads) {
    for (let p of road.points) {
      let d = dist(x, z, p.x, p.z) - road.width / 2;
      if (d < minD) minD = d;
    }
  }
  return minD;
}

function createRoad(a, b, type = "MAIN", curved = false) {
  // Punkte ggf. an bestehende Straßen andocken
  a = snapToExistingRoad(a, 30);
  b = snapToExistingRoad(b, 30);

  let points = [];
  let distAB = dist(a.x, a.z, b.x, b.z);
  let steps = floor(distAB / 25);

  let pos = createVector(a.x, 0, a.z);
  let baseAngle = atan2(b.z - a.z, b.x - a.x);
  let angle = baseAngle;
  let noiseT = random(1000);

  let width = {
    MAIN: random(36, 44),
    SECONDARY: random(28, 34),
    LOCAL: random(20, 26),
  }[type];

  for (let i = 0; i < steps; i++) {
    // ❌ Park schneiden → abbrechen
    if (intersectsPark(pos, width)) break;

    // ❌ Wohnstraßen dürfen keine anderen Straßen schneiden
    if (type === "LOCAL" && intersectsRoad(pos, 20)) break;

    points.push({ x: pos.x, z: pos.z });

    // 🌿 Organische Wohnstraße
    if (curved && type === "LOCAL") {
      let toTarget = atan2(b.z - pos.z, b.x - pos.x);
      let curve = map(noise(noiseT), 0, 1, -0.08, 0.08);
      angle += curve;
      angle = lerp(angle, toTarget, 0.15); // stärkere Ausrichtung aufs Ziel
      noiseT += 0.02;
    }
    // 🟦 Urbane Straßen → gerade
    else {
      angle = baseAngle;
    }

    pos.x += cos(angle) * 25;
    pos.z += sin(angle) * 25;
  }

  // zu kurz? Verwerfen
  if (points.length < 4) return null;

  // ✨ Sanfte Glättung
  points = smoothPoints(points, 0.4);

  return {
    points,
    width,
    type,
  };
}

function initFlyingCars() {
  flyingCars = [];

  for (let road of roads) {
    for (let i = 0; i < road.points.length - 1; i += 8) {
      let p1 = road.points[i];
      let p2 = road.points[i + 1];

      if (random() < 0.5) {
        flyingCars.push(new FlyingCar(p1, p2));
      }
    }
  }
}

function roadExists(a, b) {
  for (let r of roads) {
    let p0 = r.points[0];
    let p1 = r.points[r.points.length - 1];

    if ((p0 === a && p1 === b) || (p0 === b && p1 === a)) {
      return true;
    }
  }
  return false;
}

function initSkyRoads() {
  skyRoads = [];
  noiseSeed(floor(random(10000)));

  let highwayCount = 6;
  let cityRadius = 1600;

  // Zentraler Korridor
  skyRoads.push(
    createSkyHighway(
      createVector(-cityRadius, random(260, 320), random(-400, 400)),
      createVector(1, 0, 0), // Richtung: Osten
      48
    )
  );

  // Weitere Highways
  for (let i = 0; i < highwayCount; i++) {
    let start = createVector(random(-cityRadius, cityRadius), random(260, 380), random(-cityRadius, cityRadius));

    let angle = random(TWO_PI);
    let dir = createVector(cos(angle), 0, sin(angle));

    skyRoads.push(createSkyHighway(start, dir, random(34, 44)));
  }
}

function intersectsPark(pos, margin = 40) {
  for (let p of parks) {
    let d = dist(pos.x, pos.z, p.x, p.z);
    if (d < p.r + margin) {
      return true;
    }
  }
  return false;
}

function intersectsBuildings(point, threshold = 40) {
  for (let b of buildings) {
    let d = dist(point.x, point.z, b.x, b.z);
    if (d < b.w / 2 + threshold) return true;
  }
  return false;
}

function drawSkyPillars() {
  fill(60);

  for (let road of skyRoads) {
    for (let i = 0; i < road.points.length; i += 12) {
      let p = road.points[i];

      // keine Pfeiler mitten in Gebäuden
      if (intersectsBuildings(p, 30)) continue;

      push();
      translate(p.x, p.y / 2, p.z);
      box(12, p.y, 12);
      pop();
    }
  }
}

function intersectsRoad(pos, threshold = 20) {
  for (let road of roads) {
    for (let i = 1; i < road.points.length; i++) {
      let a = road.points[i - 1];
      let b = road.points[i];

      // Abstand von Punkt zur Linie berechnen
      let closest = closestPointOnLineSegment(a, b, pos);
      let d = dist(pos.x, pos.z, closest.x, closest.z);

      if (d < threshold) {
        return true;
      }
    }
  }
  return false;
}

function closestPointOnLineSegment(a, b, p) {
  let ax = a.x,
    az = a.z;
  let bx = b.x,
    bz = b.z;
  let px = p.x,
    pz = p.z;

  let abx = bx - ax;
  let abz = bz - az;
  let apx = px - ax;
  let apz = pz - az;

  let abLenSq = abx * abx + abz * abz;
  let dot = apx * abx + apz * abz;
  let t = constrain(dot / abLenSq, 0, 1);

  return {
    x: ax + abx * t,
    z: az + abz * t,
  };
}

function drawSkyRoads() {
  push();
  noStroke();
  fill(30, 30, 80);

  for (let road of skyRoads) {
    for (let i = 1; i < road.points.length; i++) {
      let a = road.points[i - 1];
      let b = road.points[i];

      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let len = sqrt(dx * dx + dz * dz);
      let angle = atan2(dz, dx);

      push();
      translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      rotateY(-angle);
      box(len, road.thickness, road.width);
      pop();
    }
  }

  pop();
}

function initSkyCars() {
  flyingCars = [];

  for (let road of skyRoads) {
    for (let i = 0; i < road.points.length - 1; i += 10) {
      let a = road.points[i];
      let b = road.points[i + 1];

      flyingCars.push(new FlyingCar(a, b));
    }
  }
}

function createSkyHighway(start, direction, width) {
  let points = [];
  let pos = start.copy();
  let angle = atan2(direction.z, direction.x);
  let noiseT = random(1000);
  let cityRadius = 1900;

  for (let i = 0; i < 9999; i++) {
    if (dist(pos.x, pos.z, 0, 0) > cityRadius) break;

    points.push({ x: pos.x, y: pos.y, z: pos.z });

    let n = noise(noiseT);
    let curve = map(n, 0, 1, -0.12, 0.12);
    angle += curve;

    let drift = map(noise(noiseT + 50), 0, 1, -1.5, 1.5);
    pos.y += drift;

    pos.x += cos(angle) * 30;
    pos.z += sin(angle) * 30;

    noiseT += 0.015;

    // Leichte Korrektur zurück zur Zielrichtung
    let toCenter = createVector(0, 0, 0).sub(pos);
    let targetAngle = atan2(toCenter.z, toCenter.x);
    angle = lerp(angle, targetAngle, 0.02);
  }

  return {
    points,
    width,
    thickness: 8,
  };
}

function avoidBuildings(pos) {
  let force = 0;

  for (let b of buildings) {
    let d = dist(pos.x, pos.z, b.x, b.z);
    if (d < b.w + 60) {
      let angleToBuilding = atan2(b.z - pos.z, b.x - pos.x);
      force -= sin(angleToBuilding) * (1 / max(d, 1));
    }
  }

  return force;
}

function cityDensity(x, z) {
  let centerDist = dist(x, z, 0, 0);
  let maxDist = 1800;

  // 1 = Zentrum, 0 = Stadtrand
  let d = constrain(1 - centerDist / maxDist, 0, 1);

  // nicht linear → echtes Stadtprofil
  return pow(d, 1.8);
}

function cityZone(x, z) {
  let d = dist(x, z, 0, 0);

  if (d < 400) return "CBD"; // City Core
  if (d < 900) return "BUSINESS"; // Büro / Mixed
  return "RESIDENTIAL"; // Wohnen
}

// 1. Person-Klasse
class Person {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.dir = p5.Vector.random3D().mult(0.4);
  }

  update() {
    this.pos.add(this.dir);
    if (random() < 0.01) {
      this.dir = p5.Vector.random3D().mult(0.4);
    }
  }

  show() {
    push();
    translate(this.pos.x, 10, this.pos.z);
    fill(255, 100, 100);
    box(10, 20, 10);
    pop();
  }
}
class FlyingCar {
  constructor(start, end) {
    this.start = createVector(start.x, 0, start.z);
    this.end = createVector(end.x, 0, end.z);
    this.pos = this.start.copy();

    this.dir = p5.Vector.sub(this.end, this.start).normalize();
    this.speed = random(1, 2.5);
    this.t = 0;

    this.yOffset = random(40, 120); // Höhe über der Straße
    this.color = color(random(150, 255), random(100, 200), random(255), 220);
  }

  update() {
    this.t += this.speed * 0.005;

    if (this.t >= 1) {
      // Respawn
      this.t = 0;
      let temp = this.start;
      this.start = this.end;
      this.end = temp;

      this.dir = p5.Vector.sub(this.end, this.start).normalize();
    }

    this.pos = p5.Vector.lerp(this.start, this.end, this.t);
  }

  show() {
    push();
    translate(this.pos.x, this.yOffset, this.pos.z);
    fill(this.color);
    emissiveMaterial(this.color);
    box(20, 10, 10);
    pop();
  }
}

// 2. Dann kommt initPeople()
function initPeople() {
  for (let i = 0; i < 20; i++) {
    people.push(new Person(random(-500, 500), 0, random(-500, 500)));
  }
}

function handleControls() {
  let move = createVector(0, 0, 0);

  // Vor / Zurück (W / S) — FIXED
  if (keyIsDown(87)) {
    // W = vorwärts
    move.x -= cos(camAngle) * speed;
    move.z -= sin(camAngle) * speed;
  }
  if (keyIsDown(83)) {
    // S = rückwärts
    move.x += cos(camAngle) * speed;
    move.z += sin(camAngle) * speed;
  }

  // Seitwärts (A / D)
  if (keyIsDown(65)) {
    // A
    move.x -= cos(camAngle + HALF_PI) * speed;
    move.z -= sin(camAngle + HALF_PI) * speed;
  }
  if (keyIsDown(68)) {
    // D
    move.x -= cos(camAngle - HALF_PI) * speed;
    move.z -= sin(camAngle - HALF_PI) * speed;
  }

  // Hoch / Runter
  if (keyIsDown(32)) {
    // SPACE
    move.y -= speed;
  }
  if (keyIsDown(SHIFT)) {
    move.y += speed;
  }

  camPos.add(move);
}

// Drehe Blick mit Maus horizontal (X-Achse)
function mouseDragged() {
  // Horizontal: Maus nach rechts = Blick nach rechts
  camAngle -= movedX * 0.003;

  // Vertikal: Maus hoch = Blick hoch
  camPitch -= movedY * 0.003;

  // Begrenzen, damit kein Überschlag passiert
  camPitch = constrain(camPitch, -camPitchLimit, camPitchLimit);
}
