/***
Each button stores its own position, size, label, and the action function to call on click.
Accent buttons (like START) get a filled glowing style, regular buttons are outlined only.
The flash counter gives a quick brightness pop when a button is clicked.
***/
class Button {
    constructor(label, x, y, w, h, action, accent) {
    // Button designs
    this.label  = label;
    this.x      = x;
    this.y      = y;
    this.w      = w;
    this.h      = h;
    this.action = action;
    this.accent = accent || false;
    this.hover  = false;
    this.flash  = 0;
    }
    contains(mx, my) {
    return mx > this.x && mx < this.x + this.w && my > this.y && my < this.y + this.h;
    }
    // When you click, sets a timer for an 8-frame flash and calls the action
    click() { this.flash = 8; this.action(); }
    draw() {
    // Get the theme colors and start drawing the button
    let t    = THEMES[themeIdx];
    // Hover state
    let over = this.hover;
    // If flash timer above 0 return true
    let fl   = this.flash > 0;
    // While flash is greater than 0, subtract
    if (this.flash > 0) this.flash--;

    // Set alpha based on state
    let alpha = fl ? 255 : over ? 200 : 140;
    // Gets the rgb values from theme
    let r = t.alive[0], g = t.alive[1], b = t.alive[2];

    // Creates an accent with what it is provided
    if (this.accent) {
        drawingContext.shadowColor = `rgb(${r},${g},${b})`;
        drawingContext.shadowBlur  = fl ? 20 : over ? 12 : 6;
        fill(r, g, b, fl ? 220 : over ? 160 : 80);
    } else {
        drawingContext.shadowBlur = 0;
        fill(r * 0.1, g * 0.1, b * 0.1, 180);
    }

    // Box design
    stroke(r, g, b, alpha);
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 4);
    drawingContext.shadowBlur = 0;
    noStroke();

    // If its an accent button, and you hover or click the text turns dark since the box is bright
    // Otherwise the text is the theme color
    fill(
        this.accent ? (fl || over ? 0 : r * 0.1) : r,
        this.accent ? (fl || over ? 0 : g * 0.1) : g,
        this.accent ? (fl || over ? 0 : b * 0.1) : b,
        this.accent ? 255 : alpha
    );
    // Text aligning
    textFont("Orbitron");
    textSize(8);
    textAlign(CENTER, CENTER); 
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
    }
}
