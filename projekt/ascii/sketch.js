let t = 0;

let modes = {
  ASCII: 0,
  NEON_OUTLINE: 1,
  DATA_RAIN: 2,
};

let debugScene = 1;
let introDuration = 4.0; // Sekunden

const COLORS = {
  bg: "#050008",
  cyan: "#00F5FF",
  magenta: "#FF2FD0",
};

let colorPhase = 0;
let nextColorSwitch = 0;

const SW = {
  cyan: [0, 245, 255], // Neon Cyan (Akzent hell)
  magenta: [255, 47, 208], // Hot Pink (Akzent mittel)
  violet: [160, 90, 255], // Synth-Violett (Grundkörper)
};
// =====================================================
// SCENE STATE (only 2 scenes during transition)
// =====================================================
let currentScene = modes.ASCII;
let nextScene = modes.ASCII;

let isTransitioning = false;
let transitionStart = 0;
let transitionDuration = 1.2; // Sekunden (Fade-Speed)

let sceneHoldMin = 2.0; // wie lange min pro Szene
let sceneHoldMax = 4.5; // wie lange max pro Szene
let nextSceneSwitchTime = 0;

let dataRainLayer;
let dataRainTexture;
let dataRainSprite;
let dataRainFilter;

const density = "Ñ@#W$9876543210?!abc;:+=-,._ ";

let dataRainColumns = [];
const rainStep = 1;

let debugFont;
let debugMode = false;

let video;
let videoStream = null;

let segmentation;
let maskWidth = 0;
let maskHeight = 0;

let selfieSegmentation;

let pixiApp;
let neonLayerGfx; // p5.Graphics offscreen
let neonSprite; // PIXI Sprite
let neonTexture;
let glowFilter;

// =====================================================
// HELPERS
// =====================================================
function applyMirror2D() {
  ortho();
  resetMatrix();
  noLights();

  translate(-width / 2, -height / 2);

  // Spiegeln auf Canvas-Ebene
  translate(width, 0);
  scale(-1, 1);
}

function safeTextFont() {
  if (debugFont) {
    textFont(debugFont);
  }
}

function pickRandomNextScene(current) {
  const options = [modes.ASCII, modes.NEON_OUTLINE, modes.DATA_RAIN];
  const filtered = options.filter((m) => m !== current);
  return random(filtered);
}

function startTransition() {
  nextScene = pickRandomNextScene(currentScene);
  isTransitioning = true;
  transitionStart = t;

  // nächster Wechsel wird erst nach Abschluss + Hold gesetzt
  nextSceneSwitchTime = Infinity;
}

function finishTransition() {
  currentScene = nextScene;
  isTransitioning = false;

  // neuen Zeitpunkt für den nächsten Switch festlegen
  nextSceneSwitchTime = t + random(sceneHoldMin, sceneHoldMax);
}

// =====================================================
// SETUP
// =====================================================
async function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noFill();
  strokeWeight(1);

  try {
    console.log("Lade Font: fonts/JetBrainsMono-Regular.ttf");
    debugFont = await loadFont("fonts/JetBrainsMono-Regular.ttf");
    console.log("Font geladen:", debugFont);
  } catch (err) {
    console.error("Font konnte nicht geladen werden:", err);
    debugFont = null;
  }

  // =====================================================
  // KAMERA
  // =====================================================
  video = createCapture(
    {
      video: {
        width: 160,
        height: 120,
      },
      audio: false,
    },
    () => {
      console.log("Kamera initialisiert");
    },
  );

  video.hide();
  videoStream = video.elt.srcObject;

  console.log("Video element:", video.elt);
  video.size(160, 120);

  await new Promise((resolve) => {
    video.elt.onloadeddata = () => {
      console.log("Video loadeddata");
      resolve();
    };
  });

  // =====================================================
  // MEDIAPIPE SELFIE SEGMENTATION
  // =====================================================
  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });

  selfieSegmentation.setOptions({
    modelSelection: 1,
  });

  selfieSegmentation.onResults((results) => {
    const maskBitmap = results.segmentationMask;
    if (!maskBitmap) return;

    maskWidth = maskBitmap.width;
    maskHeight = maskBitmap.height;

    const offscreen = document.createElement("canvas");
    offscreen.width = maskWidth;
    offscreen.height = maskHeight;

    const ctx = offscreen.getContext("2d");
    ctx.drawImage(maskBitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, maskWidth, maskHeight).data;

    const mask = new Uint8Array(maskWidth * maskHeight);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = imageData[i * 4] > 0 ? 1 : 0;
    }

    segmentation = { data: mask };
  });

  async function sendFrame() {
    if (video.elt.videoWidth > 0 && video.elt.videoHeight > 0) {
      await selfieSegmentation.send({ image: video.elt });
    }
    requestAnimationFrame(sendFrame);
  }

  sendFrame();

  // =====================================================
  // PIXI OVERLAY (Glow)
  // =====================================================
  pixiApp = new PIXI.Application({
    width: windowWidth,
    height: windowHeight,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Pixi Canvas oben auf p5 Canvas legen
  pixiApp.view.style.position = "absolute";
  pixiApp.view.style.top = "0px";
  pixiApp.view.style.left = "0px";
  pixiApp.view.style.pointerEvents = "none";
  document.body.appendChild(pixiApp.view);

  // =====================================================
  // NEON OUTLINE LAYER (p5 offscreen -> Pixi Sprite + Glow)
  // =====================================================
  neonLayerGfx = createGraphics(windowWidth, windowHeight);
  neonLayerGfx.pixelDensity(1);
  neonLayerGfx.clear();

  neonTexture = PIXI.Texture.from(neonLayerGfx.elt);
  neonSprite = new PIXI.Sprite(neonTexture);
  pixiApp.stage.addChild(neonSprite);

  glowFilter = new PIXI.filters.GlowFilter({
    distance: 18,
    outerStrength: 1.5,
    innerStrength: 0.5,
    color: 0xff2fd0,
    quality: 0.5,
  });

  neonSprite.filters = [glowFilter];

  // =====================================================
  // DATA RAIN LAYER (p5 offscreen -> Pixi Sprite + Glow)
  // =====================================================
  dataRainLayer = createGraphics(windowWidth, windowHeight);
  dataRainLayer.pixelDensity(1);
  dataRainLayer.clear();

  dataRainTexture = PIXI.Texture.from(dataRainLayer.elt);
  dataRainSprite = new PIXI.Sprite(dataRainTexture);
  pixiApp.stage.addChild(dataRainSprite);

  dataRainFilter = new PIXI.filters.GlowFilter({
    distance: 22,
    outerStrength: 4.0,
    innerStrength: 1.2,
    color: 0x00ff77, // grüner Neon Glow
    quality: 0.5,
  });

  dataRainSprite.filters = [dataRainFilter];

  // =====================================================
  // DATA RAIN INIT
  // =====================================================
  initDataRain();
}

// =====================================================
// DRAW
// =====================================================
function draw() {
  background(0, 40);
  t += 0.01;

  // ================================
  // DEBUG MODE → Szene fix wählen
  // ================================
  if (debugMode) {
    if (debugScene === modes.ASCII) currentScene = modes.ASCII;
    if (debugScene === modes.NEON_OUTLINE) currentScene = modes.NEON_OUTLINE;
    if (debugScene === modes.DATA_RAIN) currentScene = modes.DATA_RAIN;

    isTransitioning = false;
    nextSceneSwitchTime = Infinity;

    // Layer löschen, wenn sie nicht aktiv sind
    if (debugScene !== modes.NEON_OUTLINE) {
      neonLayerGfx.clear();
      neonTexture.update();
      neonSprite.alpha = 0.0;
    }
    if (debugScene !== modes.DATA_RAIN) {
      dataRainLayer.clear();
      dataRainTexture.update();
      dataRainSprite.alpha = 0.0;
    }

    // Aktive Szene zeigen
    if (debugScene === modes.NEON_OUTLINE) neonSprite.alpha = 1.0;
    if (debugScene === modes.DATA_RAIN) dataRainSprite.alpha = 1.0;

    drawScene(debugScene, 1.0);
    drawDebugOverlay();
    return;
  }

  // ========================================
  // Nach Intro → Szenewechsel-Zeit setzen
  // ========================================
  if (nextSceneSwitchTime === 0) {
    nextSceneSwitchTime = t + random(sceneHoldMin, sceneHoldMax);
  }

  // ========================================
  // Szenewechsel starten, wenn Zeit
  // ========================================
  if (!isTransitioning && t >= nextSceneSwitchTime) {
    startTransition();
  }

  // ========================================
  // Zeichne aktuelle Szene (oder Übergang)
  // ========================================
  if (!isTransitioning) {
    drawScene(currentScene, 1.0);
  } else {
    const progress = constrain((t - transitionStart) / transitionDuration, 0, 1);
    const wOld = 1.0 - progress;
    const wNew = progress;

    drawScene(currentScene, wOld);
    drawScene(nextScene, wNew);

    if (progress >= 1.0) {
      finishTransition();
    }
  }

  // ========================================
  // Optional: Debug Overlay
  // ========================================
  if (debugMode) drawDebugOverlay();
}

// =====================================================
// MODE 1: NEON OUTLINE
// =====================================================
function drawNeonOutlineScene(weight) {
  neonSprite.alpha = weight;

  if (weight <= 0.01 || !video || !segmentation || !segmentation.data || !maskWidth || !maskHeight) return;

  video.loadPixels();
  if (video.pixels.length === 0) return;

  // 🎨 Neon in OFFSCREEN Layer zeichnen (nicht in main canvas)
  neonLayerGfx.clear();
  neonLayerGfx.push();

  // Spiegelung auf 2D Layer nachbauen
  neonLayerGfx.translate(neonLayerGfx.width, 0);
  neonLayerGfx.scale(-1, 1);

  const scaleX = neonLayerGfx.width / video.width;
  const scaleY = neonLayerGfx.height / video.height;

  neonLayerGfx.stroke(255, 0, 255, 180 * weight);
  neonLayerGfx.strokeWeight(0.7 + weight * 1.2);
  neonLayerGfx.noFill();

  const step = 2;

  // ==============================
  // HORIZONTALE LINIEN
  // ==============================
  for (let y = 0; y < video.height; y += step) {
    neonLayerGfx.beginShape();
    for (let x = 0; x < video.width; x += step) {
      if (random() > weight) continue;

      const mx = floor((x / video.width) * maskWidth);
      const my = floor((y / video.height) * maskHeight);
      const maskIndex = mx + my * maskWidth;

      if (segmentation.data[maskIndex] === 1) {
        neonLayerGfx.vertex(x * scaleX + random(-1, 1) * (1 - weight), y * scaleY);
      } else {
        neonLayerGfx.endShape();
        neonLayerGfx.beginShape();
      }
    }
    neonLayerGfx.endShape();
  }

  // ==============================
  // VERTIKALE LINIEN
  // ==============================
  for (let x = 0; x < video.width; x += step) {
    neonLayerGfx.beginShape();
    for (let y = 0; y < video.height; y += step) {
      if (random() > weight) continue;

      const mx = floor((x / video.width) * maskWidth);
      const my = floor((y / video.height) * maskHeight);
      const maskIndex = mx + my * maskWidth;

      if (segmentation.data[maskIndex] === 1) {
        neonLayerGfx.vertex(x * scaleX, y * scaleY + random(-1, 1) * (1 - weight));
      } else {
        neonLayerGfx.endShape();
        neonLayerGfx.beginShape();
      }
    }
    neonLayerGfx.endShape();
  }

  neonLayerGfx.pop();

  neonTexture.update();

  // Glow Stärke dynamisch mit weight
  glowFilter.outerStrength = 2.5 + weight * 4.0;
  glowFilter.innerStrength = 0.5 + weight * 2.0;
}

function drawScene(scene, weight) {
  if (scene === modes.NEON_OUTLINE) {
    neonSprite.alpha = weight;
    if (weight <= 0.01) return;
    drawNeonOutlineScene(weight);
  } else if (scene === modes.DATA_RAIN) {
    dataRainSprite.alpha = weight;
    if (weight <= 0.01) return;
    drawDataRainScene(weight);
  } else if (scene === modes.ASCII) {
    if (weight <= 0.01) return;
    drawDigitalizationScene(weight);
  }
}

// =====================================================
// MODE 0: ASCII BODY
// =====================================================
function drawDigitalizationScene(weight) {
  if (weight <= 0.01 || !video || !segmentation || !segmentation.data || maskWidth === 0 || maskHeight === 0) return;

  if (!video || !video.elt || video.elt.readyState < 2) return;
  video.loadPixels();
  if (!video.pixels || video.pixels.length === 0) return;

  const gl = drawingContext;
  push();
  gl.disable(gl.DEPTH_TEST);

  applyMirror2D();

  safeTextFont();
  textSize(10);
  textAlign(LEFT, TOP);

  const scaleX = width / video.width;
  const scaleY = height / video.height;

  // Synthwave-Farbanker (wie Referenzen)
  const colDark = color(60, 20, 110); // tiefes Violett
  const colMid1 = color(170, 60, 180); // Pink
  const colMid2 = color(255, 120, 120); // Orange / Sunset
  const colBright = color(0, 240, 255); // Cyan / Neon

  for (let y = 0; y < video.height; y += 2) {
    for (let x = 0; x < video.width; x += 2) {
      if (random() > weight) continue;

      const mx = floor((x / video.width) * maskWidth);
      const my = floor((y / video.height) * maskHeight);
      if (segmentation.data[mx + my * maskWidth] === 0) continue;

      const i = (x + y * video.width) * 4;
      let brightness = (video.pixels[i] + video.pixels[i + 1] + video.pixels[i + 2]) / 3;

      // Synthwave-Bias:
      // dunkle Bereiche hochziehen, Mitteltöne bevorzugen
      brightness = pow(brightness / 255, 0.6) * 255;

      const charIndex = floor(map(brightness, 0, 255, density.length - 1, 0));
      const c = density.charAt(charIndex);

      // kontinuierlicher Farbverlauf
      let col;
      if (brightness < 85) {
        col = lerpColor(colDark, colMid1, brightness / 85);
      } else if (brightness < 170) {
        col = lerpColor(colMid1, colMid2, (brightness - 85) / 85);
      } else {
        col = lerpColor(colMid2, colBright, (brightness - 170) / 85);
      }

      col.setAlpha(210); // gleichmäßig hell, nichts dominiert
      fill(col);

      const jitterX = random(-1.2, 1.2) * (1 - weight);
      const jitterY = random(-1.2, 1.2) * (1 - weight);

      text(c, x * scaleX + jitterX, y * scaleY + jitterY);
    }
  }

  gl.enable(gl.DEPTH_TEST);
  pop();
}

// =====================================================
// MODE 2: DATA RAIN (Matrix Style im Körper)
// =====================================================
function drawDataRainScene(weight) {
  if (weight <= 0.01 || !video || !segmentation || !segmentation.data || maskWidth === 0 || maskHeight === 0) return;

  dataRainSprite.alpha = weight;

  const gfx = dataRainLayer;
  gfx.clear();
  gfx.push();

  // Spiegelung auf 2D-Layer nachbauen (wie bei neonLayerGfx)
  gfx.translate(gfx.width, 0);
  gfx.scale(-1, 1);

  gfx.textFont(debugFont || "monospace");
  gfx.textSize(14);
  gfx.textAlign(CENTER, CENTER);
  gfx.noStroke();
  gfx.fill(0, 255, 120);

  const scaleX = gfx.width / video.width;
  const scaleY = gfx.height / video.height;

  for (let col of dataRainColumns) {
    col.y += col.speed * (0.5 + weight);
    col.index = (col.index + 1) % col.chars.length;

    if (col.y > video.height + col.length * rainStep) {
      col.y = random(-400, 0);
      col.speed = random(1, 2);
      col.index = 0;
    }

    for (let i = 0; i < col.length * weight; i++) {
      const x = col.x;
      const y = col.y - i * rainStep;
      if (y < 0 || y >= video.height) continue;

      const mx = floor((x / video.width) * maskWidth);
      const my = floor((y / video.height) * maskHeight);
      if (segmentation.data[mx + my * maskWidth] === 0) continue;

      const c = col.chars[(col.index + i) % col.chars.length];

      const alpha = map(i, 0, col.length, 220, 40) * weight;
      gfx.fill(0, 255, 120, alpha);

      gfx.text(c, x * scaleX, y * scaleY);
    }
  }

  gfx.pop();

  dataRainTexture.update();
}

// =====================================================
// INIT DATA RAIN
// =====================================================
function initDataRain() {
  if (!video) return;

  const cols = floor(video.width / rainStep);
  dataRainColumns = [];

  for (let i = 0; i < cols; i++) {
    dataRainColumns.push({
      x: i * rainStep,
      y: random(-500, 0),
      speed: random(1, 2),
      length: floor(random(25, 55)),
      index: 0,
      chars: Array.from({ length: 200 }, () => density.charAt(floor(random(density.length)))),
    });
  }

  console.log("DataRain initialisiert:", dataRainColumns.length, "Spalten");
}

// =====================================================
// INPUT
// =====================================================
function keyPressed() {
  // Debug Mode an / aus
  if (key === "d" || key === "D") {
    debugMode = !debugMode;
  }

  // Debug-Szenenwahl (Tasten 1/2/3)
  if (debugMode) {
    if (key === "1") debugScene = modes.ASCII;
    if (key === "2") debugScene = modes.NEON_OUTLINE;
    if (key === "3") debugScene = modes.DATA_RAIN;
  }
}

// =====================================================
// RESIZE / CLEANUP
// =====================================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
    console.log("Camera stopped");
  }
}

function drawDebugOverlay() {
  if (!debugFont) return;

  push();
  ortho();
  resetMatrix();
  noLights();

  // Ursprung nach oben links verschieben
  translate(-width / 2, -height / 2);

  // Hintergrund
  fill(0, 180);
  noStroke();
  rect(10, 10, 260, 70);

  // Text
  safeTextFont();
  fill(0, 255, 120);
  textSize(12);
  textAlign(LEFT, TOP);

  let label =
    debugScene === modes.ASCII ? "ASCII BODY" : debugScene === modes.NEON_OUTLINE ? "NEON OUTLINE" : "DATA RAIN";

  text("DEBUG MODE", 20, 18);
  text("Scene: " + label, 20, 36);
  text("Press 1 / 2 / 3", 20, 54);

  pop();
}

window.addEventListener("beforeunload", stopCamera);
