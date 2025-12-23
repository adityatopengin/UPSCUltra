/**
 * MAIN.JS (DEBUG MODE - PHASE 1: LOGIC LAYER)
 * DB + Config + Logic Engines are active.
 * UI is still disabled.
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';

// ✅ UNCOMMENTING "THE BRAIN"
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';

// 🔴 UI STILL DISABLED
// import { DataSeeder } from './services/data-seeder.js'; 

export const Main = {
    state: {
        currentView: 'home',
        isQuizActive: false
    },

    async init() {
        console.log(`🚀 PHASE 1: Testing Logic Layer...`);

        try {
            // 1. Initialize Database
            await DB.connect();
            console.log("✅ Database Connected");

            // 2. Initialize Master Aggregator (The Manager)
            if (MasterAggregator) {
                MasterAggregator.init();
                console.log("✅ MasterAggregator Started");
            }

            // 3. Initialize Engine (The Logic)
            if (Engine) {
                console.log("✅ Quiz Engine Loaded");
            }

            // 4. Initialize UI Shell (If available global)
            if (window.UI) {
                window.UI.init();
            }

            // Remove Loader manually
            const loader = document.getElementById('boot-loader');
            if (loader) loader.style.display = 'none';

            console.log("✅ PHASE 1 SUCCESS: Logic Layer is clean.");

        } catch (e) {
            console.error("CRITICAL: Logic Layer Failed", e);
        }
    },

    // Empty Router
    navigate(viewName) { console.log("Nav disabled"); },
    _initRouter() { console.log("Router disabled"); },
    async _handleRoute() { console.log("Route handler disabled"); }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

