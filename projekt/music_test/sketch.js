let song;
let fft;
let angleMap = [];
let started = false;

function preload() {
  song = loadSound("test.mp3");
}

function setup() {
  createCanvas(600, 600);
  colorMode(HSB, 360, 100, 100);
  angleMode(DEGREES);

  fft = new p5.FFT();

  for (let i = 0; i < 180; i++) {
    let angle = random(0, 360);
    angleMap.push({ index: i, angle: angle });
  }

  angleMap.sort((a, b) => a.angle - b.angle);
}

function mousePressed() {
  if (!started) {
    userStartAudio(); // wichtig für Browser
    song.loop(); // oder song.play()
    started = true;
  }
}

function draw() {
  background(0);
  translate(width / 2, height / 2);

  if (!started) {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(20);
    text("Click to start music", 0, 0);
    return;
  }

  let spectrum = fft.analyze();

  strokeWeight(2);
  noFill();

  for (let i = 0; i < angleMap.length; i++) {
    let current = angleMap[i];
    let next = angleMap[(i + 1) % angleMap.length];

    let energyCurrent = spectrum[current.index] || 0;
    let energyNext = spectrum[next.index] || 0;

    let r1 = map(energyCurrent, 0, 255, 100, 300);
    let r2 = map(energyNext, 0, 255, 100, 300);

    let hue1 = map(r1, 100, 300, 0, 240);
    let hue2 = map(r2, 100, 300, 0, 240);

    let x1 = r1 * cos(current.angle);
    let y1 = r1 * sin(current.angle);
    let x2 = r2 * cos(next.angle);
    let y2 = r2 * sin(next.angle);

    let avgHue = (hue1 + hue2) / 2;

    stroke(avgHue, 100, 100);
    line(x1, y1, x2, y2);
  }
}
