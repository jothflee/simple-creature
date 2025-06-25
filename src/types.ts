// src/types.ts

export interface VisualConfig {
  width: number;
  height: number;
  groundY: number;
  bodyRadius: number;
  bodyOptions?: Matter.IBodyDefinition;
  bodyColor?: string;
  muscleColor?: string;
}

export type ActivationType = 'periodic' | 'onGroundContact';

export interface MuscleConfig {
  restLength: number;
  stiffness: number;
  activationType: ActivationType;
  period?: number;           // ms, for 'periodic'
  extensionFactor?: number;  // multiplier when active
}

export interface BestCreature {
  creature: any; // Use any to avoid circular imports, will be typed as Creature when imported
  evolution: number;
}

// Common interface for physics worlds
export interface IPhysicsWorld {
  addCreature(creature: any, position?: number): void; // Use any to avoid circular imports
  removeCreature(creatureId: number): void;
  update(delta: number): void;
  cleanup(): void;
}
