// src/World.ts

import { Engine, World, Bodies, Body, Render } from 'matter-js';
import { Creature, PhysicsBody, Muscle } from './Creature';
import type { IPhysicsWorld, VisualConfig } from './types';

// Base class for physics worlds
export abstract class BasePhysicsWorld implements IPhysicsWorld {
  protected engine: Engine;
  protected render: Render;
  protected creatures: Map<number, { bodies: PhysicsBody[]; muscles: Muscle[] }> = new Map();
  protected cfg: VisualConfig;
  protected lastUpdate = Date.now();
  private distanceBins: number[] = [];
  protected creatureMaxDistances: Map<number, number> = new Map();

  constructor(cfg: VisualConfig, canvas: HTMLCanvasElement, gravity: number = 1) {
    this.cfg = cfg;
    this.engine = Engine.create();
    this.engine.gravity.y = gravity;

    this.render = Render.create({
      engine: this.engine,
      canvas,
      options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: '#1a1a1a',
        showAngleIndicator: false,
        showVelocity: false,
      },
    });

    Render.run(this.render);
    this.startUpdateLoop();
  }

  // Get the Matter.js engine
  getEngine(): Engine {
    return this.engine;
  }

  // Get displayed creature IDs
  getDisplayedCreatureIds(): number[] {
    return Array.from(this.creatures.keys());
  }

  private startUpdateLoop(): void {
    const loop = () => {
      if (this.engine) {
        const now = Date.now();
        const delta = now - this.lastUpdate;
        const cappedDelta = Math.min(delta, 50); // Cap at 50ms to prevent huge jumps
        
        this.update(cappedDelta);
        this.lastUpdate = now;
        requestAnimationFrame(loop);
      }
    };
    loop();
  }

  abstract addCreature(creature: Creature): void;

  removeCreature(creatureId: number): void {
    const creatureData = this.creatures.get(creatureId);
    if (creatureData) {
        // Calculate the furthest distance reached by the creature
        const furthestDistance = Math.max(
            ...creatureData.bodies.map(body => body.body.position.x)
        );
        // Update the all-time max distance for this creature
        const prev = this.creatureMaxDistances.get(creatureId) || 0;
        if (furthestDistance > prev) {
            this.creatureMaxDistances.set(creatureId, furthestDistance);
        }
        // Remove bodies and muscles from the physics world
        creatureData.bodies.forEach(body => {
            World.remove(this.engine.world, body.body);
        });
        creatureData.muscles.forEach(muscle => {
            World.remove(this.engine.world, muscle.constraint);
        });
        this.creatures.delete(creatureId);
    }
  }

  // Optional: Method to retrieve the distance bins for visualization
  getDistanceBins(): number[] {
    return this.distanceBins;
  }

  private renderDistanceBins(): void {
    if (!this.render || !this.render.context || !this.render.canvas) return;

    const ctx = this.render.context;
    const canvas = this.render.canvas as HTMLCanvasElement;
    const bounds = this.render.bounds;
    const scaleX = canvas.width / (bounds.max.x - bounds.min.x);
    const scaleY = canvas.height / (bounds.max.y - bounds.min.y);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';

    // Render each bin as a bar
    this.distanceBins.forEach((count, index) => {
      const binX = index * 100;
      const barWidth = 100 * scaleX;
      const barHeight = count * 10;

      const screenX = (binX - bounds.min.x) * scaleX;
      const screenY = (this.cfg.groundY - bounds.min.y) * scaleY;

      ctx.fillStyle = '#222';
      ctx.fillRect(screenX, screenY - barHeight, barWidth, barHeight);
    });

    ctx.restore();
  }

  update(delta: number): void {
    Engine.update(this.engine, delta);
    // Update all-time max distances for living creatures
    this.creatures.forEach(({ bodies }, id) => {
        const furthest = Math.max(...bodies.map(body => body.body.position.x));
        const prev = this.creatureMaxDistances.get(id) || 0;
        if (furthest > prev) {
            this.creatureMaxDistances.set(id, furthest);
        }
    });
    // Rebuild histogram bins from all max distances
    this.distanceBins = [];
    this.creatureMaxDistances.forEach((dist) => {
        const binIndex = Math.floor(dist / 100);
        while (this.distanceBins.length <= binIndex) {
            this.distanceBins.push(0);
        }
        this.distanceBins[binIndex] += 1;
    });
    this.renderDistanceBins();
  }

  cleanup(): void {
    if (this.render) {
      Render.stop(this.render);
    }
    this.creatures.clear();
  }
}

// Main simulation world with gravity and ground
export class MainWorld extends BasePhysicsWorld {
  private hashmarks: Body[] = [];
  private top3MaxDistances: Map<number, number> = new Map();

  constructor(cfg: VisualConfig, canvas: HTMLCanvasElement) {
    super(cfg, canvas, 1); // Normal gravity
    this.top3MaxDistances = new Map();
    this.createGround();
    this.createDistanceHashmarks();
    // Zoom out to show 0 and a little negative
    this.render.bounds.min.x = -200;
    this.render.bounds.max.x = cfg.width;
    this.render.bounds.min.y = 0;
    this.render.bounds.max.y = cfg.height;
    this.render.options.hasBounds = true;
  }

  private createGround(): void {
    const ground = Bodies.rectangle(
      this.cfg.width / 2,
      this.cfg.groundY + 50, // move center down
      this.cfg.width * 100, // Make ground very wide for infinite travel
      100, // much thicker ground
      {
        isStatic: true,
        collisionFilter: {
          category: 0x0001,
          mask: 0x0002,
        }
      }
    );
    World.add(this.engine.world, ground);
  }

  addCreature(creature: Creature): void {
    // Creatures are added directly to the main world, no cloning needed
    this.creatures.set(creature.id, {
      bodies: creature.bodies,
      muscles: creature.muscles
    });
  }

  update(delta: number): void {
    super.update(delta);
    if (!this.top3MaxDistances) this.top3MaxDistances = new Map();
    // Update all-time max distances and style creatures based on persistent top10
    const colors = ['#e74c3c', '#3498db', '#2ecc40'];
    // Compute/update max distances
    this.creatures.forEach(({ bodies }, id) => {
      const maxX = Math.max(...bodies.map(b => b.body.position.x));
      const prev = this.top3MaxDistances.get(id) || 0;
      if (maxX > prev) this.top3MaxDistances.set(id, maxX);
    });
    // Determine persistent top10 IDs
    const top10Ids = Array.from(this.top3MaxDistances.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id);
    const top3Ids = top10Ids.slice(0, 3);
    // Single pass: apply styles
    this.creatures.forEach(({ bodies, muscles }, id) => {
      const idx = top3Ids.indexOf(id);
      let fill, opacity, stroke, lineWidth;
      if (top3Ids.includes(id)) {
        fill = colors[idx];
        opacity = 1;
        stroke = '#fff';
        lineWidth = 3;
      } else if (top10Ids.includes(id)) {
        fill = '#fff';
        opacity = .75;
        stroke = '#eee';
        lineWidth = 1;
      } else {
        fill = '#fff';
        opacity = 0.25;
        stroke = '#ddd';
        lineWidth = 1;
      }
      bodies.forEach(b => {
        b.body.render.fillStyle = fill;
        b.body.render.opacity = opacity;
      });
      muscles.forEach(m => {
        m.constraint.render = {
          ...m.constraint.render,
          strokeStyle: stroke,
          lineWidth
        };
      });
    });
    // --- DYNAMIC ZOOM TO KEEP TOP 3 IN VIEW ---
    let furthest = 0;
    this.top3MaxDistances.forEach((value) => {
      if (value > furthest) furthest = value;
    });
    const margin = 100;
    const minX = -200;
    const maxX = Math.max(this.cfg.width, furthest + margin);
    this.render.bounds.min.x = minX;
    this.render.bounds.max.x = maxX;
    // Maintain aspect ratio and keep ground at bottom
    const widthRange = maxX - minX;
    const aspect = this.cfg.height / this.cfg.width;
    const heightRange = widthRange * aspect;
    this.render.bounds.max.y = this.cfg.groundY + 50; // ground stays at bottom
    this.render.bounds.min.y = this.render.bounds.max.y - heightRange;
    this.render.options.hasBounds = true;

    // Update hashmarks after zoom
    this.updateDistanceHashmarks();
  }

  private createDistanceHashmarks(): void {
    this.updateDistanceHashmarks();
  }

  private updateDistanceHashmarks(): void {
    if (!this.hashmarks) this.hashmarks = [];
    if (!this.top3MaxDistances) this.top3MaxDistances = new Map();
    this.hashmarks.forEach(mark => World.remove(this.engine.world, mark));
    this.hashmarks = [];
    let maxDistance = 0;
    const creatureEntries = Array.from(this.creatures.entries()).map(([id, { bodies }]) => ({
      id,
      x: Math.max(...bodies.map(b => b.body.position.x))
    }));
    creatureEntries.forEach(entry => {
      maxDistance = Math.max(maxDistance, entry.x);
    });
    const HASHMARK_INTERVAL = 100;
    const viewWidth = this.render.bounds.max.x - this.render.bounds.min.x;
    const endDistance = Math.max(viewWidth, maxDistance + HASHMARK_INTERVAL * 2);
    for (let d = 0; d <= endDistance; d += HASHMARK_INTERVAL) {
      const mark = Bodies.rectangle(
        d, this.cfg.groundY - 5, 2, 10,
        { isStatic: true, render: { fillStyle: '#666' }, collisionFilter: { category: 0x0004, mask: 0x0000 } }
      );
      this.hashmarks.push(mark);
      World.add(this.engine.world, mark);
    }
  }

  // Reset the top 3 creatures to the start position instead of removing them
  resetTop3ToStart(): void {
    const margin = 5;
    const top3 = Array.from(this.creatures.values())
      .map(({ bodies, muscles }, idx) => ({
        idx,
        bodies,
        muscles,
        x: Math.max(...bodies.map(b => b.body.position.x))
      }))
      .sort((a, b) => b.x - a.x)
      .slice(0, 3);
    top3.forEach(entry => {
      entry.bodies.forEach(body => {
        // Ensure all parts are above ground
        const radius = body.body.circleRadius || 10;
        const safeY = Math.min(body.body.position.y, this.cfg.groundY - radius - margin);
        Body.setPosition(body.body, { x: 0, y: safeY });
        Body.setVelocity(body.body, { x: 0, y: 0 });
        Body.setAngularVelocity(body.body, 0);
      });
    });
  }
}
