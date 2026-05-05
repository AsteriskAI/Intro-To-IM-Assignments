// Conway's Game of Life - Infinity Mirror Controller
// Communicates with ESP32 via WebSocket

const ESP32_IP = "192.168.1.103"; // Change to your ESP32's IP
const WS_PORT = 81;
let ws = null;
let wsStatus = "DISCONNECTED";

// Grid dimensions
const COLS = 8;
const ROWS = 8;
let grid = [];
let nextGrid = [];

// Simulation state
let running = false;
let generation = 0;
let simSpeed = 300; // ms between steps
let lastStep = 0;

// Each theme has a name, a color for alive cells, and a color for dead cells
const THEMES = [
  { name: "PLASMA",  alive: [0, 255, 180],  dead: [0, 40, 30]  },
  { name: "SOLAR",   alive: [255, 160, 0],  dead: [40, 20, 0]  },
  { name: "VOID",    alive: [180, 80, 255], dead: [20, 0, 40]  },
  { name: "ACID",    alive: [180, 255, 0],  dead: [20, 40, 0]  },
  { name: "GLACIER", alive: [80, 200, 255], dead: [0, 20, 40]  },
  { name: "CRIMSON", alive: [255, 60, 80],  dead: [40, 0, 10]  },
];
let themeIdx = 0;

// Built-in starting patterns, each is a list of [col, row] coords to set alive
const PRESETS = {
  RANDOM:  null,
  GLIDER:  [[1,0],[2,1],[0,2],[1,2],[2,2]],
  BLINKER: [[3,3],[4,3],[5,3]],
  BEACON:  [[2,2],[3,2],[2,3],[5,4],[4,5],[5,5]],
  TOAD:    [[2,3],[3,3],[4,3],[3,4],[4,4],[5,4]],
  BLOCK:   [[3,3],[4,3],[3,4],[4,4]],
};
let presetKeys = Object.keys(PRESETS);
let presetIdx = 0;

// Layout values, calculated once in buildButtons()
let CELL_SIZE, GRID_X, GRID_Y, GRID_W, GRID_H;
let PANEL_X, PANEL_W;

let buttons = [];
let particles = [];

// Canvas size
const CW = 960, CH = 620;

function setup() {
  let cnv = createCanvas(CW, CH);
  colorMode(RGB, 255);
  textFont("Share Tech Mono");
  // Initialize the grid, build the buttons and connect to the ESP32
  initGrid();
  buildButtons();
  connectWS();
}

function draw() {
  background(6, 6, 10);
  drawBackground();

  // Advance the simulation if enough time has passed
  if (running && millis() - lastStep > simSpeed) {
    stepLife();
    lastStep = millis();
    sendStateToESP32();
  }

  // Draw everything

  drawGrid();
  drawPanel();
  drawParticles();
  drawHUD();
}


// Initalize the 8x8 grid with all 0s
function initGrid() {
  grid     = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
  nextGrid = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
}

// For preset application, if random is chosen, it will go through each cell,
// there is a 45% chance it will become alive and 55% chance it stays dead
function applyPreset() {
  initGrid();
  generation = 0;
  let key = presetKeys[presetIdx];
  if (key === "RANDOM") {
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        grid[c][r] = random() > 0.55 ? 1 : 0;
  } else {
    // Take the preset, for every coordiante on that list, we make sure it isn't outside the edges
    // of the mirror, if its safe, make that coordinate alive.
    let pts = PRESETS[key];
    for (let [c, r] of pts) {
      if (c < COLS && r < ROWS) grid[c][r] = 1;
    }
  }

  // Send grid to ESP32 to update mirror
  sendStateToESP32();
}

/***
Conway's rules applied here:
- A live cell with 2 or 3 neighbors survives
- A dead cell with exactly 3 neighbors is born
- Everything else dies or stays dead
We also track which cells are newly born so we can spawn particles on them.
***/
function stepLife() {
  let born = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      let n = countNeighbors(c, r);
      let alive = grid[c][r] === 1;
      if (alive && (n === 2 || n === 3))   nextGrid[c][r] = 1;
      else if (!alive && n === 3)          { nextGrid[c][r] = 1; born.push([c, r]); }
      else                                 nextGrid[c][r] = 0;
    }
  }
  [grid, nextGrid] = [nextGrid, grid];
  generation++;

  // Spawn a few particles at each newly born cell
  for (let [c, r] of born) {
    let px = GRID_X + c * CELL_SIZE + CELL_SIZE / 2;
    let py = GRID_Y + r * CELL_SIZE + CELL_SIZE / 2;
    for (let i = 0; i < 4; i++) particles.push(new Particle(px, py));
  }
}

// Wraps around the edges so the grid is toroidal (the edges connect to each other)
function countNeighbors(c, r) {
  let count = 0;
  for (let dc = -1; dc <= 1; dc++)
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      let nc = (c + dc + COLS) % COLS;
      let nr = (r + dr + ROWS) % ROWS;
      count += grid[nc][nr];
    }
  return count;
}


function drawBackground() {
  // Soft radial glow behind the grid that pulses with the current theme color
  let t = THEMES[themeIdx];
  drawingContext.shadowBlur = 0;
  for (let r = 0; r < 120; r += 8) {
    let a = map(r, 0, 120, 25, 0);
    fill(t.alive[0], t.alive[1], t.alive[2], a);
    ellipse(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2, GRID_W + r * 2.5, GRID_H + r * 2.5);
  }
}

function drawGrid() {
  let t = THEMES[themeIdx];

  // Glowing border around the whole grid
  drawingContext.shadowColor = `rgb(${t.alive[0]},${t.alive[1]},${t.alive[2]})`;
  drawingContext.shadowBlur  = 20;
  stroke(t.alive[0], t.alive[1], t.alive[2], 120);
  strokeWeight(1.5);
  noFill();
  rect(GRID_X - 1, GRID_Y - 1, GRID_W + 2, GRID_H + 2, 4);
  drawingContext.shadowBlur = 0;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      let x = GRID_X + c * CELL_SIZE;
      let y = GRID_Y + r * CELL_SIZE;
      let alive = grid[c][r] === 1;

      if (alive) {
        // Glowing filled cell with a small white highlight in the corner
        drawingContext.shadowColor = `rgb(${t.alive[0]},${t.alive[1]},${t.alive[2]})`;
        drawingContext.shadowBlur  = 14;
        fill(t.alive[0], t.alive[1], t.alive[2]);
        noStroke();
        rect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 3);
        fill(255, 255, 255, 60);
        rect(x + 4, y + 4, (CELL_SIZE - 8) * 0.5, (CELL_SIZE - 8) * 0.5, 2);
      } else {
        // Dead cell, just a dark box with a faint border
        drawingContext.shadowBlur = 0;
        fill(t.dead[0], t.dead[1], t.dead[2]);
        stroke(t.alive[0], t.alive[1], t.alive[2], 20);
        strokeWeight(0.5);
        rect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 2);
        noStroke();
      }
    }
  }
  drawingContext.shadowBlur = 0;
}

function drawPanel() {
  let t = THEMES[themeIdx];

  // Dark panel background on the right side
  fill(8, 10, 14, 220);
  stroke(t.alive[0], t.alive[1], t.alive[2], 40);
  strokeWeight(1);
  rect(PANEL_X, 0, PANEL_W, CH, 0);
  noStroke();

  // Title with glow
  fill(t.alive[0], t.alive[1], t.alive[2]);
  textFont("Orbitron");
  textSize(13);
  textAlign(CENTER);
  drawingContext.shadowColor = `rgb(${t.alive[0]},${t.alive[1]},${t.alive[2]})`;
  drawingContext.shadowBlur  = 12;
  text("GAME OF LIFE", PANEL_X + PANEL_W / 2, 38);
  drawingContext.shadowBlur = 0;

  textFont("Share Tech Mono");
  textSize(9);
  fill(t.alive[0], t.alive[1], t.alive[2], 140);
  text("INFINITY MIRROR CONTROLLER", PANEL_X + PANEL_W / 2, 54);

  stroke(t.alive[0], t.alive[1], t.alive[2], 50);
  line(PANEL_X + 16, 64, PANEL_X + PANEL_W - 16, 64);
  noStroke();

  for (let b of buttons) b.draw();

  // Stats readout below the buttons
  let speedLabel = nf(map(simSpeed, 30, 900, 1, 0.03), 1, 2);
  drawStat("SPEED",  speedLabel + "x",     PANEL_X + PANEL_W / 2, 310);
  drawStat("GEN",    nf(generation, 1),     PANEL_X + PANEL_W / 2, 330);
  drawStat("THEME",  t.name,               PANEL_X + PANEL_W / 2, 350);
  drawStat("PRESET", presetKeys[presetIdx], PANEL_X + PANEL_W / 2, 370);

  stroke(t.alive[0], t.alive[1], t.alive[2], 50);
  line(PANEL_X + 16, 382, PANEL_X + PANEL_W - 16, 382);
  noStroke();

  drawWSStatus();
  drawSpeedBar();
  drawInstructions();
}

// Draws a left-aligned label and a right-aligned value on the same row
function drawStat(label, val, x, y) {
  let t = THEMES[themeIdx];
  textFont("Share Tech Mono");
  textAlign(LEFT);
  textSize(9);
  fill(t.alive[0], t.alive[1], t.alive[2], 110);
  text(label, PANEL_X + 16, y);
  fill(t.alive[0], t.alive[1], t.alive[2], 220);
  textAlign(RIGHT);
  text(val, PANEL_X + PANEL_W - 16, y);
  textAlign(CENTER);
}

function drawWSStatus() {
  let t = THEMES[themeIdx];
  let x = PANEL_X + PANEL_W / 2;
  let y = 400;

  textFont("Share Tech Mono");
  textSize(8);
  textAlign(CENTER);

  // Color the dot green for connected, yellow for connecting, red for anything else
  let col = wsStatus === "CONNECTED"  ? color(0, 255, 140) :
            wsStatus === "CONNECTING" ? color(255, 200, 0) :
                                        color(255, 60, 80);

  fill(col);
  drawingContext.shadowColor = col.toString();
  drawingContext.shadowBlur  = wsStatus === "CONNECTED" ? 10 : 0;
  text("● ESP32  " + wsStatus, x, y);
  drawingContext.shadowBlur = 0;

  fill(t.alive[0], t.alive[1], t.alive[2], 60);
  textSize(7);
  text(ESP32_IP + ":" + WS_PORT, x, y + 14);
}

// Visual bar that shows current sim speed from slow (left) to fast (right)
function drawSpeedBar() {
  let t  = THEMES[themeIdx];
  let x  = PANEL_X + 16;
  let y  = 430;
  let bw = PANEL_W - 32;
  let bh = 10;
  let pct = map(simSpeed, 900, 30, 0, 1);

  textFont("Share Tech Mono");
  textSize(9);
  fill(t.alive[0], t.alive[1], t.alive[2], 120);
  textAlign(LEFT);
  text("SIM SPEED", x, y - 6);

  fill(t.dead[0], t.dead[1], t.dead[2], 180);
  rect(x, y, bw, bh, 3);

  drawingContext.shadowColor = `rgb(${t.alive[0]},${t.alive[1]},${t.alive[2]})`;
  drawingContext.shadowBlur  = 6;
  fill(t.alive[0], t.alive[1], t.alive[2]);
  rect(x, y, bw * pct, bh, 3);
  drawingContext.shadowBlur = 0;

  textSize(7);
  fill(t.alive[0], t.alive[1], t.alive[2], 80);
  textAlign(LEFT);  text("SLOW", x, y + bh + 10);
  textAlign(RIGHT); text("FAST", x + bw, y + bh + 10);
  textAlign(CENTER);
}

function drawInstructions() {
  let t = THEMES[themeIdx];
  let x = PANEL_X + 16;
  let y = CH - 90;
  let lines = [
    "CLICK GRID  · toggle cell",
    "+/−        · speed",
    "SPACE       · play/pause",
    "C           · clear",
    "R           · randomise",
    "F           · fullscreen",
  ];
  textFont("Share Tech Mono");
  textSize(12);
  textAlign(LEFT);
  for (let i = 0; i < lines.length; i++) {
    fill(t.alive[0], t.alive[1], t.alive[2], 70 - i * 5);
    text(lines[i], x, y + i * 13);
  }
}

// Small status text above the grid showing if we're running or paused and what generation we're on
function drawHUD() {
  let t = THEMES[themeIdx];
  if (running) {
    drawingContext.shadowColor = `rgb(${t.alive[0]},${t.alive[1]},${t.alive[2]})`;
    drawingContext.shadowBlur  = 8;
    fill(t.alive[0], t.alive[1], t.alive[2]);
    textFont("Share Tech Mono");
    textSize(8);
    textAlign(LEFT);
    // Adding the ▶ or ■ symbol for more futuristic feel
    text("▶ RUNNING  GEN " + generation, GRID_X, GRID_Y - 10);
    drawingContext.shadowBlur = 0;
  } else {
    fill(200, 60, 60);
    textFont("Share Tech Mono");
    textSize(8);
    textAlign(LEFT);
    text("■ PAUSED   GEN " + generation, GRID_X, GRID_Y - 10);
  }
}


function buildButtons() {
  CELL_SIZE = 62;
  GRID_W    = COLS * CELL_SIZE;
  GRID_H    = ROWS * CELL_SIZE;
  GRID_X    = 30;
  GRID_Y    = (CH - GRID_H) / 2;
  PANEL_X   = GRID_X + GRID_W + 24;
  PANEL_W   = CW - PANEL_X - 10;

  let bx  = PANEL_X + 12;
  let bw2 = (PANEL_W - 32) / 2 - 2;
  let bwf = PANEL_W - 32;

  // Creating buttons which send commands
  buttons.push(new Button("▶ START", bx, 74, bwf, 30, () => {
    running = true;
    sendCmd("PLAY");
  }, true));

  buttons.push(new Button("■ PAUSE", bx, 112, bw2, 26, () => {
    running = false;
    sendCmd("PAUSE");
  }));
  buttons.push(new Button("▷ STEP", bx + bw2 + 8, 112, bw2, 26, () => {
    stepLife();
    sendStateToESP32();
  }));

  buttons.push(new Button("CLEAR", bx, 146, bw2, 26, () => {
    running = false;
    initGrid();
    generation = 0;
    sendStateToESP32();
  }));
  buttons.push(new Button("RANDOM", bx + bw2 + 8, 146, bw2, 26, () => {
    presetIdx = 0;
    applyPreset();
  }));

  buttons.push(new Button("− SLOW", bx, 180, bw2, 26, () => {
    simSpeed = min(simSpeed + 60, 900);
    sendCmd("SPEED:" + simSpeed);
  }));
  buttons.push(new Button("FAST +", bx + bw2 + 8, 180, bw2, 26, () => {
    simSpeed = max(simSpeed - 60, 30);
    sendCmd("SPEED:" + simSpeed);
  }));

  buttons.push(new Button("◈ THEME", bx, 214, bw2, 26, () => {
    themeIdx = (themeIdx + 1) % THEMES.length;
    sendCmd("THEME:" + themeIdx);
  }));
  buttons.push(new Button("✦ PRESET", bx + bw2 + 8, 214, bw2, 26, () => {
    presetIdx = (presetIdx + 1) % presetKeys.length;
    applyPreset();
  }));

  buttons.push(new Button("⌁ CONNECT", bx, 248, bwf, 26, () => {
    connectWS();
  }));
}


function mousePressed() {
  for (let b of buttons) {
    if (b.contains(mouseX, mouseY)) { b.click(); return; }
  }
  // If the click missed all buttons, check if it lands on the grid and toggle that cell
  let c = floor((mouseX - GRID_X) / CELL_SIZE);
  let r = floor((mouseY - GRID_Y) / CELL_SIZE);
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
    grid[c][r] = grid[c][r] === 1 ? 0 : 1;
    sendStateToESP32();
  }
}

function mouseMoved() {
  for (let b of buttons) b.hover = b.contains(mouseX, mouseY);
}

function mouseDragged() {
  mouseMoved();
  // Holding and dragging paints alive cells
  let c = floor((mouseX - GRID_X) / CELL_SIZE);
  let r = floor((mouseY - GRID_Y) / CELL_SIZE);
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
    grid[c][r] = 1;
  }
}

function keyPressed() {
  if (key === ' ')                { running = !running; sendCmd(running ? "PLAY" : "PAUSE"); }
  if (key === 'c' || key === 'C') { initGrid(); generation = 0; running = false; sendStateToESP32(); }
  if (key === 'r' || key === 'R') { presetIdx = 0; applyPreset(); }
  if (key === '+' || key === '=') { simSpeed = max(simSpeed - 60, 30);  sendCmd("SPEED:" + simSpeed); }
  if (key === '-' || key === '_') { simSpeed = min(simSpeed + 60, 900); sendCmd("SPEED:" + simSpeed); }
  if (key === 't' || key === 'T') { themeIdx = (themeIdx + 1) % THEMES.length; sendCmd("THEME:" + themeIdx); }
  if (key === 'f' || key === 'F') { toggleFullscreen(); }
}

// This tells p5 to re-draw everything if the window changes size
function windowResized() {
  if (fullscreen()) {
    resizeCanvas(windowWidth, windowHeight);
  } else {
    resizeCanvas(CW, CH);
  }
  buildButtons(); 
}

// Full screen
function toggleFullscreen() {
  let fs = fullscreen();
  fullscreen(!fs);
}


function connectWS() {
  // If theres a connection already open, kill it.
  if (ws) { try { ws.close(); } catch (e) {} }
  // Connecting state
  wsStatus = "CONNECTING";
  // Connect to our esp32 IP and port
  ws = new WebSocket(`ws://${ESP32_IP}:${WS_PORT}/`);

  // If connected immediately send grid state to esp32
  ws.onopen    = () => { wsStatus = "CONNECTED"; sendStateToESP32(); };
  ws.onclose   = () => { wsStatus = "DISCONNECTED"; };
  ws.onerror   = () => { wsStatus = "ERROR"; };
}

// Function to send commands
function sendCmd(cmd) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send("CMD:" + cmd);
  }
}


// The grid is encoded as a 64-character string of 0s and 1s (row-major order).
// We bundle that with the generation count, speed, and theme index into one message
// so the ESP32 always has a complete snapshot of the current state.


// Send the entire state to the esp32 to update the mirro, LCD and dot matrix.
function sendStateToESP32() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  let cells = "";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      cells += grid[c][r];
  ws.send(`GRID:${cells},GEN:${generation},SPEED:${simSpeed},THEME:${themeIdx}`);
}

// You have reached the end!