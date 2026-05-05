/***
Particles are spawned at cells that are newly born each generation.
They fly outward from the birth point, slow down with friction, and fade out
over their lifetime. The glow color matches the current theme.
***/
class Particle {
    constructor(x, y) {
    // Spawn at x and y position of new cell
    this.x    = x;
    this.y    = y;
    // Random speed betwene -2 and 2 for both x and y
    this.vx   = random(-2, 2);
    this.vy   = random(-2, 2);
    // Life (100% opacity)
    this.life = 1.0;
    // Randomize size
    this.size = random(2, 5);
    }
    update() {
    // Update x and y position with velocity
    this.x    += this.vx;
    this.y    += this.vy;
    // Adding friction to make it look like the particle is slowing down
    this.vx   *= 0.9; // Friction
    this.vy   *= 0.9;
    // Decrease opacity of particle
    this.life -= 0.06;
    }
    draw() {
    // Take the theme colors
    let t = THEMES[themeIdx];
    // 220 is the sweet spot I personally found where the particle looks fine (alpha ranges to 255)
    let a = this.life * 220;
    // Apply a glow to the particle
    drawingContext.shadowColor = `rgba(${t.alive[0]},${t.alive[1]},${t.alive[2]},${this.life})`;
    drawingContext.shadowBlur  = 8;
    // Fill in the particle
    fill(t.alive[0], t.alive[1], t.alive[2], a);
    noStroke();
    // Draw it
    ellipse(this.x, this.y, this.size);
    }
}

function drawParticles() {
    // Deletes particles (use .filter to just take out every particle that isn't "dead")
    // Use arrow function to return alive particles
    particles = particles.filter(p => p.life > 0);
    // Only draw and move the alive particles
    for (let p of particles) { p.update(); p.draw(); }
    drawingContext.shadowBlur = 0;
}