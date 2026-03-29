// =====================================================
// GLOBALER STATE & KONFIGURATION
// =====================================================

let t = 0;

// Assets
let landscapeImg;
let moonImg;
let planetImg;
let cockpitImg;
let rocketImg;

// Farben & UI
const COLORS = {
  bg: "#050008",
  grid: "#00F5FF",
  obj: "#FF2FD0",
  glitch: "#8A2EFF",
  ui: "#00F5FF",
};

const SCENES = {
  LANDSCAPE: "landscape",
  WORMHOLE: "wormhole",
  GRID_FLIGHT: "grid_flight",
};

let currentScene = SCENES.LANDSCAPE;

let transitioning = false;
let transitionProgress = 0;
const TRANSITION_SPEED = 0.02;
let targetScene = null;

// Himmel / Rotation
let skyAngle = 0;
const SKY_SPEED = 0.3;

// Sterne
const STAR_COUNT = 10000;
let stars = [];

// Data Objects (Wormhole)
let dataObjects = [];
let particles = [];
let rocketY;
let rocketLaunched = false;

// Grid Flight 3D
let gridFlightOffset = 0;
const GRID_SIZE = 40;
const GRID_DEPTH = 100;
let wormholeStartTime = 0;

let DEBUG_MODE = true;
let debugButtons = [];

// =====================================================
// p5 LIFECYCLE
// =====================================================

async function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("monospace");
  textSize(12);

  // 🔹 Assets laden (await direkt auf loadImage)
  landscapeImg = await loadImage("pictures/landscape_without_background.png");
  moonImg = await loadImage("pictures/landscape_moon.png");
  planetImg = await loadImage("pictures/landscape_planet.png");
  cockpitImg = await loadImage("pictures/cockpit_removed.png");
  rocketImg = await loadImage("pictures/landscape_rocket.png");

  // ⭐ Erst jetzt Initialisierung
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      angle: random(TWO_PI),
      radius: sqrt(random()) * width * 1.2,
      size: random(1, 3),
      alpha: random(80, 200),
    });
  }

  rocketY = height * 0.65;
  rocketLaunched = false;

  setupDebugUI();
}

function draw() {
  background(0);
  t += 0.01;

  if (currentScene === SCENES.LANDSCAPE) {
    drawLandscapeScene();
  }

  if (currentScene === SCENES.WORMHOLE) {
    drawWormholeScene();
  }

  if (currentScene === SCENES.GRID_FLIGHT) {
    drawGridFlightScene();
  }

  if (transitioning) {
    updateTransition();
  }

  drawHint();
  drawDebugUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function drawCockpit() {
  if (!cockpitImg) return;

  push();
  imageMode(CENTER);

  // exakt auf Canvas skaliert
  image(cockpitImg, width / 2, height / 2, width, height);
  translate(sin(t * 0.1) * 2, cos(t * 0.13) * 2);

  pop();
}

function setupDebugUI() {
  debugButtons = [];

  let x = 20;
  let y = 20;
  let w = 160;
  let h = 28;
  let gap = 6;

  const debugScenes = [SCENES.LANDSCAPE, SCENES.WORMHOLE, SCENES.GRID_FLIGHT];

  for (let scene of debugScenes) {
    debugButtons.push({
      scene: scene,
      label: scene,
      x: x,
      y: y,
      w: w,
      h: h,
    });
    y += h + gap;
  }
}

// =====================================================
// SZENEN
// =====================================================

function drawLandscapeScene() {
  drawStaticSkyBackground();
  drawRotatingSky();

  drawRocket(); // 🚀 Rakete + Feuer + Rauch
  drawLandscape(); // ⛰️ Berge darüber
}

function drawWormholeScene() {
  drawWormholeStars();
  drawWormhole();
  drawCockpit();
}

// =====================================================
// 3D GRID FLIGHT SCENE
// =====================================================

function drawGridFlightScene() {
  background(5, 0, 8);

  // Sternenhintergrund
  push();
  noStroke();
  let cx = width / 2;
  let cy = height / 2;

  for (let s of stars) {
    let a = s.angle + skyAngle * 0.1;
    let x = cx + cos(a) * s.radius;
    let y = cy + sin(a) * s.radius;

    if (x > -20 && x < width + 20 && y > -20 && y < height + 20) {
      fill(255, s.alpha * 0.4);
      circle(x, y, s.size * 0.8);
    }
  }
  pop();

  // 3D Grid Terrain
  push();
  translate(width / 2, height * 0.75);

  gridFlightOffset += 2.5;

  let spacing = 25;
  let gridWidth = GRID_SIZE;
  let gridDepth = GRID_DEPTH;

  // Perspektive simulieren
  for (let z = 0; z < gridDepth; z++) {
    let depth = z + (gridFlightOffset % spacing) / spacing;
    let zPos = depth * spacing;

    // Perspektivische Skalierung
    let scale = 1 - (depth / gridDepth) * 0.85;
    if (scale <= 0) continue;

    let yOffset = map(depth, 0, gridDepth, 0, -height * 0.6);

    // Terrain-Wellen
    let waveHeight = sin(depth * 0.15 + t * 2) * 30 * scale;
    waveHeight += cos(depth * 0.25 + t * 1.5) * 20 * scale;

    // Farbe: Pink/Cyan Gradient basierend auf Tiefe
    let hue = ((depth / gridDepth) * 60 + t * 20) % 360;
    let brightness = 255;
    let alpha = map(scale, 0, 1, 30, 200);

    strokeWeight(map(scale, 0, 1, 0.5, 2.5));

    // Horizontale Linien
    stroke(255, 0, 200, alpha);
    let y = yOffset + waveHeight;
    line(-gridWidth * spacing * scale, y, gridWidth * spacing * scale, y);

    // Vertikale Linien (nur alle paar Schritte)
    if (z % 3 === 0) {
      for (let x = -gridWidth; x <= gridWidth; x += 2) {
        let xPos = x * spacing * scale;

        // Nächste Linie finden für Verbindung
        let nextZ = z + 3;
        if (nextZ < gridDepth) {
          let nextDepth = nextZ + (gridFlightOffset % spacing) / spacing;
          let nextScale = 1 - (nextDepth / gridDepth) * 0.85;
          let nextYOffset = map(nextDepth, 0, gridDepth, 0, -height * 0.6);
          let nextWave =
            sin(nextDepth * 0.15 + t * 2) * 30 * nextScale + cos(nextDepth * 0.25 + t * 1.5) * 20 * nextScale;

          stroke(0, 255, 255, alpha * 0.7);
          line(xPos, y, x * spacing * nextScale, nextYOffset + nextWave);
        }
      }
    }
  }

  pop();

  // Rakete im Vordergrund
  if (rocketImg) {
    push();
    translate(width / 2, height * 0.4);

    // Leichte Bewegung
    translate(sin(t * 2) * 5, cos(t * 1.5) * 3);

    // Rakete etwas gedreht
    rotate(sin(t * 1.5) * 0.05);

    imageMode(CENTER);
    image(rocketImg, 0, 0, 100, 200);

    // Triebwerksfeuer
    for (let i = 0; i < 3; i++) {
      particles.push(
        new Particle(
          width / 2 + random(-5, 5),
          height * 0.4 + 100,
          color(255, random(100, 180), 0),
          150,
          random(8, 14),
          random(2, 4)
        )
      );
    }

    pop();
  }

  // Partikel updaten
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  // Glühen am Horizont
  push();
  noStroke();
  let gradient = drawingContext.createRadialGradient(width / 2, height, 0, width / 2, height, height * 0.4);
  gradient.addColorStop(0, "rgba(255, 0, 200, 0.3)");
  gradient.addColorStop(0.5, "rgba(138, 46, 255, 0.1)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  drawingContext.fillStyle = gradient;
  rect(0, height * 0.6, width, height * 0.4);
  pop();
}

// =====================================================
// HIMMEL & LANDSCHAFT
// =====================================================

function drawStaticSkyBackground() {
  noStroke();

  for (let y = 0; y < height; y++) {
    let t = y / height;

    let top = color(5, 0, 8);
    let mid = color(80, 5, 10);
    let horizon = color(180, 30, 10);

    let c = t < 0.65 ? lerpColor(top, mid, t / 0.65) : lerpColor(mid, horizon, (t - 0.65) / 0.35);

    stroke(c);
    line(0, y, width, y);
  }
}

function drawRotatingSky() {
  push();
  imageMode(CENTER);
  noStroke();

  let cx = width / 2;
  let cy = height;

  skyAngle += SKY_SPEED * 0.008;

  // Sterne
  for (let s of stars) {
    let a = s.angle + skyAngle * 0.3;
    let x = cx + cos(a) * s.radius;
    let y = cy + sin(a) * s.radius;

    if (x > -10 && x < width + 10 && y > -10 && y < height + 10) {
      fill(255, s.alpha);
      circle(x, y, s.size);
    }
  }

  // Gemeinsamer Orbit
  let orbitRadius = width * 0.5;

  // Mond
  let moonX = cx + cos(skyAngle * 1.4) * orbitRadius;
  let moonY = cy + sin(skyAngle * 1.4) * orbitRadius;

  image(moonImg, moonX, moonY, 160, 160);

  // Planet (gleiche Linie)
  let planetAngle = skyAngle + PI * 0.35;
  let planetX = cx + cos(planetAngle * 1.4) * orbitRadius;
  let planetY = cy + sin(planetAngle * 1.4) * orbitRadius;
  image(planetImg, planetX, planetY, 220, 220);

  pop();
}

function drawLandscape() {
  push();
  translate(sin(t * 0.2) * 8, cos(t * 0.15) * 4);
  imageMode(CENTER);
  image(landscapeImg, width / 2, height / 2, width, height);
  pop();
}

function drawRocket() {
  if (!rocketImg) return;

  if (rocketLaunched) {
    rocketY -= 1.2;
  }

  let rocketX = width * 0.5;

  if (rocketLaunched) {
    for (let i = 0; i < 4; i++) {
      particles.push(
        new Particle(rocketX, rocketY + 90, color(255, random(100, 160), 0), 180, random(6, 10), random(1.5, 3))
      );
    }

    for (let i = 0; i < 2; i++) {
      particles.push(new Particle(rocketX, rocketY + 90, color(180), 220, random(10, 18), random(0.5, 1)));
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].isDead()) particles.splice(i, 1);
  }

  imageMode(CENTER);
  image(rocketImg, rocketX, rocketY, 120, 240);

  // 🚀 Automatischer Übergang NACH Verlassen des Bildes
  if (rocketLaunched && rocketY < -300 && !transitioning) {
    transitioning = true;
    transitionProgress = 0;
    targetScene = SCENES.WORMHOLE;
  }
}

// =====================================================
// WORMHOLE / GRID
// =====================================================

function drawWormholeStars() {
  push();
  noStroke();

  let cx = width / 2;
  let cy = height / 2;

  let localAngle = skyAngle * (0.15 + transitionProgress * 1.5);

  for (let s of stars) {
    let a = s.angle + localAngle;
    let r = s.radius * (1 - transitionProgress * 0.6);

    let x = cx + cos(a) * r;
    let y = cy + sin(a) * r;

    if (x > -20 && x < width + 20 && y > -20 && y < height + 20) {
      let twinkle = sin(t * 2 + s.angle * 6);
      fill(255, s.alpha + twinkle * 40);
      circle(x, y, s.size + twinkle * 0.3);
    }
  }

  pop();
}

function drawWormhole() {
  push();
  translate(width / 2, height / 2);

  // 🔥 ZOOM IN BEIM ÜBERGANG
  let zoom = 1 + pow(transitionProgress, 2) * 4;
  scale(zoom);

  let rings = 80;
  let segments = 220;
  let maxRadius = min(width, height) * 0.45;
  let time = t * (0.6 + transitionProgress * 2.5);

  for (let i = 0; i < rings; i++) {
    let depth = i / rings;
    let baseR = pow(depth, 1.8) * maxRadius;
    let noiseStrength = map(depth, 0, 1, 10, 70);

    strokeWeight(map(depth, 0, 1, 0.3, 2.2));
    stroke(0, 255, 120, map(depth, 0, 1, 30, 160));
    noFill();

    beginShape();
    for (let a = 0; a <= segments; a++) {
      let angle = (TWO_PI / segments) * a;
      let n = noise(cos(angle) + i * 0.05, sin(angle) + i * 0.05, time);
      let r = baseR + n * noiseStrength;
      vertex(cos(angle + time * 0.15) * r, sin(angle + time * 0.15) * r);
    }
    endShape(CLOSE);
  }

  pop();

  // Automatischer Übergang zu GRID_FLIGHT nach einigen Sekunden
  let timeSinceWormhole = millis() - wormholeStartTime;
  if (currentScene === SCENES.WORMHOLE && !transitioning && timeSinceWormhole > 5000) {
    transitioning = true;
    transitionProgress = 0;
    targetScene = SCENES.GRID_FLIGHT;
  }
}

// =====================================================
// ÜBERGANG & UI
// =====================================================

function updateTransition() {
  transitionProgress += TRANSITION_SPEED;
  transitionProgress = constrain(transitionProgress, 0, 1);

  noStroke();
  fill(0, 180 * transitionProgress);
  rect(0, 0, width, height);

  // Weißer Flash NUR für WORMHOLE
  if (targetScene === SCENES.WORMHOLE && transitionProgress > 0.7) {
    let alpha = map(transitionProgress, 0.7, 1, 0, 255);
    fill(255, alpha);
    rect(0, 0, width, height);
  }

  // Weißer Flash für GRID_FLIGHT
  if (targetScene === SCENES.GRID_FLIGHT && transitionProgress > 0.7) {
    let alpha = map(transitionProgress, 0.7, 1, 0, 255);
    fill(255, alpha);
    rect(0, 0, width, height);
  }

  if (transitionProgress >= 1) {
    transitioning = false;
    transitionProgress = 0;

    currentScene = targetScene;
    targetScene = null;

    if (currentScene === SCENES.LANDSCAPE) {
      rocketY = height * 0.65;
      rocketLaunched = false;
      particles = [];
    }

    if (currentScene === SCENES.WORMHOLE) {
      wormholeStartTime = millis();
    }

    if (currentScene === SCENES.GRID_FLIGHT) {
      gridFlightOffset = 0;
      particles = [];
    }
  }
}

function drawHint() {
  fill(0, 255, 255, 120);
  noStroke();
  text("CLICK TO TRANSITION", width - 190, height - 20);
}

function drawDebugUI() {
  if (!DEBUG_MODE) return;

  push();
  noStroke();
  fill(0, 180);
  rect(10, 10, 180, debugButtons.length * 34 + 10, 6);

  textAlign(LEFT, CENTER);
  textSize(12);

  for (let b of debugButtons) {
    if (b.scene === currentScene) {
      fill(0, 255, 255);
    } else {
      fill(200);
    }

    rect(b.x, b.y, b.w, b.h, 4);

    fill(0);
    text(b.label, b.x + 8, b.y + b.h / 2);
  }

  fill(255);
  text("DEBUG MODE", 20, debugButtons[debugButtons.length - 1].y + debugButtons[0].h + 20);

  pop();
}

class Particle {
  constructor(x, y, col, lifespan, size, velY) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-0.5, 0.5), velY);
    this.life = lifespan;
    this.col = col;
    this.size = size;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 4;
  }

  draw() {
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.life);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.life <= 0;
  }
}

// =====================================================
// INPUT
// =====================================================

function mousePressed() {
  if (DEBUG_MODE) {
    for (let b of debugButtons) {
      if (mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h) {
        // harte Szene setzen
        currentScene = b.scene;
        transitioning = false;
        transitionProgress = 0;
        targetScene = null;

        // Reset-Zustände
        rocketY = height * 0.65;
        rocketLaunched = false;
        particles = [];

        if (currentScene === SCENES.WORMHOLE) {
          wormholeStartTime = millis();
        }

        if (currentScene === SCENES.GRID_FLIGHT) {
          gridFlightOffset = 0;
        }

        return;
      }
    }
  }

  if (transitioning) return;

  if (currentScene === SCENES.LANDSCAPE && !rocketLaunched) {
    rocketLaunched = true;
    return;
  }

  transitioning = true;
  transitionProgress = 0;
}

function keyPressed() {
  if (key === "d" || key === "D") {
    DEBUG_MODE = !DEBUG_MODE;
  }
}
