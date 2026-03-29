let leaves = [];
let drops = [];
let windParticles = [];
let zoff = 0;
let wind = 0.01;
let windOffset = 0;

function setup() {
  createCanvas(window.innerWidth - 200, window.innerHeight - 200);
  noStroke();
  for (let i = 0; i < 5; i++) leaves.push(new Leaf());
  for (let i = 0; i < 300; i++) windParticles.push(new WindParticle());

  let zoomFactor = min(window.innerWidth / width, window.innerHeight / height);
  let cnv = document.querySelector("canvas");
  cnv.style.width = width * zoomFactor + "px";
  cnv.style.height = height * zoomFactor + "px";
}

function draw() {
  background(180, 220, 255, 80);

  // Flowfield bewegt sich auch leicht in der Zeit, sonst gleiche Strömungen
  zoff += 0.1;

  // Adding Objects
  if (random(1) < 0.1) leaves.push(new Leaf());
  if (random(1) < 0.3) drops.push(new Drop());

  // Updating
  for (let i = leaves.length - 1; i >= 0; i--) {
    let leaf = leaves[i];
    leaf.update(wind);
    leaf.show();
    if (leaf.finished()) leaves.splice(i, 1);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    let drop = drops[i];
    drop.update(wind);
    drop.show();
    if (drop.finished()) drops.splice(i, 1);
  }

  for (let i = 0; i < windParticles.length; i++) {
    let p = windParticles[i];
    p.followFlow();
    p.update();
    p.show();
  }

  // Anzeige
  fill(0);
  noStroke();
  textSize(14);
  text(`Wind: ${nf(wind, 1, 2)}`, 20, 20);
}

// Bewegung an jeder Stelle auf Canvas
// zoff sonst strom
// scale mischung aus chaos und einheitlich
function flowAt(x, y) {
  let scale = 0.01;
  let angle = noise(x * scale, y * scale, zoff) * TWO_PI * 2; // Dadurch entsteht flow
  return createVector(cos(angle), sin(angle));
}

function keyPressed() {
  if (key === "a") wind -= 0.1;
  if (key === "d") wind += 0.1;
  if (key === " ") wind = 0;
}

class WindParticle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.alpha = random(100, 200);
  }

  followFlow() {
    let flow = flowAt(this.pos.x, this.pos.y);
    this.vel.add(flow.mult(0.2));
  }

  update() {
    this.pos.add(this.vel);
    this.vel.limit(2);
    if (this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height) {
      this.pos = createVector(random(width), random(height));
      this.vel.mult(0);
    }
  }

  show() {
    stroke(255, this.alpha);
    strokeWeight(3);
    point(this.pos.x, this.pos.y);
  }
}

class Leaf {
  constructor() {
    this.x = random(width);
    this.y = random(-200, 0);
    this.movement_side = random(-0.5, 0.5);
    this.movement_down = random(1, 2);
    this.gravity = 0.01;
    this.start_angle = random(TWO_PI);
    this.rotationSpeed = random(-0.02, 0.02);
    this.alpha = 255;
    this.size = random(0.5, 1);
    let r = random(180, 255);
    let g = random(80, 180);
    let b = random(0, 60);
    this.color = color(r, g, b, this.alpha);
  }

  update(wind) {
    let flow = flowAt(this.x, this.y);

    this.movement_side += (flow.x * 0.05 + wind * 0.02);
    this.movement_side = constrain(this.movement_side, -1.5, 1.5);
    this.x += this.movement_side;

    this.movement_down += this.gravity;
    this.y += this.movement_down;
    this.start_angle += this.rotationSpeed + wind * 0.005;
  }

  show() {
    push();
    translate(this.x, this.y);
    rotate(this.start_angle);
    scale(this.size);
    fill(this.color);
    stroke(80, this.alpha);
    strokeWeight(2);
    bezier(0, 0, 20, -30, 40, 30, 0, 60);
    bezier(0, 0, -20, -30, -40, 30, 0, 60);
    pop();
  }

  finished() {
    return this.y > height + 60;
  }
}

class Drop {
  constructor() {
    this.x = random(width);
    this.y = random(-50, 0);
    this.vx = 0;
    this.vy = random(5, 8);
    this.alpha = random(150, 255);
    this.len = random(2, 5);
  }

  update(wind) {
    let flow = flowAt(this.x, this.y);
    this.vx += flow.x * 0.1 + wind * 0.1;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 2.5;
  }

  finished() {
    return this.alpha <= 0 || this.y > height;
  }

  show() {
    stroke(0, 100, 255, this.alpha);
    strokeWeight(2);
    line(this.x, this.y, this.x, this.y + this.len);
  }
}
