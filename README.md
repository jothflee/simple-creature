# Simple Creature Evolution Simulator

Welcome to the **Simple Creature Evolution Simulator**! This is a fun project built with React, TypeScript, and Vite, where you can watch creatures evolve and compete in a physics-based simulation. The creatures are made of connected bodies and muscles evolving over time to travel as far as possible. The top 3 creatures are highlighted, while the top 10 are retained for observation.

## Features
- **Physics-based Simulation**: Creatures are made of connected bodies and muscles, evolving to maximize their distance traveled.
- **Dynamic Evolution**: New creatures are added every 250ms, and the oldest non-top-3 are removed.
- **Leaderboard**: Persistent top 3 creatures are highlighted with unique colors (red, blue, green).
- **Infinite Ground**: The simulation supports infinite travel with dynamic zoom and hashmarks every 100 units.
- **UI Stats Panel**: Displays evolution stats, including the best distance and total creatures.

## How to Run the App

Follow these simple steps to get started:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/jothflee/simple-creature
   cd simple-creature
   ```

2. **Install Dependencies**
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Start the Development Server**
   Launch the app locally:
   ```bash
   npm run dev
   ```
   This will start the Vite development server. Open your browser and navigate to `http://localhost:5173` to see the app in action.

4. **Build for Production**
   To create an optimized production build, run:
   ```bash
   npm run build
   ```
   The build output will be in the `dist` folder.

5. **Preview the Production Build**
   You can preview the production build locally:
   ```bash
   npm run preview
   ```

## For Fun and Learning
This project is designed for fun and to explore concepts like physics simulations, evolutionary algorithms, and React-based UI development. Feel free to fork the repository, experiment, and make it your own!

Enjoy watching the creatures evolve and compete! 🚀
