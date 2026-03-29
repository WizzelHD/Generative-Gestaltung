let font;
let bgImg;
let bgBuffer; // Buffer für Background - wird nur einmal gerendert

// Wortpunkte für alle drei Wörter
let pointsWinter = [];
let pointsIs = [];
let pointsComing = [];
let firstInteraction = true;

// aktuelles Wort-Ziel
let currentTargets = [];

// Partikel
let particles = [];

// Hover-Zustand
let mode = "winter";

// Aurora
let auroraZ1 = 0;

let canSwitch = true;

let emojis;
let emoji;

let pointEmojis = [];

// Schneeflocken System
let snowflakes = [];
let maxSnowflakes = 20;

// Bounds für Hover-Bereiche - gecacht
let boundsWinter, boundsIs, boundsComing;
let showFpsFlag = true;
let soundPlaying = false;

let music;
let musicStarted = false;

async function setup() {
  bgImg = await loadImage("./background.png");

  // HTML5 Audio statt p5.sound
  music = new Audio("./music-box-we-wish-you-a-merry-christmas-79501.mp3");
  music.volume = 0.5;
  music.loop = true;

  font = await loadFont("./AvenirNextLTPro-Demi.otf");
  createCanvas(window.innerWidth, window.innerHeight - 5);
  noStroke();
  textFont(font);

  // Buffer für Background erstellen
  bgBuffer = createGraphics(width, height);
  renderBackgroundToBuffer();

  const fontSize = 150;
  textSize(fontSize);

  // horizontale Begrenzung
  const safeMarginX = 20;

  // zufällige vertikale Bereiche
  const yWinter = random(height * 0.65, height * 0.78);
  const yIs = random(height * 0.45, height * 0.58);
  const yComing = random(height * 0.25, height * 0.38);

  // zufällige horizontale Bereiche ohne Randüberlauf
  const xWinter = random(safeMarginX, width - safeMarginX - textWidth("WINTER"));
  const xIs = random(safeMarginX, width - safeMarginX - textWidth("IS"));
  const xComing = random(safeMarginX, width - safeMarginX - textWidth("COMING"));

  // Worte in Punktlisten umwandeln
  pointsWinter = font.textToPoints("WINTER", xWinter, yWinter, fontSize, { sampleFactor: 0.18 });
  pointsIs = font.textToPoints("IS", xIs, yIs, fontSize, { sampleFactor: 0.18 });
  pointsComing = font.textToPoints("COMING", xComing, yComing, fontSize, { sampleFactor: 0.18 });

  // sicherstellen, dass alle Wortlisten gleich viele Punkte haben
  const maxCount = max(pointsWinter.length, pointsIs.length, pointsComing.length);
  pointsWinter = padPoints(pointsWinter, maxCount);
  pointsIs = padPoints(pointsIs, maxCount);
  pointsComing = padPoints(pointsComing, maxCount);

  emojis = ["🎅🏻", "❄️", "⛄️", "🧣", "🧤", "🎄", "🔔", "⭐️", "🍪"];

  assignEmojisToPoints(maxCount);

  // Partikel erzeugen
  for (let i = 0; i < maxCount; i++) {
    particles.push(new ParticleOutside(pointsWinter[i].x, pointsWinter[i].y));
  }

  currentTargets = pointsWinter;

  // Berechne Bounds einmal im Setup
  boundsWinter = getBounds(pointsWinter);
  boundsIs = getBounds(pointsIs);
  boundsComing = getBounds(pointsComing);
}

// Background nur EINMAL rendern
function renderBackgroundToBuffer() {
  let imgRatio = bgImg.width / bgImg.height;
  let canvasRatio = width / height;

  if (imgRatio > canvasRatio) {
    let newWidth = imgRatio * height;
    bgBuffer.image(bgImg, (width - newWidth) / 2, 0, newWidth, height);
  } else {
    let newHeight = width / imgRatio;
    bgBuffer.image(bgImg, 0, (height - newHeight) / 2, width, newHeight);
  }
}

function showFps() {
  push();
  fill(255, 0, 0);
  textAlign(LEFT, TOP);
  textSize(14);
  textFont("Arial Unicode MS");
  text("FPS: " + Math.round(frameRate()), 10, 10);

  // Sound-Status anzeigen
  if (firstInteraction) {
    fill(255, 255, 0);
    text("Press M to start music", 10, 30);
  } else {
    fill(soundPlaying ? color(0, 255, 0) : color(255, 100, 100));
    text("Music: " + (soundPlaying ? "ON" : "OFF") + " (Press M)", 10, 30);
  }

  fill(255, 255, 255);
  text("Hide: space", 10, 50);
  pop();
}

function pickEmoji() {
  emoji = Math.floor(random(emojis.length));
}

// Weise jedem Punkt ein festes Emoji zu
function assignEmojisToPoints(totalPoints) {
  pointEmojis = [];
  for (let i = 0; i < totalPoints; i += 2) {
    pointEmojis[i] = emojis[Math.floor(Math.random() * emojis.length)];
  }
}

function drawEmojiText() {
  push();

  fill(255, 255, 255, 200);
  textSize(10);
  textAlign(CENTER, CENTER);
  textFont("Arial Unicode MS");

  for (let i = 0; i < particles.length; i += 1) {
    let emojiIndex = i % emojis.length;
    text(emojis[emojiIndex], particles[i].pos.x, particles[i].pos.y);
  }

  pop();
}

function keyPressed() {
  if (key === "m" || key === "M") {
    if (!musicStarted) {
      try {
        music.play();
        soundPlaying = true;
        musicStarted = true;
        firstInteraction = false;
      } catch (error) {
        console.error("Error starting music:", error);
      }
    } else {
      if (!music.paused) {
        music.pause();
        soundPlaying = false;
      } else {
        try {
          music.play();
          soundPlaying = true;
        } catch (error) {
          console.error("Error resuming music:", error);
        }
      }
    }
  }
  if (key === " ") {
    showFpsFlag = !showFpsFlag;
  }
}

function padPoints(list, targetCount) {
  let out = [...list];
  while (out.length < targetCount) {
    out.push(list[int(random(list.length))]);
  }
  return out;
}

function generatePointsForWord(word) {
  const fontSize = 150;
  const safeMarginX = 50;

  let yStart, yEnd;

  if (word === "WINTER") {
    yStart = height * 0.5;
    yEnd = height * 0.75;
  } else if (word === "IS") {
    yStart = height * 0.5;
    yEnd = height * 0.75;
  } else if (word === "COMING") {
    yStart = height * 0.5;
    yEnd = height * 0.75;
  }

  const y = random(yStart, yEnd);
  const x = random(safeMarginX, width - safeMarginX - textWidth(word));

  return font.textToPoints(word, x, y, fontSize, { sampleFactor: 0.18 });
}

function particlesAreSettled() {
  let threshold = 8;
  for (let p of particles) {
    if (p.pos.dist(p.target) > threshold) return false;
  }
  return true;
}

function draw() {
  // Zeichne Background aus Buffer (nicht neu gerendert)
  image(bgBuffer, 0, 0);

  drawAurora();

  // Hover-Bereiche bestimmen
  let oldMode = mode;

  if (canSwitch) {
    if (mode === "winter" && inside(mouseX, mouseY, boundsWinter)) {
      mode = "is";
    } else if (mode === "is" && inside(mouseX, mouseY, boundsIs)) {
      mode = "coming";
    } else if (mode === "coming" && inside(mouseX, mouseY, boundsComing)) {
      mode = "winter";
    }
  }

  // aktuelles Wort setzen
  if (mode !== oldMode) {
    canSwitch = false;

    if (mode === "winter") {
      pointsWinter = generatePointsForWord("WINTER");
      pointsWinter = padPoints(pointsWinter, particles.length);
      currentTargets = pointsWinter;
      boundsWinter = getBounds(pointsWinter);
    }

    if (mode === "is") {
      pointsIs = generatePointsForWord("IS");
      pointsIs = padPoints(pointsIs, particles.length);
      currentTargets = pointsIs;
      boundsIs = getBounds(pointsIs);
    }

    if (mode === "coming") {
      pointsComing = generatePointsForWord("COMING");
      pointsComing = padPoints(pointsComing, particles.length);
      currentTargets = pointsComing;
      boundsComing = getBounds(pointsComing);
    }
  }

  // Partikel bewegen
  for (let i = 0; i < particles.length; i++) {
    let target = currentTargets[i];
    particles[i].setTarget(target.x, target.y);
    particles[i].update();
    particles[i].display();
  }

  drawEmojiText();

  // Schneeflocken System
  if (!canSwitch && particlesAreSettled()) {
    canSwitch = true;
  }

  updateSnowflakes();

  if (showFpsFlag) {
    showFps();
  }
}

// Wort Grenzen
function getBounds(points) {
  let xs = points.map((p) => p.x);
  let ys = points.map((p) => p.y);
  return {
    x1: min(xs) - 20,
    y1: min(ys) - 20,
    x2: max(xs) + 20,
    y2: max(ys) + 20,
  };
}

function inside(mx, my, b) {
  return mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2;
}

// Partikel
class ParticleOutside {
  constructor(tx, ty) {
    this.target = createVector(tx, ty);

    // Startposition (außerhalb der Canvas)
    const side = floor(random(4));
    if (side === 0) this.pos = createVector(random(width), -50);
    if (side === 1) this.pos = createVector(random(width), height + 50);
    if (side === 2) this.pos = createVector(-50, random(height));
    if (side === 3) this.pos = createVector(width + 50, random(height));

    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.acc = createVector(0, 0);
    this.r = random(1.5, 3);
  }

  setTarget(x, y) {
    this.target = createVector(x, y);
  }

  applyForce(f) {
    this.acc.add(f);
  }

  update() {
    let desired = p5.Vector.sub(this.target, this.pos);
    let d = desired.mag(); // Länge des Vektors (Abstand zum Ziel)
    let maxSpeed = 14;
    let maxForce = 1.0;

    if (d < 60) maxSpeed = map(d, 0, 60, 0, 8);

    desired.setMag(maxSpeed);

    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(maxForce);

    this.applyForce(steer);

    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  display() {
    noStroke();
    fill(255, 255, 255, 35);
    circle(this.pos.x, this.pos.y, this.r * 4);

    fill(230, 240, 255);
    circle(this.pos.x, this.pos.y, this.r * 2);
  }
}

// Polarlicht
function drawAurora() {
  noStroke();
  const baseY = 120;
  const auroraTop = 200;
  const auroraBottom = 90;
  const fadePower = 2.0;

  for (let x = 0; x < width; x += 2) {
    let nTop = noise(x * 0.008, auroraZ1);
    let hTop = map(nTop, 0, 1, 10, auroraTop);
    let nBot = noise(x * 0.015, auroraZ1);
    let hBot = map(nBot, 0, 1, 5, auroraBottom);

    let topY = baseY - hTop;
    let bottomY = baseY + hBot;

    let green = lerpColor(color(80, 255, 120), color(120, 255, 90), nTop);
    let red = color(255, 90, 60);

    let col = hTop > auroraTop * 0.7 ? lerpColor(green, red, 0.5) : green;

    let fade = pow(1 - hBot / auroraBottom, fadePower);
    col.setAlpha(150 * fade);

    fill(col);
    beginShape();
    vertex(x, topY);
    vertex(x + 4, topY);
    vertex(x + 4, bottomY);
    vertex(x, bottomY);
    endShape(CLOSE);
  }

  auroraZ1 += 0.006;
}

// Schneeflocken System
function updateSnowflakes() {
  if (snowflakes.length < maxSnowflakes && random() < 0.1) {
    snowflakes.push(new SnowFlake());
  }

  for (let i = snowflakes.length - 1; i >= 0; i--) {
    snowflakes[i].update();
    snowflakes[i].show();

    if (snowflakes[i].finished()) {
      snowflakes.splice(i, 1);
    }
  }
}

class SnowFlake {
  constructor() {
    this.x = random(width);
    this.y = random(-50, 0);
    this.vx = 0;
    this.vy = random(2, 5);
    this.alpha = random(150, 255);
    this.size = random(15, 25);
    this.rotation = random(TWO_PI);
    this.rotSpeed = random(-0.05, 0.05);
  }

  update() {
    this.vx += 0 * 0.05 + 1 * 0.02;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 1;
    this.rotation += this.rotSpeed;
  }

  finished() {
    return this.alpha <= 0 || this.y > height + 50 || this.x < -50 || this.x > width + 50;
  }

  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rotation);

    fill(255, 255, 255, this.alpha);
    textAlign(CENTER, CENTER);
    textSize(this.size);
    textFont("Arial Unicode MS");
    text("❄", 0, 0);
    pop();
  }
}
