let particles = [];
let flowSeed;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(2);
  background(0);
  flowSeed = random(1000);
}

function draw() {
  background(0, 20);

  // kontinuierliche Emission nahe Cursor
  for (let i = 0; i < 6; i++) {
    particles.push(new Particle(mouseX, mouseY));
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();

    if (particles[i].dead()) {
      particles.splice(i, 1);
    }
  }
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x + random(-20, 20), y + random(-20, 20));

    this.vel = p5.Vector.random2D().mult(0.3);
    this.life = 0;
    this.maxLife = random(180, 320);
    this.size = random(1.5, 3.2);
  }

  update() {
    // -------------------
    // 1. Cursor Attraction
    // -------------------
    let target = createVector(mouseX, mouseY);
    let dir = p5.Vector.sub(target, this.pos);
    let dist = dir.mag() + 0.001;

    dir.normalize();
    let strength = constrain(dist / 300, 0.05, 0.6);
    dir.mult(strength);

    // -------------------
    // 2. Flow Field
    // -------------------
    let n = noise(this.pos.x * 0.002, this.pos.y * 0.002, flowSeed);

    let angle = n * TWO_PI * 2;
    let flow = p5.Vector.fromAngle(angle).mult(0.4);

    // -------------------
    // 3. Bewegung
    // -------------------
    this.vel.add(dir);
    this.vel.add(flow);
    this.vel.limit(2);

    this.pos.add(this.vel);
    this.life++;
  }

  draw() {
    let progress = this.life / this.maxLife;

    let col = lerpColor(color(0, 200, 120), color(255, 80, 20), progress);

    let alpha = map(this.life, 0, this.maxLife, 120, 0);
    col.setAlpha(alpha);

    noStroke();
    fill(col);
    circle(this.pos.x, this.pos.y, this.size);
  }

  dead() {
    return this.life > this.maxLife;
  }
}
