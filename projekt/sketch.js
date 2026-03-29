// ============================================
// Die Zukunft, die nie war
// Neon-Stadt mit Regen
// ============================================

let buildings = [];
let rainDrops = [];
let numBuildings = 160;
let numRain = 500;

// Boden-Menschen + Laser
let humans = [];
let numHumans = 28;
const HUMAN_SPEED_MIN = 1.0;
const HUMAN_SPEED_MAX = 2.1;
const HUMAN_AVOID_RADIUS = 95;
const HUMAN_SHOOT_RANGE = 980;
const HUMAN_SHOOT_COOLDOWN_MIN = 10;
const HUMAN_SHOOT_COOLDOWN_MAX = 26;
const LASER_LIFE = 3;
const LASER_DAMAGE = 8;
const LASER_COLOR = [255, 60, 220];
let lasers = [];

// Explosion/Feuer
let fireParticles = [];
const GRAVITY = 1.25;
const FIRE_SPAWN_PER_FRAME = 2;
const FIRE_PARTICLE_LIFE = 55;

// Stadtgröße
const CITY_BOUND = 1800;
const GROUND_SIZE = 6000;

// Kamera: Maus drehen/zoomen/pannen via orbitControl()

// Fliegende Neon-Autos
let cars = [];
let numCars = 40;
const WORLD_BOUND = CITY_BOUND;
const CAR_MIN_ALT = 80;  // Abstand zum Boden
const CAR_MAX_ALT = 260; // maximale Flughöhe
const CAR_SEPARATION_RADIUS = 85;
const CAR_MAX_HP = 100;
const CAR_FLEE_RANGE = 520;
const CAR_FLEE_FORCE = 2.25;


function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  angleMode(DEGREES);

  // Gebäude generieren
  for (let i = 0; i < numBuildings; i++) {
    let b = {
      x: random(-CITY_BOUND, CITY_BOUND),
      z: random(-CITY_BOUND, CITY_BOUND),
      w: random(30, 80),
      d: random(30, 80),
      h: random(100, 400),
      neonColor: color(random(50, 255), random(50, 255), 255)
    };
    buildings.push(b);
  }

  // Mehr fliegende Autos initialisieren
  cars = [];
  for (let i = 0; i < numCars; i++) {
    let start = randomFreePositionXZ();
    cars.push({
      x: start.x,
      z: start.z,
      vx: random(-2, 2),
      vz: random(-2, 2),
      heading: random(360),
      baseAlt: random(CAR_MIN_ALT + 30, CAR_MAX_ALT - 30),
      ampAlt: random(10, 35),
      phaseAlt: random(360),
      maxSpeed: random(4.2, 6.2),
      maxSteer: 0.16,
      bodyNeon: color(random(120, 255), 0, 255),
      wheelNeon: color(0, random(150, 255), 255),
      hitTimer: 0,
      hp: CAR_MAX_HP,
      state: 'alive',
      fallV: 0,
      crashX: 0,
      crashZ: 0,
      burning: false
    });
  }

  // Menschen am Boden initialisieren
  humans = [];
  for (let i = 0; i < numHumans; i++) {
    let pos = randomFreeGroundPositionXZ();
    humans.push({
      x: pos.x,
      z: pos.z,
      heading: random(360),
      speed: random(HUMAN_SPEED_MIN, HUMAN_SPEED_MAX),
      stepPhase: random(360),
      shootCooldown: floor(random(HUMAN_SHOOT_COOLDOWN_MIN, HUMAN_SHOOT_COOLDOWN_MAX)),
      targetIndex: -1
    });
  }

  // Regen generieren
  for (let i = 0; i < numRain; i++) {
    rainDrops.push({
      x: random(-CITY_BOUND * 1.2, CITY_BOUND * 1.2),
      y: random(-500, 500),
      z: random(-CITY_BOUND * 1.2, CITY_BOUND * 1.2),
      len: random(10, 20),
      speed: random(4, 10)
    });
  }
}

function draw() {
  background(10);

  // Licht
  ambientLight(100); // heller für Grautöne
  pointLight(255, 255, 255, 0, -200, 300);

  // Maus-Steuerung: links drehen, rechts pannen, scroll zoomen
  orbitControl();

  // Boden
  push();
  rotateX(90);
  fill(50); // Grau
  plane(GROUND_SIZE, GROUND_SIZE);
  pop();

  // Gebäude zeichnen (grau + Neon)
  for (let b of buildings) {
    push();
    translate(b.x, -b.h / 2, b.z);
    ambientMaterial(80); // Graues Material, reagiert auf Licht
    box(b.w, b.h, b.d);

    // Neonstreifen vorne
    push();
    translate(0, -b.h / 4, b.d / 2 + 1);
    emissiveMaterial(b.neonColor); // leuchtender Neonstreifen
    box(b.w * 0.2, b.h * 0.5, 2);
    pop();
    pop();
  }

  // Fliegende Neon-Autos bewegen und zeichnen
  for (let i = 0; i < cars.length; i++) {
    updateFlyerCar(cars[i], cars, i);
    drawFlyerCar(cars[i]);
  }

  // Menschen bewegen/zeichnen + Laser schießen
  for (let h of humans) {
    updateHuman(h);
    drawHuman(h);
    tryShootAtCars(h);
  }

  // Laser zeichnen
  updateAndDrawLasers();

  // Feuer/Explosionen
  updateAndDrawFire();

  // Regen zeichnen
  stroke(100, 150, 255);
  strokeWeight(2);
  for (let r of rainDrops) {
    line(r.x, r.y, r.z, r.x, r.y + r.len, r.z);
    r.y += r.speed;
    if (r.y > 500) r.y = -500; // Reset nach unten
  }

  // HUD: HP Prozent über Autos (2D Overlay)
  drawCarHUD();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function randomFreePositionXZ() {
  // Sucht eine Startposition, die nicht im Fußabdruck eines Hauses liegt
  for (let tries = 0; tries < 200; tries++) {
    let x = random(-WORLD_BOUND * 0.85, WORLD_BOUND * 0.85);
    let z = random(-WORLD_BOUND * 0.85, WORLD_BOUND * 0.85);
    if (!isInsideAnyBuildingFootprint(x, z, 90) && !isTooCloseToAnyCar(x, z, 120)) return { x, z };
  }
  return { x: 0, z: 0 };
}

function randomFreeGroundPositionXZ() {
  for (let tries = 0; tries < 300; tries++) {
    let x = random(-WORLD_BOUND * 0.9, WORLD_BOUND * 0.9);
    let z = random(-WORLD_BOUND * 0.9, WORLD_BOUND * 0.9);
    // Menschen dürfen näher ran als Autos, aber nicht in Häuser rein
    if (!isInsideAnyBuildingFootprint(x, z, 55)) return { x, z };
  }
  return { x: 0, z: 0 };
}

function isTooCloseToAnyCar(x, z, minDist) {
  for (let c of cars) {
    let dx = x - c.x;
    let dz = z - c.z;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

function isInsideAnyBuildingFootprint(x, z, pad) {
  for (let b of buildings) {
    let halfW = b.w / 2 + pad;
    let halfD = b.d / 2 + pad;
    if (abs(x - b.x) <= halfW && abs(z - b.z) <= halfD) return true;
  }
  return false;
}

function updateFlyerCar(c, allCars, carIndex) {
  if (c.hitTimer > 0) c.hitTimer -= 1;

  if (c.state === 'burning') {
    // bleibt als brennendes Wrack am Boden
    c.alt = 0;
    c.vx *= 0.97;
    c.vz *= 0.97;
    c.x += c.vx;
    c.z += c.vz;
    return;
  }

  if (c.state === 'falling') {
    c.fallV += GRAVITY;
    c.alt = max(0, (c.alt ?? c.baseAlt) - c.fallV);
    c.vx *= 0.985;
    c.vz *= 0.985;
    c.x += c.vx;
    c.z += c.vz;

    if (c.alt <= 0.5) {
      c.alt = 0;
      c.state = 'burning';
      c.burning = true;
      c.crashX = c.x;
      c.crashZ = c.z;
      spawnCrashBurst(c.crashX, c.crashZ);
    }
    return;
  }

  // kleine Richtungsänderungen -> rechts/links fliegen
  c.heading += random(-2.2, 2.2);

  // gewünschte Geschwindigkeit aus heading
  let desiredVx = cos(c.heading) * c.maxSpeed;
  let desiredVz = sin(c.heading) * c.maxSpeed;

  // Wände: zurück in die Arena lenken
  let margin = 120;
  if (c.x < -WORLD_BOUND + margin) desiredVx = abs(desiredVx);
  if (c.x > WORLD_BOUND - margin) desiredVx = -abs(desiredVx);
  if (c.z < -WORLD_BOUND + margin) desiredVz = abs(desiredVz);
  if (c.z > WORLD_BOUND - margin) desiredVz = -abs(desiredVz);

  // Flughöhe (sinus) + Sicherheitsklemme
  let alt = c.baseAlt + sin(frameCount * 1.3 + c.phaseAlt) * c.ampAlt;
  alt = constrain(alt, CAR_MIN_ALT, CAR_MAX_ALT);

  // Häuser vermeiden (immer, damit sie zwischen Häusern fliegen)
  let avoid = avoidanceForceXZ(c.x, c.z);

  // Autos vermeiden (dürfen sich nicht berühren)
  let sep = separationForceXZ(c, allCars, carIndex);

  // Menschen vermeiden / fliehen
  let flee = fleeForceXZ(c);

  // Steering
  let steerX = (desiredVx - c.vx) * c.maxSteer + avoid.x + sep.x + flee.x;
  let steerZ = (desiredVz - c.vz) * c.maxSteer + avoid.z + sep.z + flee.z;
  let steerMag = sqrt(steerX * steerX + steerZ * steerZ);
  let steerLimit = 0.9;
  if (steerMag > steerLimit) {
    steerX = (steerX / steerMag) * steerLimit;
    steerZ = (steerZ / steerMag) * steerLimit;
  }

  c.vx += steerX;
  c.vz += steerZ;

  // Speed clamp
  let sp = sqrt(c.vx * c.vx + c.vz * c.vz);
  if (sp > c.maxSpeed) {
    c.vx = (c.vx / sp) * c.maxSpeed;
    c.vz = (c.vz / sp) * c.maxSpeed;
  }

  c.x += c.vx;
  c.z += c.vz;
  c.alt = alt;

  // Heading sanft in Bewegungsrichtung ziehen
  if (sp > 0.001) {
    let velHeading = atan2(c.vz, c.vx);
    c.heading = lerpAngle(c.heading, velHeading, 0.08);
  }

  // HP check -> abstürzen
  if (c.hp <= 0) {
    c.hp = 0;
    c.state = 'falling';
    c.fallV = 0;
  }
}

function lerpAngle(a, b, t) {
  // a,b in DEGREES
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function avoidanceForceXZ(x, z) {
  let ax = 0;
  let az = 0;
  for (let b of buildings) {
    // Abstand zur Rechteckfläche im XZ
    let halfW = b.w / 2 + 70;
    let halfD = b.d / 2 + 70;
    let nearestX = constrain(x, b.x - halfW, b.x + halfW);
    let nearestZ = constrain(z, b.z - halfD, b.z + halfD);
    let dx = x - nearestX;
    let dz = z - nearestZ;
    let dist = sqrt(dx * dx + dz * dz);

    let safe = 180;
    if (dist < safe) {
      // Richtung weg vom Gebäude (wenn genau drin: vom Zentrum weg)
      if (dist < 0.0001) {
        dx = x - b.x;
        dz = z - b.z;
        dist = sqrt(dx * dx + dz * dz) + 0.0001;
      }
      let strength = (safe - dist) / safe;
      let nx = dx / dist;
      let nz = dz / dist;
      ax += nx * strength * 1.6;
      az += nz * strength * 1.6;
    }
  }
  return { x: ax, z: az };
}

function humanAvoidanceForceXZ(x, z) {
  let ax = 0;
  let az = 0;
  for (let b of buildings) {
    let halfW = b.w / 2 + 55;
    let halfD = b.d / 2 + 55;
    let nearestX = constrain(x, b.x - halfW, b.x + halfW);
    let nearestZ = constrain(z, b.z - halfD, b.z + halfD);
    let dx = x - nearestX;
    let dz = z - nearestZ;
    let dist = sqrt(dx * dx + dz * dz);

    if (dist < HUMAN_AVOID_RADIUS) {
      if (dist < 0.0001) {
        dx = x - b.x;
        dz = z - b.z;
        dist = sqrt(dx * dx + dz * dz) + 0.0001;
      }
      let strength = (HUMAN_AVOID_RADIUS - dist) / HUMAN_AVOID_RADIUS;
      ax += (dx / dist) * strength * 1.25;
      az += (dz / dist) * strength * 1.25;
    }
  }
  return { x: ax, z: az };
}

function updateHuman(h) {
  // Ziel wählen: nächstes Auto, das noch fliegt
  let targetIdx = getNearestAliveCarIndex(h.x, h.z);
  h.targetIndex = targetIdx;

  // Haus-Avoidance
  let avoid = humanAvoidanceForceXZ(h.x, h.z);

  // Pursue / verfolgen
  let pvx = 0;
  let pvz = 0;
  if (targetIdx >= 0) {
    let c = cars[targetIdx];
    let predict = 22;
    let tx = c.x + c.vx * predict;
    let tz = c.z + c.vz * predict;

    let dx = tx - h.x;
    let dz = tz - h.z;
    let d = sqrt(dx * dx + dz * dz) + 0.0001;
    dx /= d;
    dz /= d;

    pvx = dx * h.speed * 1.35;
    pvz = dz * h.speed * 1.35;

    // Ausrichtung in Bewegungsrichtung
    h.heading = lerpAngle(h.heading, atan2(dz, dx), 0.15);
  }

  // gewünschte Bewegung
  let desiredVx = pvx + avoid.x * 3.4;
  let desiredVz = pvz + avoid.z * 3.4;

  // Bounds
  let margin = 160;
  if (h.x < -WORLD_BOUND + margin) desiredVx = abs(desiredVx);
  if (h.x > WORLD_BOUND - margin) desiredVx = -abs(desiredVx);
  if (h.z < -WORLD_BOUND + margin) desiredVz = abs(desiredVz);
  if (h.z > WORLD_BOUND - margin) desiredVz = -abs(desiredVz);

  h.x += desiredVx;
  h.z += desiredVz;

  // Schrittanimation
  h.stepPhase += h.speed * 8.0;

  if (h.shootCooldown > 0) h.shootCooldown -= 1;
}

function drawHuman(h) {
  push();
  translate(h.x, 0, h.z);
  rotateY(90 - h.heading);

  // Menschen etwas kleiner
  scale(0.78);

  // Höhe
  let hipY = -16;
  let bob = sin(h.stepPhase) * 1.5;
  translate(0, bob, 0);

  // Farben (dunkel + neon Akzent)
  noStroke();
  ambientMaterial(60);

  // Torso
  push();
  translate(0, hipY - 14, 0);
  box(10, 22, 6);
  pop();

  // Kopf
  push();
  translate(0, hipY - 30, 0);
  ambientMaterial(90);
  sphere(6, 10, 8);
  pop();

  // Arms + Legs swing
  let legSwing = sin(h.stepPhase) * 22;
  let armSwing = sin(h.stepPhase + 180) * 18;

  // Arme (schmal)
  push();
  translate(6, hipY - 18, 0);
  rotateZ(armSwing);
  ambientMaterial(70);
  box(3, 16, 3);

  // Waffe in rechter Hand
  push();
  // Hand-Ende (ungefähr)
  translate(0, 10, 6);
  emissiveMaterial(0, 220, 255);
  box(7, 2.2, 2.6);
  pop();

  pop();
  push();
  translate(-6, hipY - 18, 0);
  rotateZ(-armSwing);
  ambientMaterial(70);
  box(3, 16, 3);
  pop();

  // Beine
  push();
  translate(3, hipY + 2, 0);
  rotateZ(legSwing);
  ambientMaterial(55);
  box(3, 18, 3);
  pop();
  push();
  translate(-3, hipY + 2, 0);
  rotateZ(-legSwing);
  ambientMaterial(55);
  box(3, 18, 3);
  pop();

  // kleiner Neon "Gürtel"
  push();
  translate(0, hipY - 6, 3.6);
  emissiveMaterial(0, 200, 255);
  box(10, 2, 1);
  pop();

  pop();
}

function tryShootAtCars(h) {
  if (h.shootCooldown > 0) return;

  let idx = h.targetIndex;
  if (idx < 0) idx = getNearestAliveCarIndex(h.x, h.z);
  if (idx < 0) return;
  let c = cars[idx];
  if (c.state !== 'alive') return;

  // Reichweite check (3D)
  let muzzle = getHumanMuzzleWorld(h);
  let tx = c.x;
  let ty = -c.alt;
  let tz = c.z;
  let dx = tx - muzzle.x;
  let dy = ty - muzzle.y;
  let dz = tz - muzzle.z;
  let d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > HUMAN_SHOOT_RANGE * HUMAN_SHOOT_RANGE) return;

  // Schaden + Trefferfeedback
  c.hp -= LASER_DAMAGE;
  c.hitTimer = 10;

  // Laserstrahl (kurz sichtbar)
  lasers.push({
    x1: muzzle.x,
    y1: muzzle.y,
    z1: muzzle.z,
    x2: tx,
    y2: ty,
    z2: tz,
    life: LASER_LIFE
  });

  h.shootCooldown = floor(random(HUMAN_SHOOT_COOLDOWN_MIN, HUMAN_SHOOT_COOLDOWN_MAX));
}

function updateAndDrawLasers() {
  stroke(LASER_COLOR[0], LASER_COLOR[1], LASER_COLOR[2]);
  strokeWeight(3);
  for (let i = lasers.length - 1; i >= 0; i--) {
    let l = lasers[i];
    line(l.x1, l.y1, l.z1, l.x2, l.y2, l.z2);
    l.life -= 1;
    if (l.life <= 0) lasers.splice(i, 1);
  }
}

function getNearestAliveCarIndex(x, z) {
  let bestIdx = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < cars.length; i++) {
    let c = cars[i];
    if (c.state !== 'alive') continue;
    let dx = c.x - x;
    let dz = c.z - z;
    let d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function getHumanMuzzleWorld(h) {
  // grobe Weltposition der Waffe/Mündung passend zur Human-Ausrichtung
  let fx = cos(h.heading);
  let fz = sin(h.heading);
  let rx = cos(h.heading + 90);
  let rz = sin(h.heading + 90);
  return {
    x: h.x + rx * 10 + fx * 14,
    y: -26,
    z: h.z + rz * 10 + fz * 14
  };
}

function fleeForceXZ(c) {
  // Autos fliehen vor nächstem Menschen
  let bestDx = 0;
  let bestDz = 0;
  let bestD2 = CAR_FLEE_RANGE * CAR_FLEE_RANGE;
  let found = false;

  for (let h of humans) {
    let dx = c.x - h.x;
    let dz = c.z - h.z;
    let d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestDx = dx;
      bestDz = dz;
      found = true;
    }
  }

  if (!found) return { x: 0, z: 0 };
  let d = sqrt(bestD2) + 0.0001;
  let nx = bestDx / d;
  let nz = bestDz / d;
  let strength = (CAR_FLEE_RANGE - d) / CAR_FLEE_RANGE;
  return { x: nx * strength * CAR_FLEE_FORCE, z: nz * strength * CAR_FLEE_FORCE };
}

function spawnCrashBurst(x, z) {
  for (let i = 0; i < 40; i++) {
    fireParticles.push({
      x,
      y: 0,
      z,
      vx: random(-1.5, 1.5),
      vy: random(2.0, 6.5),
      vz: random(-1.5, 1.5),
      life: random(28, 60),
      size: random(6, 14),
      type: 'burst'
    });
  }
}

function updateAndDrawFire() {
  // pro brennendem Auto konstant Partikel nachspawnen
  for (let c of cars) {
    if (c.state !== 'burning') continue;
    for (let k = 0; k < FIRE_SPAWN_PER_FRAME; k++) {
      fireParticles.push({
        x: c.crashX + random(-10, 10),
        y: random(0, 10),
        z: c.crashZ + random(-10, 10),
        vx: random(-0.6, 0.6),
        vy: random(1.6, 4.2),
        vz: random(-0.6, 0.6),
        life: FIRE_PARTICLE_LIFE,
        size: random(4, 10),
        type: 'fire'
      });
    }
  }

  // update
  for (let i = fireParticles.length - 1; i >= 0; i--) {
    let p = fireParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vx *= 0.96;
    p.vz *= 0.96;
    p.vy *= 0.92;
    p.life -= 1;
    if (p.life <= 0) fireParticles.splice(i, 1);
  }

  // draw
  noStroke();
  for (let p of fireParticles) {
    push();
    translate(p.x, -p.y, p.z);
    let a = map(p.life, 0, FIRE_PARTICLE_LIFE, 0, 255);
    if (p.type === 'burst') {
      emissiveMaterial(255, random(80, 140), random(40, 80));
    } else {
      emissiveMaterial(255, random(90, 170), random(20, 60));
    }
    sphere(p.size, 8, 6);
    pop();
  }
}

function drawCarHUD() {
  if (typeof screenPosition !== 'function') return;

  push();
  resetMatrix();
  translate(-width / 2, -height / 2);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(12);

  for (let c of cars) {
    // nur anzeigen, wenn noch sichtbar / relevant
    if (c.state === 'burning') continue;

    let sp = screenPosition(c.x, -c.alt, c.z);
    if (!sp) continue;

    let hp = constrain(c.hp, 0, CAR_MAX_HP);
    let pct = floor((hp / CAR_MAX_HP) * 100);

    let x = sp.x;
    let y = sp.y - 32;
    let w = 70;
    let h = 12;

    fill(0, 160);
    rect(x - w / 2, y - h / 2, w, h, 3);

    let fw = (w - 4) * (hp / CAR_MAX_HP);
    if (hp > 0) {
      fill(0, 255, 120, 210);
      rect(x - w / 2 + 2, y - h / 2 + 2, fw, h - 4, 2);
    }

    fill(255);
    text(pct + '%', x, y);
  }

  pop();
}

function separationForceXZ(c, allCars, carIndex) {
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < allCars.length; i++) {
    if (i === carIndex) continue;
    let o = allCars[i];
    let dx = c.x - o.x;
    let dz = c.z - o.z;
    let d2 = dx * dx + dz * dz;
    if (d2 < 0.0001) continue;
    if (d2 < CAR_SEPARATION_RADIUS * CAR_SEPARATION_RADIUS) {
      let d = sqrt(d2);
      let nx = dx / d;
      let nz = dz / d;
      let strength = (CAR_SEPARATION_RADIUS - d) / CAR_SEPARATION_RADIUS;
      sx += nx * strength * 2.4;
      sz += nz * strength * 2.4;
    }
  }
  return { x: sx, z: sz };
}

function drawFlyerCar(c) {
  if (c.state === 'burning') {
    // Wrack: kleiner dunkler Klumpen
    push();
    translate(c.crashX, 0, c.crashZ);
    rotateY(90 - c.heading);
    noStroke();
    ambientMaterial(15);
    box(50, 10, 24);
    pop();
    return;
  }

  push();
  translate(c.x, -c.alt, c.z);

  // Richtung: Auto zeigt entlang +Z -> rotateY(90 - heading)
  rotateY(90 - c.heading);

  // leichtes "Schweben" & Banking
  let bank = constrain((c.vx + c.vz) * 2.2, -12, 12);
  rotateZ(bank);

  // Body
  noStroke();
  ambientMaterial(25);
  box(60, 16, 28);

  // Cockpit
  push();
  translate(0, -10, -2);
  ambientMaterial(35);
  box(38, 12, 20);
  pop();

  // Neon underglow (bei Treffer heller)
  push();
  translate(0, 10, 0);
  if (c.hitTimer > 0) {
    emissiveMaterial(255, 80, 80);
  } else {
    emissiveMaterial(c.bodyNeon);
  }
  box(52, 2, 22);
  pop();

  // 4 angedeutete Reifen mit Neon
  let wheelX = 22;
  let wheelZ = 14;
  let wheelY = 10;
  for (let sx of [-1, 1]) {
    for (let sz of [-1, 1]) {
      push();
      translate(sx * wheelX, wheelY, sz * wheelZ);
      rotateX(90);
      emissiveMaterial(c.wheelNeon);
      torus(6.5, 2.2, 18, 14);
      pop();
    }
  }

  pop();
}
