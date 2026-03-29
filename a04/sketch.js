// Quellen:
// - Basierend auf Code aus CC 27
// - Inspiration für Herzkurve: https://mathworld.wolfram.com/HeartCurve.html

let fireworks = [];
let width_canvas;
let height_canvas;
let buttons = [];
let selectedTypes = [];
let spawnSlider;
let rocketSlider;
let whistleSound;
let explosionSound;
let audioUnlocked = false;

const FIREWORK_COLORS = [
  [255, 80, 80],
  [255, 120, 0],
  [255, 200, 0],
  [80, 255, 80],
  [0, 200, 255],
  [0, 140, 255],
  [140, 80, 255],
  [255, 0, 200],
  [255, 140, 220],
  [255, 100, 40],
  [0, 255, 180],
  [255, 255, 255],
];

const FIREWORK_TYPES = [
  "Normal",
  "Spirale",
  "Komet",
  "Palme",
  "2 Phasen",
  "Herz",
  "Blume",
  "Riesig",
  "Schnecke",
  "Ring",
];

let backgroundImg;
let foregroundLayer;

async function setup() {
  width_canvas = windowWidth;
  height_canvas = windowHeight;

  createCanvas(width_canvas, height_canvas);
  backgroundImg = await loadImage("dark_city.png");

  foregroundLayer = createGraphics(width_canvas, height_canvas);
  foregroundLayer.image(backgroundImg, 0, 0, width_canvas, height_canvas);
  foregroundLayer.loadPixels();

  // schwarze bzw. dunkle Pixel transparent machen 
  for (let i = 0; i < foregroundLayer.pixels.length; i += 4) {
    let r = foregroundLayer.pixels[i];
    let g = foregroundLayer.pixels[i + 1];
    let b = foregroundLayer.pixels[i + 2];

    if (r < 80 && g < 80 && b < 80) {
      foregroundLayer.pixels[i + 3] = 0;
    }
  }

  foregroundLayer.updatePixels();

  whistleSound = new Audio("whistle.m4a");
  whistleSound.volume = 0.5;
  explosionSound = new Audio("explosion.mp3");
  explosionSound.volume = 0.6;

  // Text für max. Raketen
  let maxRocketText = createDiv("Max. Raketen");
  maxRocketText.position(20, 10);
  maxRocketText.style("color", "white");
  maxRocketText.style("font-family", "Arial");

  rocketSlider = createSlider(1, 20, 5, 1);
  rocketSlider.position(20, 30);
  rocketSlider.style("width", "150px");

  // Text für Wahrscheinlichkeit
  let spawnText = createDiv("Wahrscheinlichkeit");
  spawnText.position(20, 50);
  spawnText.style("color", "white");
  spawnText.style("font-family", "Arial");

  spawnSlider = createSlider(0, 100, 8, 1);
  spawnSlider.position(20, 70);
  spawnSlider.style("width", "150px");

  // Buttons
  for (let i = 0; i < FIREWORK_TYPES.length; i++) {
    let type = FIREWORK_TYPES[i];
    let btn = createButton(type);

    btn.position(width_canvas - 120, 20 + i * 32);
    btn.size(100, 28);
    buttons.push(btn);

    btn.mousePressed(() => {
      let idx = selectedTypes.indexOf(type);

      if (idx >= 0) {
        // Entfernen (abschalten)
        selectedTypes.splice(idx, 1);
      } else {
        // Hinzufügen (einschalten)
        selectedTypes.push(type);
      }

      updateButtonStyles();
    });
  }

  updateButtonStyles();
}

function mousePressed() {
  if (!audioUnlocked && whistleSound) {
    whistleSound
      .play()
      .then(() => {
        whistleSound.pause();
        whistleSound.currentTime = 0;
        audioUnlocked = true;
      })
      .catch((e) => console.log("Audio failed:", e));
  }
}

function draw() {
  background(0, 20);

  const max_concurrent = rocketSlider.value();
  const active_fireworks = fireworks.filter((f) => frameCount - f.start_frame < 110).length;

  if (random() < spawnSlider.value() / 100 && active_fireworks < max_concurrent) {
    let start_x = random(width_canvas * 0.2, width_canvas * 0.8);
    let explode_y = random(height_canvas * 0.1, height_canvas * 0.4);
    fireworks.push(new Firework(start_x, explode_y, frameCount));
  }

  // Feuerwerke zeichnen
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].display();

    if (fireworks[i].isDead()) {
      fireworks.splice(i, 1);
    }
  }

  // Vordergrund zeichnen
  if (foregroundLayer) {
    image(foregroundLayer, 0, 0);
  }
}
function windowResized() {
  width_canvas = windowWidth;
  height_canvas = windowHeight;
  resizeCanvas(width_canvas, height_canvas);

  rocketSlider.position(20, 20);
  spawnSlider.position(20, 60);

  for (let i = 0; i < buttons.length; i++) {
    buttons[i].position(width_canvas - 120, 20 + i * 32);
  }
}

function updateButtonStyles() {
  for (let i = 0; i < FIREWORK_TYPES.length; i++) {
    let type = FIREWORK_TYPES[i];

    if (selectedTypes.includes(type)) {
      buttons[i].style("background-color", "#ff4444");
      buttons[i].style("color", "white");
    } else {
      buttons[i].style("background-color", "#222");
      buttons[i].style("color", "#ccc");
    }
  }
}

class Firework {
  constructor(x, y, start_frame) {
    this.launch_x = x;
    this.launch_y = height_canvas * 0.8;
    this.explode_x = x;
    this.explode_y = y;
    this.start_frame = start_frame;
    this.launch_duration = 20;
    this.explosion_duration = 90;

    if (selectedTypes.length > 0) {
      this.type = random(selectedTypes);
    } else {
      this.type = random(FIREWORK_TYPES);
    }

    if (this.type === "Herz") {
      this.color_scheme = [
        [255, 40, 80],
        [255, 70, 120],
      ];
    } else {
      let c1 = random(FIREWORK_COLORS);
      let c2 = random(FIREWORK_COLORS);
      this.color_scheme = [c1, c2];
    }

    this.particles = [];

    this.num_particles = 60;
    this.createParticles();

    this.trailEmitter = new Smoke(this.launch_x, this.launch_y);
  }

  createParticles() {
    if (this.type === "Spirale") {
      for (let i = 0; i < this.num_particles; i++) {
        let angle = (i / this.num_particles) * TWO_PI * 2;
        let height = (i / this.num_particles) * 2 - 1;
        let radius = 2.5 + sin(angle * 2) * 0.5;

        let vx = radius * cos(angle);
        let vy = height * 2;

        this.particles.push({
          vx: vx,
          vy: vy,
          color: this.getGradientColor(random()),
          lifespan: random(40, 60),
        });
      }
    } else if (this.type === "Normal") {
      for (let i = 0; i < this.num_particles; i++) {
        let theta = random(TWO_PI);
        let speed = random(2.5, 4);

        this.particles.push({
          vx: cos(theta) * speed,
          vy: sin(theta) * speed,
          trail: [],
          maxTrail: 8,
          color: this.getGradientColor(random()),
          lifespan: random(55, 75),
        });
      }
    } else if (this.type === "Komet") {
      for (let i = 0; i < this.num_particles; i++) {
        let theta = random(0, TWO_PI);
        let phi = random(0, PI * 0.6);
        let speed = random(2.5, 4.5);

        let vx = speed * sin(phi) * cos(theta);
        let vy = speed * sin(phi) * sin(theta) + 1.5;

        this.particles.push({
          vx: vx,
          vy: vy,
          color: this.getGradientColor(random()),
          lifespan: random(60, 80),
          trail: true,
        });
      }
    } else if (this.type === "Palme") {
      for (let i = 0; i < this.num_particles; i++) {
        let theta = random(0, TWO_PI);
        let upward_bias = random(0.7, 1.0);
        let horizontal = random(0.3, 0.7);
        let speed = random(3.0, 4.5);

        let vx = speed * horizontal * cos(theta);
        let vy = -speed * upward_bias;

        this.particles.push({
          vx: vx,
          vy: vy,
          color: this.getGradientColor(random()),
          lifespan: random(50, 70),
        });
      }
    } else if (this.type === "2 Phasen") {
      for (let i = 0; i < this.num_particles; i++) {
        let theta = random(0, TWO_PI);
        let phi = random(0, PI * 0.75);
        let speed = random(2.2, 4.1);

        let vx = speed * sin(phi) * cos(theta);
        let vy = speed * sin(phi) * sin(theta);

        this.particles.push({
          vx: vx,
          vy: vy,
          color: this.getGradientColor(random()),
          lifespan: random(45, 60),
        });
      }
    } else if (this.type === "Herz") {
      for (let i = 0; i < this.num_particles; i++) {
        let t = map(i, 0, this.num_particles, 0, TWO_PI);

        let hx = 16 * pow(sin(t), 3);
        let hy = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t);

        let r = sqrt(hx * hx + hy * hy);

        let edge = constrain(map(r, 0, 17, 0, 1), 0, 1);
        let size = lerp(3.8, 1.6, edge);

        let dir = createVector(hx, -hy).normalize();

        let speed = lerp(2.2, 3.6, edge);

        let vx = dir.x * speed;
        let vy = dir.y * speed;

        this.particles.push({
          vx: vx,
          vy: vy,
          size: size,
          color: [255, random(80, 120), random(120, 180)],
          lifespan: random(55, 75),
        });
      }
    } else if (this.type === "Blume") {
      let petals = 8;
      for (let i = 0; i < this.num_particles; i++) {
        let petal = floor(random(petals));
        let angle = (petal / petals) * TWO_PI + random(-0.2, 0.2);
        let speed = random(2.5, 4);

        this.particles.push({
          vx: cos(angle) * speed,
          vy: sin(angle) * speed,
          color: this.getGradientColor(petal / petals),
          lifespan: random(45, 70),
        });
      }
    } else if (this.type === "Riesig") {
      for (let i = 0; i < this.num_particles; i++) {
        let theta = random(0, TWO_PI);
        let phi = random(0, PI);
        let speed = random(4, 7);

        this.particles.push({
          vx: speed * sin(phi) * cos(theta),
          vy: speed * sin(phi) * sin(theta),
          color: this.getGradientColor(random()),

          lifespan: random(45, 60),
        });
      }
    } else if (this.type === "Schnecke") {
      for (let i = 0; i < this.num_particles; i++) {
        let t = i / this.num_particles;
        let angle = t * TWO_PI * 3;
        let radius = 0.5 + t * 3.5;

        let vx = cos(angle) * radius;
        let vy = sin(angle) * radius;

        this.particles.push({
          vx: vx,
          vy: vy,
          rotation: random(0.03, 0.06),
          color: this.getGradientColor(t),
          lifespan: random(50, 70),
        });
      }
    } else if (this.type === "Ring") {
      for (let i = 0; i < this.num_particles; i++) {
        let a = random(TWO_PI);
        let tilt = 0.5;

        let vx = cos(a) * 3.5;
        let vy = sin(a) * 1.4 * tilt;

        this.particles.push({
          vx: vx,
          vy: vy,
          color: this.getGradientColor(random()),
          lifespan: random(50, 70),
        });
      }
    }
  }

  getGradientColor(t) {
    // Lineare Interpolation zwischen zwei Farben
    let c1 = this.color_scheme[0];
    let c2 = this.color_scheme[1];

    let r = int(c1[0] * (1 - t) + c2[0] * t);
    let g = int(c1[1] * (1 - t) + c2[1] * t);
    let b = int(c1[2] * (1 - t) + c2[2] * t);

    r = constrain(r + random(-15, 15), 50, 255);
    g = constrain(g + random(-15, 15), 50, 255);
    b = constrain(b + random(-15, 15), 50, 255);

    return [r, g, b];
  }

  update() {
    this.elapsed = frameCount - this.start_frame;
  }
  display() {
    const elapsed = this.elapsed;

    if (!this.exploded) {
      if (!this.launchInit) {
        this.launchInit = true;

        this.pos = createVector(this.launch_x, this.launch_y);
        this.vel = createVector(random(-1, 1), random(-10, -7));

        this.wind = random(-0.06, 0.06);
        this.wobbleStrength = random(0.15, 0.55);
        this.wobbleSpeed = random(0.25, 0.75);

        // Flugdauer
        let expectedFlightTime = abs((this.explode_y - this.launch_y) / this.vel.y) / 60;

        if (whistleSound) {
          this.whistleInstance = whistleSound.cloneNode();
          this.whistleInstance.volume = 0.5;

          this.whistleInstance.addEventListener("loadedmetadata", () => {
            let soundDuration = this.whistleInstance.duration;
            this.playbackRate = soundDuration / expectedFlightTime;
            this.whistleInstance.playbackRate = this.playbackRate;
          });

          this.whistleInstance.play().catch((e) => console.log("Whistle play failed:", e));
        }
      }

      let windForce = createVector(this.wind + sin(frameCount * 0.03) * 0.12, 0);
      let wobbleX = sin(frameCount * this.wobbleSpeed * 1.8) * this.wobbleStrength * 2.2;
      let wobbleY = cos(frameCount * this.wobbleSpeed * 2.4) * this.wobbleStrength * 0.6;

      let wobble = createVector(wobbleX, wobbleY);

      let thrust = createVector(0, -0.35);

      this.vel.add(thrust);
      this.vel.add(wobble);
      this.vel.add(windForce);

      this.pos.add(this.vel);

      // Explosionsstart
      if (this.pos.y <= this.explode_y && !this.exploded) {
        this.exploded = true;
        this.explode_x = this.pos.x;
        this.explode_y = this.pos.y;
        this.launch_duration = this.elapsed;

        if (this.whistleInstance) {
          this.whistleInstance.pause();
          this.whistleInstance.currentTime = 0;
        }

        if (explosionSound) {
          let boom = explosionSound.cloneNode();
          boom.volume = 0.6;
          boom.play().catch((e) => console.log("Explosion play failed:", e));
        }
      }

      stroke(255);
      strokeWeight(4);
      point(this.pos.x, this.pos.y);

      // Rauch
      for (let i = 0; i < 2; i++) {
        let p = new Particle(
          this.pos.x + random(-1, 1),
          this.pos.y + 3,
          random(-0.1, 0.1),
          random(0.4, 1.0),
          [200, 200, 200]
        );
        p.size = random(2.4, 3.2);
        p.lifespan = 70;
        p.expand = 0.04;
        p.fadeSpeed = 2.8;
        this.trailEmitter.addParticle(p);
      }

      this.trailEmitter.applyForce(createVector(0, -0.03));
      this.trailEmitter.run();

      return;
    }

    // Explosion
    if (elapsed < this.launch_duration + this.explosion_duration) {
      let explosion_time = elapsed - this.launch_duration;
      let gravity = 0.08;

      this.trailEmitter.applyForce(createVector(0, 0.04));
      this.trailEmitter.run();

      for (let particle of this.particles) {
        let t = explosion_time;
        if (t > particle.lifespan) continue;

        let px = this.explode_x + particle.vx * t * 1.25;
        let py = this.explode_y + particle.vy * t * 1.25 + 0.5 * gravity * t * t;

        let fade = 1 - t / particle.lifespan;
        if (fade <= 0) continue;

        let col = particle.color;

        noStroke();
        fill(col[0] * fade, col[1] * fade, col[2] * fade, 35);
        ellipse(px, py, 7.5);

        fill(col[0] * fade, col[1] * fade, col[2] * fade, 255);
        ellipse(px, py, 2.5);

        // Explosion Phase 2 — "2 Phasen"

        if (this.type === "2 Phasen") {
          let triggerT = particle.lifespan * 0.5; // bei 50% der Lebenszeit

          if (!particle.subExploded && t > triggerT) {
            particle.subExploded = true;

            particle.subParticles = []; // neue Sub-Explosion partikel

            let count = 4; // 4 neue Partikel pro Initialen
            for (let i = 0; i < count; i++) {
              let ang = random(TWO_PI);
              let spd = random(1.5, 3.2);

              particle.subParticles.push({
                vx: cos(ang) * spd,
                vy: sin(ang) * spd,
                lifespan: random(20, 35),
                age: 0,
                color: [col[0] + random(-40, 40), col[1] + random(-40, 40), col[2] + random(-40, 40)],
              });
            }

            particle.subOriginX = px;
            particle.subOriginY = py;
          }

          // Zeichnen der Sub-Explosion
          if (particle.subParticles) {
            for (let sp of particle.subParticles) {
              sp.age++;

              if (sp.age > sp.lifespan) continue;

              let spx = particle.subOriginX + sp.vx * sp.age;
              let spy = particle.subOriginY + sp.vy * sp.age + 0.5 * gravity * sp.age * sp.age;

              let f2 = 1 - sp.age / sp.lifespan;

              noStroke();
              fill(sp.color[0] * f2, sp.color[1] * f2, sp.color[2] * f2, 40);
              ellipse(spx, spy, 6);

              fill(sp.color[0] * f2, sp.color[1] * f2, sp.color[2] * f2, 255);
              ellipse(spx, spy, 2);
            }
          }
        }
      }
    }
  }

  isDead() {
    return this.elapsed > this.launch_duration + this.explosion_duration + 20;
  }
}
// Alle Partikel
class Particle {
  constructor(x, y, vx, vy, color) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.acc = createVector(0, 0);

    this.lifespan = 255;
    this.color = color;
    this.size = 3;
  }

  applyForce(f) {
    this.acc.add(f);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Rauch sinkt leicht
    this.vel.y += 0.015;
  }

  isDead() {
    return this.lifespan <= 0;
  }

  show() {
    this.size += this.expand || 0;

    let a = this.lifespan;
    stroke(this.color[0], this.color[1], this.color[2], a);
    strokeWeight(this.size);

    point(this.pos.x, this.pos.y);

    this.lifespan -= this.fadeSpeed || 2;
  }
}
//Rauch
class Smoke {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.particles = [];
  }

  addParticle(p) {
    this.particles.push(p);
  }

  applyForce(f) {
    for (let p of this.particles) {
      p.applyForce(f);
    }
  }

  run() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      p.show();
      if (p.isDead()) this.particles.splice(i, 1);
    }
  }

  isEmpty() {
    return this.particles.length === 0;
  }
}
