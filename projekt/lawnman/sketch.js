// GLOBALS
let video;
let videoStream;

// p5 buffer → Pixi (SYNC!)
let videoBuffer;

// Pixi
let pixiApp;
let videoTexture;
let personSprite;
let pixelFilter;
let maskGraphics;

// Segmentation
let segmentationData = null;
let maskWidth = 0;
let maskHeight = 0;

let frameGesture = "NONE"; // aktuelle Geste dieses Frames

// Phases
let phase = 0; // 0 = real, 1 = digital
let phaseStartTime = 0;

let ready = false;

let bgSprite;

let fft;
let angleMap = [];

const density = "Ñ@#W$9876543210?!abc;:+=-,._ ";
let dataRainColumns = [];
let rainStep = 14;

let dataRainLayer; // p5.Graphics
let dataRainTexture; // PIXI.Texture.from(dataRainLayer.canvas)

let outlineGraphics;

let lastExpr = {
  neutral: 0,
  happy: 0,
  angry: 0,
  sad: 0,
  disgusted: 0,
  surprised: 0,
  fearful: 0,
};

let circleAlpha = 0; // aktueller Sichtbarkeitswert
let circleTarget = 0; // Zielwert (0 oder 1)

let debugFont = null;
let debugFontReady = false;

// =====================================================
// HAND TRACKING (MediaPipe Hands)
// =====================================================
let hands;
let handResults = null;

// Start-Geste: 1 Finger (index) hoch
let digitalizationStarted = false;

// Debug Mode (alles zusammen!)
let debugMode = false;

// =====================================================
// FACE API (Expressions)
// =====================================================
let faceapi;
let detections = [];

let mood = "neutral"; // "neutral" | "bad"

// Oben global:
let song;
let musicStarted = false;

// In preload():
function preload() {
  song = loadSound("test.mp3");
}

// =====================================================
// SETUP
// =====================================================
async function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();

  // -------------------------------
  // CAMERA (DYNAMIC)
  // -------------------------------
  video = createCapture(
    {
      video: {
        facingMode: "user",
      },
      audio: false,
    },
    () => console.log("Camera ready"),
  );

  video.hide();

  //   warten bis echte Kamera-Auflösung da ist
  await new Promise((resolve) => (video.elt.onloadedmetadata = resolve));

  const camW = video.elt.videoWidth;
  const camH = video.elt.videoHeight;

  console.log("Camera native size:", camW, camH);

  //   EXTRA: warten bis wirklich Frames laufen
  await new Promise((resolve) => {
    const check = () => {
      if (video.elt.readyState >= 3 && video.elt.videoWidth > 0) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });

  //faceapie
  const faceOptions = {
    withLandmarks: true,
    withExpressions: true,
    withDescriptors: false,
    minConfidence: 0.3,
  };

  faceapi = ml5.faceApi(video.elt, faceOptions, () => {
    console.log("FaceAPI ready");
    faceapi.detect(gotFaces);
  });

  //mediapipe
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  hands.onResults((results) => {
    //   handlabels tauschen
    if (results.multiHandedness) {
      results.multiHandedness.forEach((h) => {
        h.label = h.label === "Left" ? "Right" : "Left";
      });
    }

    handResults = results;
  });

  //videostream
  videoStream = video.elt.srcObject;
  await new Promise((resolve) => (video.elt.onloadeddata = resolve));

  // degmentation
  const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });

  selfieSegmentation.setOptions({ modelSelection: 1 });

  selfieSegmentation.onResults((results) => {
    if (!results.segmentationMask) return;

    const mask = results.segmentationMask;
    maskWidth = mask.width;
    maskHeight = mask.height;

    const c = document.createElement("canvas");
    c.width = maskWidth;
    c.height = maskHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(mask, 0, 0);

    const img = ctx.getImageData(0, 0, maskWidth, maskHeight).data;
    segmentationData = new Uint8Array(maskWidth * maskHeight);

    for (let i = 0; i < segmentationData.length; i++) {
      segmentationData[i] = img[i * 4] > 0 ? 1 : 0;
    }
  });

  async function sendFrame() {
    if (video.elt.videoWidth > 0) {
      await selfieSegmentation.send({ image: video.elt });
      await hands.send({ image: video.elt });
    }
    requestAnimationFrame(sendFrame);
  }
  sendFrame();

  // pixi
  videoBuffer = createGraphics(camW, camH);
  videoBuffer.pixelDensity(1);

  pixiApp = new PIXI.Application({
    width: windowWidth,
    height: windowHeight,
    backgroundAlpha: 0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  pixiApp.view.style.position = "absolute";
  pixiApp.view.style.top = "0";
  pixiApp.view.style.left = "0";
  pixiApp.view.style.pointerEvents = "none";
  pixiApp.view.style.zIndex = "0";

  document.body.appendChild(pixiApp.view);

  const p5Canvas = document.querySelector("canvas");
  p5Canvas.style.position = "absolute";
  p5Canvas.style.top = "0";
  p5Canvas.style.left = "0";
  p5Canvas.style.zIndex = "1";

  videoTexture = PIXI.Texture.from(videoBuffer.canvas);

  // background
  bgSprite = new PIXI.Sprite(videoTexture);
  bgSprite.anchor.set(0, 0);
  let scaleCover = Math.max(windowWidth / camW, windowHeight / camH);

  // mirroring for bg
  bgSprite.scale.x = -scaleCover;
  bgSprite.scale.y = scaleCover;

  bgSprite.x = windowWidth;
  bgSprite.y = 0;

  pixiApp.stage.addChild(bgSprite);

  fft = new p5.FFT();
  fft.setInput(song);

  for (let i = 0; i < 180; i++) {
    let angle = random(0, 360);
    angleMap.push({ index: i, angle: angle });
  }
  angleMap.sort((a, b) => a.angle - b.angle);

  // person
  personSprite = new PIXI.Sprite(videoTexture);
  personSprite.anchor.set(0, 0);

  pixelFilter = new PIXI.filters.PixelateFilter(1);
  personSprite.filters = [pixelFilter];

  personSprite.scale.x = -scaleCover;
  personSprite.scale.y = scaleCover;

  personSprite.x = windowWidth;
  personSprite.y = 0;

  personSprite.alpha = 0;
  pixiApp.stage.addChild(personSprite);

  // mask
  maskGraphics = new PIXI.Graphics();
  personSprite.mask = maskGraphics;
  pixiApp.stage.addChild(maskGraphics);

  // outline
  outlineGraphics = new PIXI.Graphics();
  pixiApp.stage.addChild(outlineGraphics);

  // starting(everything is ready)
  phase = 0;
  phaseStartTime = millis();

  window._camW = camW;
  window._camH = camH;

  // datarain
  dataRainLayer = createGraphics(video.width, video.height);
  dataRainLayer.pixelDensity(1);
  dataRainLayer.clear();

  dataRainTexture = PIXI.Texture.from(dataRainLayer.canvas);

  dataRainSprite = new PIXI.Sprite(dataRainTexture);
  dataRainSprite.anchor.set(0, 0);

  const scaleCoverRain = Math.max(windowWidth / video.width, windowHeight / video.height);
  dataRainSprite.scale.x = -scaleCoverRain;
  dataRainSprite.scale.y = scaleCoverRain;
  dataRainSprite.x = windowWidth;
  dataRainSprite.y = 0;

  dataRainSprite.alpha = 1.0;

  pixiApp.stage.addChild(dataRainSprite);

  ready = true;
  console.log("READY");

  debugFont = loadFont("fonts/JetBrainsMono-Regular.ttf", () => {
    debugFontReady = true;
    console.log("DEBUG");
  });
}

// =====================================================
// DRAW
// =====================================================
function draw() {
  clear(0);

  // gesture
  if (handResults?.multiHandLandmarks?.length > 0) {
    frameGesture = getHandGestureType(handResults.multiHandLandmarks[0]);
  } else {
    frameGesture = "NONE";
  }

  if (debugMode) {
    drawEmotionDebugBox();
    drawHandsDebug(handResults);
  }
  if (!ready) return;

  if (!digitalizationStarted && frameGesture === "ONE_FINGER") {
    digitalizationStarted = true;
    phase = 0;
    phaseStartTime = millis();
  }

  // fade
  circleAlpha = lerp(circleAlpha, circleTarget, 0.06);

  if (circleAlpha < 0.01) circleAlpha = 0;

  // Pixi "übernimmt"
  if (phase === 1) {
    const t = (millis() - phaseStartTime) / 1000;
    const weight = constrain(t / 4.0, 0, 1);
    updateDataRain(weight);
  }

  videoBuffer.image(video, 0, 0, videoBuffer.width, videoBuffer.height);
  videoTexture.update();

  updatePhases();
  updateVideoEffects();
  updateMask();

  if (phase === 1) {
    checkFistMusicControl();
  }

  // outline
  if (phase === 1) {
    const t = (millis() - phaseStartTime) / 1000;
    const duration = 6.0;
    const p = constrain(t / duration, 0, 1);

    const eased = p * p * (3 - 2 * p);

    const outlineAlpha = constrain(map(eased, 0.5, 1.0, 0.0, 1.0), 0, 1);
    updateOutline(outlineAlpha);
  } else {
    updateOutline(0);
  }

  if (debugMode) {
    drawGestureDebug();
  }

  if (phase === 1) {
    drawMusicCircle();
  }
}

function updatePhases() {
  // wartet auf finger
  if (!digitalizationStarted) return;

  const elapsed = millis() - phaseStartTime;

  if (phase === 0 && elapsed > 2000) {
    phase = 1;
    phaseStartTime = millis();
  }
}

function updateDataRain(weight) {
  if (weight <= 0.01 || !video || !segmentationData || !dataRainLayer || maskWidth === 0 || maskHeight === 0) return;

  // init
  if (dataRainColumns.length === 0) {
    const cols = floor(video.width / rainStep);

    for (let i = 0; i < cols; i++) {
      dataRainColumns.push({
        x: i * rainStep,

        y: random(video.height * 0.2, video.height * 0.9),

        speed: random(1.0, 2.5),
        length: floor(random(25, 55)),
        index: floor(random(200)),
        chars: Array.from({ length: 200 }, () => density.charAt(floor(random(density.length)))),
      });
    }

    console.log("DataRain init:", dataRainColumns.length);
  }

  const gfx = dataRainLayer;
  gfx.clear();
  gfx.push();

  gfx.textSize(14);
  gfx.textAlign(CENTER, CENTER);
  gfx.noStroke();

  const sx = gfx.width / video.width;
  const sy = gfx.height / video.height;

  for (let col of dataRainColumns) {
    col.y += col.speed * (0.6 + weight);
    col.index = (col.index + 1) % col.chars.length;

    if (col.y > video.height + col.length * rainStep) {
      col.y = random(-400, 0);
      col.speed = random(1.0, 2.5);
      col.index = 0;
    }

    for (let i = 0; i < col.length * weight; i++) {
      const x = col.x;
      const y = col.y - i * rainStep;
      if (y < 0 || y >= video.height) continue;

      const mx = floor((x / video.width) * maskWidth);
      const my = floor((y / video.height) * maskHeight);
      if (segmentationData[mx + my * maskWidth] === 0) continue;

      const c = col.chars[(col.index + i) % col.chars.length];
      const a = map(i, 0, col.length, 240, 40) * weight;

      if (mood === "bad") {
        gfx.fill(255, 30, 60, a); // rot
      } else if (mood === "sad") {
        gfx.fill(20, 30, 120, a); // blau
      } else if (mood === "happy") {
        gfx.fill(255, 0, 180, a); // pink
      } else {
        gfx.fill(0, 255, 120, a); // grün
      }

      gfx.text(c, x * sx, y * sy);
    }
  }

  gfx.pop();
  dataRainTexture.update();
}

function checkFistMusicControl() {
  circleTarget = frameGesture === "FIST" ? 1 : 0;

  if (frameGesture === "FIST" && !musicStarted) {
    console.log("FAUSE - Musik startet");
    userStartAudio();
    song.loop();
    musicStarted = true;
  }

  if (frameGesture !== "FIST" && musicStarted) {
    console.log("OFFENE HAND - Musik hört auf");
    song.stop();
    musicStarted = false;
  }
}

function updateVideoEffects() {
  //phase 0
  if (phase === 0) {
    personSprite.alpha = 0;
    pixelFilter.size = 1;
    bgSprite.alpha = 1.0;
    dataRainSprite.alpha = 0;
    return;
  }
  //phase 1
  const t = (millis() - phaseStartTime) / 1000;
  const duration = 6.0;
  const p = constrain(t / duration, 0, 1);

  const eased = p * p * (3 - 2 * p);

  // verpixelung
  pixelFilter.size = lerp(1, 25, eased);

  if (eased < 0.75) {
    personSprite.alpha = 1.0;
  } else {
    personSprite.alpha = map(eased, 0.75, 1.0, 1.0, 0.0);
  }

  // datarain
  dataRainSprite.alpha = eased;

  //schwarzer hintergrund
  bgSprite.alpha = 1.0 - eased;
}

function updateOutline(alpha = 1.0) {
  if (!segmentationData || maskWidth === 0 || maskHeight === 0) return;

  outlineGraphics.clear();
  let outlineColor;

  if (mood === "bad") {
    outlineColor = 0xff0033; // rot
  } else if (mood === "sad") {
    outlineColor = 0x141e78; // blau
  } else if (mood === "happy") {
    outlineColor = 0xff00b4; // pink
  } else {
    outlineColor = 0x00ff88; // grün
  }

  outlineGraphics.lineStyle(3, outlineColor, alpha);

  const scaleCover = Math.max(windowWidth / window._camW, windowHeight / window._camH);
  const sx = scaleCover;
  const sy = scaleCover;

  const step = 2;

  for (let y = 1; y < maskHeight - 1; y += step) {
    for (let x = 1; x < maskWidth - 1; x += step) {
      const idx = x + y * maskWidth;

      // nur person verpixelt
      if (segmentationData[idx] !== 1) continue;

      const left = segmentationData[x - 1 + y * maskWidth];
      const right = segmentationData[x + 1 + y * maskWidth];
      const up = segmentationData[x + (y - 1) * maskWidth];
      const down = segmentationData[x + (y + 1) * maskWidth];

      // edge bei einem ausstehen
      if (left === 0 || right === 0 || up === 0 || down === 0) {
        const flippedX = windowWidth - (x + step) * sx;
        const drawY = y * sy;

        outlineGraphics.drawRect(flippedX, drawY, step * sx, step * sy);
      }
    }
  }
}

function gotFaces(error, result) {
  if (error) {
    console.log(error);
    faceapi.detect(gotFaces);
    return;
  }

  detections = result || [];

  mood = "neutral";
  moodValue = 0;

  if (detections.length > 0 && detections[0].expressions) {
    const expr = detections[0].expressions;

    // emotionen für debug
    lastExpr.neutral = expr.neutral || 0;
    lastExpr.happy = expr.happy || 0;
    lastExpr.angry = expr.angry || 0;
    lastExpr.sad = expr.sad || 0;
    lastExpr.disgusted = expr.disgusted || 0;
    lastExpr.surprised = expr.surprised || 0;
    lastExpr.fearful = expr.fearful || 0;

    const angryScore = lastExpr.angry;
    const sadScore = lastExpr.sad;
    const happyScore = lastExpr.happy;
    const fearfulScore = lastExpr.fearful;
    const disgustedScore = lastExpr.disgusted;
    const neutralScore = lastExpr.neutral;

    //   Mood Logik mit sad separat
    if (angryScore > 0.25) {
      mood = "bad";
      moodValue = angryScore;
    } else if (sadScore > 0.25) {
      mood = "sad";
      moodValue = sadScore;
    } else if (Math.max(fearfulScore, disgustedScore) > 0.25) {
      mood = "bad";
      moodValue = Math.max(fearfulScore, disgustedScore);
    } else if (happyScore > 0.6) {
      mood = "happy";
      moodValue = happyScore;
    } else {
      mood = "neutral";
      moodValue = neutralScore;
    }
  } else {
    // kein gesicht erkannt
    lastExpr.neutral = 0;
    lastExpr.happy = 0;
    lastExpr.angry = 0;
    lastExpr.sad = 0;
    lastExpr.disgusted = 0;
    lastExpr.surprised = 0;
    lastExpr.fearful = 0;
  }

  // loop
  faceapi.detect(gotFaces);
}

function drawHandsDebug(results) {
  if (!results || !results.multiHandLandmarks) return;

  push();
  ortho();
  resetMatrix();
  translate(-width / 2, -height / 2);

  const camW = window._camW;
  const camH = window._camH;

  const scaleCover = Math.max(windowWidth / camW, windowHeight / camH);

  const drawW = camW * scaleCover;
  const drawH = camH * scaleCover;

  const offsetX = windowWidth - drawW;
  const offsetY = 0;

  stroke(0, 200, 255);
  strokeWeight(2);
  noFill();

  const fingers = [
    [0, 1, 2, 3, 4], // daumen
    [0, 5, 6, 7, 8], // zeigefinger
    [0, 9, 10, 11, 12], // mittelfinger
    [0, 13, 14, 15, 16], // ringfinger
    [0, 17, 18, 19, 20], // kleiner Finger
  ];

  for (let h = 0; h < results.multiHandLandmarks.length; h++) {
    const hand = results.multiHandLandmarks[h];

    // landmarks
    noStroke();
    fill(0, 200, 255);

    for (let pt of hand) {
      let x = (1 - pt.x) * camW;
      let y = pt.y * camH;

      x = x * scaleCover + offsetX;
      y = y * scaleCover + offsetY;

      circle(x, y, 6);
    }

    stroke(0, 200, 255);
    strokeWeight(2);

    for (let finger of fingers) {
      for (let i = 0; i < finger.length - 1; i++) {
        const a = hand[finger[i]];
        const b = hand[finger[i + 1]];

        let ax = (1 - a.x) * camW;
        let ay = a.y * camH;
        let bx = (1 - b.x) * camW;
        let by = b.y * camH;

        ax = ax * scaleCover + offsetX;
        ay = ay * scaleCover + offsetY;
        bx = bx * scaleCover + offsetX;
        by = by * scaleCover + offsetY;

        line(ax, ay, bx, by);
      }
    }

    // label
    if (results.multiHandedness && results.multiHandedness[h]) {
      noStroke();
      fill(0, 200, 255);
      textSize(16);
      if (debugFontReady) textFont(debugFont);

      const wrist = hand[0];
      let lx = (1 - wrist.x) * camW * scaleCover + offsetX;
      let ly = wrist.y * camH * scaleCover + offsetY - 10;

      text(results.multiHandedness[h].label, lx, ly);
    }
  }

  pop();
}

function drawGestureDebug() {
  push();
  ortho();
  resetMatrix();
  translate(-width / 2, -height / 2);

  noStroke();
  fill(0, 200);
  rect(20, height - 80, 220, 40, 10);

  fill(0, 255, 180);
  textSize(18);
  textFont(debugFontReady ? debugFont : "monospace");
  textAlign(LEFT, CENTER);
  text("Geste: " + frameGesture, 30, height - 60);

  pop();
}

function updateMask() {
  if (!segmentationData || maskWidth === 0 || maskHeight === 0) return;

  maskGraphics.clear();
  maskGraphics.beginFill(0xffffff);

  const scaleCover = Math.max(windowWidth / window._camW, windowHeight / window._camH);
  const sx = scaleCover;
  const sy = scaleCover;
  const step = 3;

  for (let y = 0; y < maskHeight; y += step) {
    for (let x = 0; x < maskWidth; x += step) {
      if (segmentationData[x + y * maskWidth] === 1) {
        const flippedX = windowWidth - (x + step) * sx;
        const drawY = y * sy;

        maskGraphics.drawRect(flippedX, drawY, step * sx, step * sy);
      }
    }
  }

  maskGraphics.endFill();
}

function drawEmotionDebugBox() {
  push();
  ortho();
  resetMatrix();
  translate(-width / 2, -height / 2);

  if (debugFontReady) {
    textFont(debugFont);
  } else {
    textFont("monospace");
  }

  const x = 20;
  const y = 20;
  const w = 260;
  const h = 200;

  noStroke();
  fill(0, 200);
  rect(x, y, w, h, 10);

  fill(0, 255, 180);
  textSize(14);

  const line = 20;
  let ty = y + 25;

  text("neutral:   " + nf(lastExpr.neutral * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("happy:     " + nf(lastExpr.happy * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("angry:     " + nf(lastExpr.angry * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("sad:       " + nf(lastExpr.sad * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("disgusted: " + nf(lastExpr.disgusted * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("surprised: " + nf(lastExpr.surprised * 100, 2, 2) + "%", x + 15, ty);
  ty += line;
  text("fearful:   " + nf(lastExpr.fearful * 100, 2, 2) + "%", x + 15, ty);
  ty += line;

  fill(255);
  text("mood = " + mood, x + 15, y + h - 15);

  pop();
}

function getHandGestureType(hand) {
  if (!hand) return "NONE";

  const tips = {
    thumb: 4,
    index: 8,
    middle: 12,
    ring: 16,
    pinky: 20,
  };

  const pips = {
    index: 6,
    middle: 10,
    ring: 14,
    pinky: 18,
  };

  const indexUp = hand[tips.index].y < hand[pips.index].y;
  const middleUp = hand[tips.middle].y < hand[pips.middle].y;
  const ringUp = hand[tips.ring].y < hand[pips.ring].y;
  const pinkyUp = hand[tips.pinky].y < hand[pips.pinky].y;

  const extendedCount = (indexUp ? 1 : 0) + (middleUp ? 1 : 0) + (ringUp ? 1 : 0) + (pinkyUp ? 1 : 0);

  if (extendedCount === 0) {
    return "FIST";
  }

  if (indexUp && !middleUp && !ringUp && !pinkyUp) {
    return "ONE_FINGER";
  }

  if (extendedCount >= 3) {
    return "OPEN_HAND";
  }

  return "UNKNOWN";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  if (!pixiApp || !pixiApp.renderer || !bgSprite || !personSprite) return;

  pixiApp.renderer.resize(windowWidth, windowHeight);

  const camW = window._camW || 640;
  const camH = window._camH || 480;

  let scaleCover = Math.max(windowWidth / camW, windowHeight / camH);

  bgSprite.scale.x = -scaleCover;
  bgSprite.scale.y = scaleCover;
  bgSprite.x = windowWidth;
  bgSprite.y = 0;

  personSprite.scale.x = -scaleCover;
  personSprite.scale.y = scaleCover;
  personSprite.x = windowWidth;
  personSprite.y = 0;
}

function drawMusicCircle() {
  if (!musicStarted || circleAlpha <= 0) return;

  push();
  ortho();
  resetMatrix();
  translate(-width / 2, -height / 2);

  translate(width * 0.82, height * 0.18);

  colorMode(HSB, 360, 100, 100, 100);
  angleMode(DEGREES);
  noFill();
  strokeWeight(3);

  let spectrum = fft.analyze();

  let hueBase = 120; // neutral = grün

  if (mood === "bad")
    hueBase = 0; // rot
  else if (mood === "sad")
    hueBase = 220; // blau
  else if (mood === "happy") hueBase = 310; // pink

  for (let i = 0; i < angleMap.length; i++) {
    let current = angleMap[i];
    let next = angleMap[(i + 1) % angleMap.length];

    let e1 = spectrum[current.index] || 0;
    let e2 = spectrum[next.index] || 0;

    let r1 = map(e1, 0, 255, 60, 190);
    let r2 = map(e2, 0, 255, 60, 190);

    let t1 = constrain(map(r1, 60, 190, 0, 1), 0, 1);
    let t2 = constrain(map(r2, 60, 190, 0, 1), 0, 1);

    t1 = pow(t1, 0.45);
    t2 = pow(t2, 0.45);

    let sat = lerp(10, 100, (t1 + t2) * 0.5);

    stroke(hueBase, sat, 100, 100 * circleAlpha);

    let x1 = r1 * cos(current.angle);
    let y1 = r1 * sin(current.angle);
    let x2 = r2 * cos(next.angle);
    let y2 = r2 * sin(next.angle);

    line(x1, y1, x2, y2);
  }

  pop();
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }
}

function keyPressed() {
  if (key === "d" || key === "D") {
    debugMode = !debugMode;
    console.log("DEBUG MODE:", debugMode);
  }
}

window.addEventListener("beforeunload", stopCamera);
