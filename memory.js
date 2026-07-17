let video, prevFrame;
let motionLevel = 0;

// Estados
const STATE_INTRO = 0;
const STATE_EXPERIENCE = 1;
const STATE_LOST = 2;
let state = STATE_INTRO;

// Texto
let introText = "Memory Loss";
let typedText = "";
let typeIndex = 0;

// Botões
let startButton, retryButton;

// Fragmentos
let pieces = [];
let cols = 8;
let rows = 8;
let pieceSize = 60;
let center;

// Fases memória
let memoryPhase = 0;
let memoryTimer = 0;
let memoryInterval = 80;

// Som
let osc1, osc2, osc3, noise, filter;

// Imagem
let mainImage;

// Transição
let transitionAlpha = 0;

// Imagens
let imageIndex = 0;
let images = [
  "https://picsum.photos/400",
  "https://picsum.photos/401"
];

// --------------------------------------------------
class Piece {
  constructor(sx, sy, imgW, imgH) {
    this.sx = sx;
    this.sy = sy;
    this.imgW = imgW;
    this.imgH = imgH;

    this.pos = createVector(random(width), random(height));
    this.offset = p5.Vector.random2D().mult(random(80, 200));
    this.rotation = random(-15, 15);
    this.scale = random(0.8, 1.2);

    this.alive = true;
    this.alpha = 255;
    this.fadeSpeed = random(8, 15);
    this.disappearOffset = createVector(random(-50, 50), random(-50, 50));
  }

  update(target, health) {
    if (!this.alive && this.alpha > 0) {
      this.pos.add(this.disappearOffset.copy().mult(0.08));
      this.alpha -= this.fadeSpeed;
      this.alpha = max(this.alpha, 0);
    } else {
      this.pos.lerp(target, 0.12);
    }

    let tremor = map(health, 0, 1, 20, 0);

    this.draw(
      health,
      this.pos.x + random(-tremor, tremor),
      this.pos.y + random(-tremor, tremor)
    );
  }

  draw(health, x, y) {
    push();
    translate(x + pieceSize / 2, y + pieceSize / 2);
    rotate(radians(this.rotation * (1 - health)));
    scale(lerp(this.scale, 1, health));
    tint(255, map(health, 0, 1, 60, this.alpha));
    image(
      mainImage,
      -pieceSize / 2,
      -pieceSize / 2,
      pieceSize,
      pieceSize,
      this.sx,
      this.sy,
      this.imgW,
      this.imgH
    );
    pop();
  }
}

// --------------------------------------------------
function preload() {
  mainImage = loadImage(images[imageIndex]);
}

// --------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont("Courier");
  center = createVector(width / 2, height / 2);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  prevFrame = createImage(width, height);

  createUI();
  createMemoryPieces();
  setupSound();
}

// --------------------------------------------------
function createMemoryPieces() {
  pieces = [];
  let imgW = mainImage.width / cols;
  let imgH = mainImage.height / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      pieces.push(new Piece(x * imgW, y * imgH, imgW, imgH));
    }
  }

  memoryPhase = 0;
  memoryTimer = 0;
}

// --------------------------------------------------
function createUI() {
  startButton = createButton("enter");
  startButton.mousePressed(startExperience);

  retryButton = createButton("retry");
  retryButton.mousePressed(resetExperience);

  positionButtons();
}

// --------------------------------------------------
function positionButtons() {
  startButton.position(width / 2 - 30, height / 2 + 120);
  retryButton.position(width / 2 - 30, height / 2 + 40);
}

// --------------------------------------------------
function setupSound() {
  // Camadas de osciladores para efeito atmosférico
  osc1 = new p5.Oscillator("sine");
  osc2 = new p5.Oscillator("triangle");
  osc3 = new p5.Oscillator("sine");

  osc1.amp(0.02);
  osc2.amp(0.015);
  osc3.amp(0.015);

  osc1.freq(220);
  osc2.freq(110);
  osc3.freq(330);

  noise = new p5.Noise("pink");
  filter = new p5.LowPass();
  noise.disconnect();
  noise.connect(filter);
  filter.freq(800);
}

// --------------------------------------------------
function draw() {
  background(0);
  if (state === STATE_INTRO) {
    startButton.show();
    retryButton.hide();
  } else if (state === STATE_EXPERIENCE) {
    startButton.hide();
    retryButton.hide();
  } else if (state === STATE_LOST) {
    startButton.hide();
    retryButton.show();
  }

  if (state === STATE_INTRO) drawIntro();
  else if (state === STATE_EXPERIENCE) drawExperience();
  else if (state === STATE_LOST) drawLost();

  drawTransition();
}

// --------------------------------------------------
function drawIntro() {
  let fade = map(frameCount, 0, 100, 0, 255);
  fade = constrain(fade, 0, 255);
  background(0);
  textAlign(CENTER, CENTER);
  textSize(28);

  if (frameCount % 2 === 0 && typeIndex < introText.length) {
    typedText += introText.charAt(typeIndex);
    typeIndex++;
  }

  fill(255, fade);
  text(typedText, width / 2, height / 2 - 40);

  if (typeIndex === introText.length) {
    textSize(14);
    fill(200);
    text(
      "Move your body to keep the memory together.\nIf you stop moving, the memory will fade away.",
      width / 2,
      height / 2 + 10
    );
    startButton.style("opacity", "1");
  } else {
    startButton.style("opacity", "0");
  }
}

// --------------------------------------------------
function drawExperience() {
  detectMotion();

  let health = constrain(map(motionLevel, 0, 15, 0, 1), 0, 1);
  let bgColor = lerpColor(color(20, 20, 30), color(230), health);
  background(bgColor);

  memoryTimer++;
  handleMemoryPhase();
  drawMemoryPieces(health);
  drawCameraPreview();
  updateSound(health);

  if (!pieces.some(p => p.alpha > 0)) {
    state = STATE_LOST;
  }
}

// --------------------------------------------------
function drawLost() {
  background(0);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);
  text("You lost your memory", width / 2, height / 2 - 40);
}

// --------------------------------------------------
function handleMemoryPhase() {
  if (memoryTimer > memoryInterval) {
    memoryTimer = 0;
    memoryPhase++;
    if (memoryPhase > 2) memoryPhase = 0;

    if (memoryPhase === 2) {
      for (let p of pieces) {
        if (p.alive && random() < 0.5) p.alive = false;
      }
    }
  }
}

// --------------------------------------------------
function drawMemoryPieces(health) {
  let startX = center.x - (cols * pieceSize) / 2;
  let startY = center.y - (rows * pieceSize) / 2;

  for (let p of pieces) {
    if (p.alpha <= 0) continue;

    let baseX = startX + (p.sx / mainImage.width) * (cols * pieceSize);
    let baseY = startY + (p.sy / mainImage.height) * (rows * pieceSize);

    let target;

    if (memoryPhase === 0)
      target = createVector(baseX, baseY).add(p.offset);
    else if (memoryPhase === 1)
      target = createVector(baseX, baseY);
    else
      target = createVector(baseX, baseY).add(p.offset.mult(0.5));

    p.update(target, health);
  }
}

// --------------------------------------------------
function drawCameraPreview() {
  let w = width / 8;
  let h = (w * 3) / 4;

  push();
  translate(width - w - 10, 10);
  image(video, 0, 0, w, h);
  noFill();
  stroke(0);
  rect(0, 0, w, h);
  pop();
}

// --------------------------------------------------
function detectMotion() {
  video.loadPixels();
  prevFrame.loadPixels();

  let diff = 0;
  for (let i = 0; i < video.pixels.length; i += 4) {
    diff += abs(video.pixels[i] - prevFrame.pixels[i]);
  }

  motionLevel = lerp(motionLevel, diff / 80000, 0.35);
  prevFrame.copy(video, 0, 0, width, height, 0, 0, width, height);
}

// --------------------------------------------------
function updateSound(health) {
  osc1.freq(lerp(200, 440, health), 0.2);
  osc2.freq(lerp(100, 330, health), 0.2);
  osc3.freq(lerp(300, 550, health), 0.2);

  osc1.amp(lerp(0.01, 0.05, health), 0.2);
  osc2.amp(lerp(0.01, 0.03, health), 0.2);
  osc3.amp(lerp(0.005, 0.02, health), 0.2);

  filter.freq(lerp(500, 1200, health), 0.2);
  filter.res(8);
  noise.amp(map(health, 0, 1, 0.005, 0.02), 0.2);
}

// --------------------------------------------------
function startExperience() {
  transitionAlpha = 255;

  imageIndex = 1;
  mainImage = loadImage(images[imageIndex]);

  osc1.start();
  osc2.start();
  osc3.start();
  noise.start();

  setTimeout(() => {
    state = STATE_EXPERIENCE;
  }, 300);
}

// --------------------------------------------------
function drawTransition() {
  if (transitionAlpha > 0) {
    fill(255, transitionAlpha);
    rect(0, 0, width, height);
    transitionAlpha -= 15;
  }
}

// --------------------------------------------------
function resetExperience() {
  state = STATE_INTRO;
  typedText = "";
  typeIndex = 0;
  createMemoryPieces();

  osc1.stop();
  osc2.stop();
  osc3.stop();
  noise.stop();

  imageIndex = 0;
  mainImage = loadImage(images[imageIndex]);
}

// --------------------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  center.set(width / 2, height / 2);
  positionButtons();
}