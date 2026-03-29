let fishes = [];
let predators = [];
let bgImg;
let obstacles = [];
let explosions = [];
let foods = [];
let ambientAudio;
let ambientStarted = false;
let fishImages = [];
let sharkImages = [];
const FISH_COUNT = 80;
const PREDATOR_COUNT = 3;
let LAST_FOOD_SPAWN = 0;
const MAX_FOOD = 60;
const FOOD_SPAWN_INTERVAL = 120;
let SHOW_BB = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Ambient sound via HTML Audio
  ambientAudio = new Audio("STREAMING-underwater-river-rapids-in-winter-ivo-vicic-1-03-01.mp3");
  ambientAudio.loop = true;
  ambientAudio.volume = 0.6;

  loadImage("pictures/unterwasser-foto-von-einem-pool_1219-17.jpg", (img) => {
    bgImg = img;
  });

  loadImage("pictures/blue.png", (img) => {
    fishImages[0] = img;
  });

  loadImage("pictures/green.png", (img) => {
    fishImages[1] = img;
  });

  loadImage("pictures/orange_small.png", (img) => {
    fishImages[2] = img;
  });

  loadImage("pictures/yellow.png", (img) => {
    fishImages[3] = img;
  });

  loadImage("pictures/hai.png", (img) => {
    sharkImages[1] = img;
  });

  loadImage("pictures/hai2.png", (img) => {
    sharkImages[2] = img;
  });

  loadImage("pictures/hai3.png", (img) => {
    sharkImages[3] = img;
  });

  loadImage("pictures/hai4.png", (img) => {
    sharkImages[4] = img;
  });

  loadImage("pictures/hai5.png", (img) => {
    sharkImages[5] = img;
  });

  // sharks
  predators = [];
  for (let i = 0; i < PREDATOR_COUNT; i++) {
    let s = spawnAtEdge();
    let p = new Predator(s.pos.x, s.pos.y);
    p.velocity = s.dir.mult(p.maxspeed);
    predators.push(p);
  }

  // fishes
  fishes = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    let s = spawnAtEdge();
    let f = new Fish(s.pos.x, s.pos.y);
    f.velocity = s.dir.mult(f.maxspeed);
    fishes.push(f);
  }

  // obstacles
  obstacles = [];
  let attempts = 0;

  while (obstacles.length < 8 && attempts < 100) {
    let x = random(100, width - 100);
    let y = random(100, height - 100);
    let radius = random(20, 60);

    let ok = true;
    for (let obs of obstacles) {
      if (dist(x, y, obs.position.x, obs.position.y) < 150) {
        ok = false;
        break;
      }
    }

    if (ok) obstacles.push(new Obstacle(x, y, radius));
    attempts++;
  }

  // initial food
  foods = [];
  for (let i = 0; i < 20; i++) {
    spawnFood();
  }
}

function mousePressed() {
  startAmbientAudio();
}

// start audio
function startAmbientAudio() {
  if (!ambientAudio || ambientStarted) return;
  ambientAudio
    .play()
    .then(() => {
      ambientStarted = true;
    })
    .catch(() => {});
}

function draw() {
  if (bgImg) {
    let waveX = sin(frameCount * 0.02) * 5;
    let waveY = cos(frameCount * 0.015) * 3;
    tint(255, 170 + sin(frameCount * 0.03) * 15);
    image(bgImg, waveX - 5, waveY - 5, width + 10, height + 10);
    noTint();
  } else {
    background(5, 30, 50);
  }

  for (let obs of obstacles) obs.show();
  // spawn food over time
  if (frameCount - LAST_FOOD_SPAWN > FOOD_SPAWN_INTERVAL && foods.length < MAX_FOOD) {
    spawnFood();
  }

  // update & draw food
  for (let i = foods.length - 1; i >= 0; i--) {
    const fd = foods[i];
    fd.update();
    fd.show();
    if (fd.isGone()) foods.splice(i, 1);
  }
  for (let p of predators) {
    let avoid = p.avoidObstacles(obstacles);

    // avoiding obstacles before hunt
    if (avoid.mag() > 0.01) {
      p.applyForce(avoid.mult(2.5));
    } else {
      let target = p.getTarget(p);
      if (target) p.pursue(target);
    }

    p.update();
    p.borders();
  }

  // organising fishes
  for (let i = fishes.length - 1; i >= 0; i--) {
    let f = fishes[i];

    let fleeForce = createVector(0, 0);
    for (let p of predators) {
      fleeForce.add(f.flee(p));
    }
    f.applyForce(fleeForce);
    f.applyForce(f.avoidObstacles(obstacles));

    // all fish are attracted to nearby food
    const targetFood = getNearestFood(f, 160);
    if (targetFood) {
      f.applyForce(f.seek(targetFood.position).mult(1.1));
    }

    f.flock(fishes);
    f.update();
    f.borders();
    f.show();

    // fish is eatem
    let eaten = false;
    for (let p of predators) {
      let d = p5.Vector.dist(f.position, p.position);
      if (d < p.getBoundingRadius() + f.getBoundingRadius()) {
        eaten = true;
        p.eatFish();
        break;
      }
    }

    // food consumption
    if (!eaten) {
      const nearestFd = getNearestFood(f, f.getBoundingRadius() + 14);
      if (nearestFd) {
        // eat food -> brief boost
        nearestFd.consumed = true;
        f.maxspeed = min(f.maxspeed + 0.18, f.baseMaxSpeed + 1.2);
      } else {
        // decay boost slowly
        if (f.maxspeed > f.baseMaxSpeed) {
          f.maxspeed = max(f.maxspeed - 0.002, f.baseMaxSpeed);
        }
      }
    }

    if (eaten) {
      fishes.splice(i, 1);
    }
  }

  // spawn fishes if too few
  while (fishes.length < FISH_COUNT) {
    let s = spawnAtEdge();
    let nf = new Fish(s.pos.x, s.pos.y);
    nf.velocity = s.dir.mult(nf.maxspeed);
    fishes.push(nf);
  }

  for (let i = predators.length - 1; i >= 0; i--) {
    let p = predators[i];

    for (let j = predators.length - 1; j >= 0; j--) {
      if (i === j) continue;
      let other = predators[j];

      if (p.level > other.level) {
        let d = p5.Vector.dist(p.position, other.position);
        if (d < p.getBoundingRadius() + other.getBoundingRadius()) {
          other.dead = true;
          p.eatPredator();
          break;
        }
      }
    }
  }

  // sharks replacement
  for (let i = predators.length - 1; i >= 0; i--) {
    if (predators[i].dead) {
      predators.splice(i, 1);
      let s = spawnAtEdge();
      let np = new Predator(s.pos.x, s.pos.y);
      np.velocity = s.dir.mult(np.maxspeed);
      predators.push(np);
    }
  }

  for (let p of predators) p.show();

  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update();
    explosions[i].show();

    if (explosions[i].isDead()) {
      explosions.splice(i, 1);
    }
  }
}

function spawnAtEdge(margin = 10) {
  let x, y;
  let edge = floor(random(4));

  if (edge === 0) {
    x = random(width);
    y = -margin;
  } else if (edge === 1) {
    x = width + margin;
    y = random(height);
  } else if (edge === 2) {
    x = random(width);
    y = height + margin;
  } else {
    x = -margin;
    y = random(height);
  }

  let pos = createVector(x, y);
  let center = createVector(width / 2, height / 2);
  let dir = p5.Vector.sub(center, pos).normalize();

  return { pos, dir };
}

function spawnFood() {
  let x = random(40, width - 40);
  let y = random(40, height - 40);
  // avoid spawning too close to obstacles
  for (let k = 0; k < 10; k++) {
    let bad = false;
    for (let obs of obstacles) {
      const safety = obs.radius + 20;
      if (dist(x, y, obs.position.x, obs.position.y) < safety) {
        bad = true;
        break;
      }
    }
    if (!bad) break;
    x = random(40, width - 40);
    y = random(40, height - 40);
  }
  foods.push(new Food(x, y));
  LAST_FOOD_SPAWN = frameCount;
}

function getNearestFood(fish, range = 9999) {
  let best = null;
  let minD = range;
  for (let fd of foods) {
    const d = p5.Vector.dist(fish.position, fd.position);
    if (d < minD) {
      minD = d;
      best = fd;
    }
  }
  return best;
}

function getNearestFish(predator) {
  let minD = Infinity;
  let nearest = null;

  for (let f of fishes) {
    let d = p5.Vector.dist(f.position, predator.position);
    if (d < minD) {
      minD = d;
      nearest = f;
    }
  }
  return nearest;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff < -PI) diff += TWO_PI;
  while (diff > PI) diff -= TWO_PI;
  return a + diff * t;
}

class Fish {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.acceleration = createVector(0, 0);
    this.maxspeed = 2;
    this.maxforce = 0.08;
    this.size = 8;
    this.type = floor(random(4));
    this.baseMaxSpeed = this.maxspeed;
  }

  getBoundingRadius() {
    return this.size * 1.2;
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired.setMag(this.maxspeed);

    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxforce);

    return steer;
  }

  flock(fishes) {
    let sep = this.separate(fishes).mult(1.5);
    let ali = this.align(fishes).mult(1.0);
    let coh = this.cohesion(fishes).mult(1.0);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  borders() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.y > height) this.position.y = 0;
  }

  separate(fishes) {
    let desiredSeparation = 20;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of fishes) {
      if (other.type !== this.type) continue;
      let d = p5.Vector.dist(this.position, other.position);

      if (this !== other && d < desiredSeparation) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.normalize();
        diff.div(max(d, 8));

        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count);
    }

    if (steer.mag() > 0) {
      steer.setMag(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce);
    }

    return steer;
  }

  align(fishes) {
    let neighborDist = 50;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of fishes) {
      if (other.type !== this.type) continue;
      let d = p5.Vector.dist(this.position, other.position);
      if (this !== other && d < neighborDist) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxspeed);

      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxforce);
      return steer;
    }

    return createVector(0, 0);
  }

  cohesion(fishes) {
    let neighborDist = 50;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of fishes) {
      if (other.type !== this.type) continue;
      let d = p5.Vector.dist(this.position, other.position);
      if (this !== other && d < neighborDist) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return this.seek(sum);
    }

    return createVector(0, 0);
  }

  flee(predator) {
    let d = p5.Vector.dist(this.position, predator.position);
    let range = 120;

    if (d < range) {
      let desired = p5.Vector.sub(this.position, predator.position);
      desired.setMag(this.maxspeed * 2.5);
      let steer = p5.Vector.sub(desired, this.velocity);
      steer.limit(this.maxforce * 2);
      return steer;
    }
    return createVector(0, 0);
  }

  avoidObstacles(obstacles) {
    let steer = createVector(0, 0);

    // view range
    const lookAhead = this.size * 4;

    for (let obs of obstacles) {
      let d = p5.Vector.dist(this.position, obs.position);

      let safeDist = obs.radius + this.size + lookAhead;

      if (d < safeDist) {
        let away = p5.Vector.sub(this.position, obs.position);
        away.normalize();

        // faster if closer
        let strength = map(d, obs.radius + this.size, safeDist, 2.5, 0);
        away.mult(strength);

        steer.add(away);
      }
    }

    if (steer.mag() > 0) {
      steer.setMag(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce * 2);
    }

    return steer;
  }

  show() {
    let img = fishImages[this.type];
    if (!img) return;

    push();
    translate(this.position.x, this.position.y);
    rotate(this.velocity.heading());
    imageMode(CENTER);

    let s = this.size * 3;
    image(img, 0, 0, s * 2, s);

    pop();
  }
}

class Food {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D().mult(random(0.03, 0.12));
    this.size = random(4, 7);
    this.life = 255;
    this.consumed = false;
  }

  update() {
    this.position.add(this.velocity);
    // gentle drift and wrap
    if (this.position.x < 0) this.position.x = width;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.y > height) this.position.y = 0;

    // avoid obstacles
    let avoid = createVector(0, 0);
    for (let obs of obstacles) {
      const d = p5.Vector.dist(this.position, obs.position);
      const minDist = obs.radius + this.size * 0.6;
      if (d < minDist + 8) {
        let away = p5.Vector.sub(this.position, obs.position);
        away.normalize();
        away.mult(map(d, minDist, minDist + 8, 2, 0));
        avoid.add(away);
      }
    }
    if (avoid.mag() > 0) {
      this.position.add(avoid);
    }

    // fade when consumed
    if (this.consumed) {
      this.life -= 20;
    } else {
      // slight bobbing
      this.position.y += sin(frameCount * 0.02 + this.position.x * 0.01) * 0.05;
    }
  }

  show() {
    push();
    translate(this.position.x, this.position.y);
    noStroke();
    fill(230, 210, 60, this.life);
    ellipse(0, 0, this.size, this.size);
    fill(255, 255, 255, this.life * 0.7);
    ellipse(-this.size * 0.15, -this.size * 0.15, this.size * 0.35, this.size * 0.35);
    pop();
  }

  isGone() {
    return this.life <= 0;
  }
}

class Predator {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.acceleration = createVector(0, 0);
    this.level = 1;
    this.normalEaten = 0;
    this.dead = false;
    this.baseSize = 18;
    this.baseSpeed = 3;
    this.updateStats();
  }

  updateStats() {
    this.size = this.baseSize + this.level * 4;
    this.maxspeed = this.baseSpeed + this.level * 0.3;
    this.maxforce = 0.15;
  }

  eatFish() {
    this.normalEaten++;
    if (this.normalEaten >= 10) {
      this.normalEaten = 0;
      this.levelUp();
    }
  }

  eatPredator() {
    this.levelUp();
  }

  levelUp() {
    this.level++;

    if (this.level >= 6) {
      for (let i = 0; i < 25; i++) {
        explosions.push(new ExplosionParticle(this.position.x, this.position.y));
      }

      this.dead = true;
    } else {
      this.updateStats();
    }
  }

  getBoundingRadius() {
    return this.size * 0.9;
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  borders() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.y > height) this.position.y = 0;
  }

  getTarget(self) {
    let best = null;
    let minD = Infinity;

    // hunt smaller sharks
    for (let p of predators) {
      if (p !== self && p.level < self.level) {
        let d = p5.Vector.dist(self.position, p.position);
        if (d < minD) {
          minD = d;
          best = p;
        }
      }
    }

    if (best) return best;

    // otherwise fish
    return getNearestFish(self);
  }

  avoidObstacles(obstacles) {
    let steer = createVector(0, 0);

    for (let obs of obstacles) {
      let d = p5.Vector.dist(this.position, obs.position);
      let safe = obs.radius + this.size + 10;

      if (d < safe) {
        let away = p5.Vector.sub(this.position, obs.position);
        away.setMag(this.maxspeed);
        steer.add(away);
      }
    }

    steer.limit(this.maxforce * 2);
    return steer;
  }
  pursue(target) {
    let desired = p5.Vector.sub(target.position, this.position);
    desired.setMag(this.maxspeed * 1.1);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer.limit(this.maxforce * 1.5);
    this.applyForce(steer);
  }

  show() {
    let lvl = constrain(this.level, 1, 5);
    let img = sharkImages[lvl];

    if (!img) return;

    push();
    translate(this.position.x, this.position.y);

    this.angle = lerpAngle(this.angle || this.velocity.heading(), this.velocity.heading(), 0.15);
    rotate(this.angle);

    imageMode(CENTER);

    let s = this.size * 1.5;
    image(img, 0, 0, s * 2.2, s * 1.2);

    pop();
  }
}

class Obstacle {
  constructor(x, y, radius) {
    this.position = createVector(x, y);
    this.radius = radius;
    this.rockType = floor(random(3));
    this.rotation = random(TWO_PI);
    this.details = [];

    for (let i = 0; i < floor(random(5, 10)); i++) {
      this.details.push({
        angle: random(TWO_PI),
        dist: random(0.3, 0.9),
        size: random(3, 8),
      });
    }

    this.vertices = [];
    let vertexCount = 8 + this.rockType * 2;
    for (let i = 0; i < vertexCount; i++) {
      let angle = map(i, 0, vertexCount, 0, TWO_PI);
      let r = this.radius * random(0.8, 1.1);
      this.vertices.push({
        x: cos(angle) * r,
        y: sin(angle) * r,
      });
    }

    this.pebbles = [];
    for (let i = 0; i < 3; i++) {
      let angle = random(TWO_PI);
      let r = this.radius * random(0.6, 0.8);
      this.pebbles.push({
        x: cos(angle) * r,
        y: sin(angle) * r,
      });
    }
  }

  show() {
    push();
    translate(this.position.x, this.position.y);
    rotate(this.rotation);

    noStroke();
    fill(60, 60, 70);
    this.drawRockShape();

    fill(80, 85, 95);
    push();
    translate(-this.radius * 0.2, -this.radius * 0.2);
    scale(0.6);
    this.drawRockShape();
    pop();

    fill(40, 40, 50, 150);
    push();
    translate(this.radius * 0.15, this.radius * 0.15);
    scale(0.5);
    this.drawRockShape();
    pop();

    fill(20, 80, 60, 120);
    for (let detail of this.details) {
      let x = cos(detail.angle) * this.radius * detail.dist;
      let y = sin(detail.angle) * this.radius * detail.dist;
      ellipse(x, y, detail.size, detail.size);
    }

    fill(70, 70, 80);
    for (let pebble of this.pebbles) {
      ellipse(pebble.x, pebble.y, 3, 3);
    }

    pop();

    if (SHOW_BB) {
      push();
      translate(this.position.x, this.position.y);
      noFill();
      stroke(0, 255, 0, 150);
      strokeWeight(2);
      ellipse(0, 0, this.radius * 2, this.radius * 2);
      pop();
    }
  }

  drawRockShape() {
    beginShape();
    for (let v of this.vertices) {
      vertex(v.x, v.y);
    }
    endShape(CLOSE);
  }
}

class ExplosionParticle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(3, 8));
    this.life = 255;
    this.size = random(6, 14);
  }

  update() {
    this.pos.add(this.vel);
    this.vel.mult(0.92);
    this.life -= 8;
  }

  show() {
    noStroke();
    fill(random(220, 255), random(80, 120), random(80, 120), this.life);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.life <= 0;
  }
}
