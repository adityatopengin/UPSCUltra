/**
 * MAIN.JS (DEBUG MODE - LEVEL 0)
 * Only DB and Config are active.
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';

// 🔴 COMMENTED OUT TO ISOLATE ERRORS
// import { DataSeeder } from './services/data-seeder.js'; 
// import { MasterAggregator } from './services/master-aggregator.js';
// import { Engine } from './engine/quiz-engine.js';

export const Main = {
    state: {
        currentView: 'home'
    },

    async init() {
        console.log(`🚀 DEBUG MODE: Booting Core...`);

        try {
            // 1. Initialize Database
            await DB.connect();
            console.log("✅ Database Connected");

            // 2. Initialize UI Shell (If available global)
            if (window.UI) {
                window.UI.init();
                console.log("✅ UI Shell Initialized");
            }

            // 3. Remove Loader manually for test
            const loader = document.getElementById('boot-loader');
            if (loader) loader.style.display = 'none';

            console.log("✅ System Online (Skeleton Only).");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
        }
    },

    // Empty Router for now
    navigate(viewName) {
        console.log(`Maps called for: ${viewName} (Disabled in Debug Mode)`);
    },
    
    // Empty Router
    _initRouter() {
        console.log("Router disabled");
    },
    
    // Empty Handler
    async _handleRoute() {
        console.log("Route handler disabled");
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

