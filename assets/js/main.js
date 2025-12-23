/**
 * MAIN.JS (DEBUG MODE - PHASE 2: HOME UI)
 * Logic + Home Dashboard are active.
 * Quiz View is still disabled.
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';

// ✅ UNCOMMENTING THE HOME VIEW
import { UIHome } from './ui/views/ui-home.js';

export const Main = {
    state: {
        currentView: 'home',
        isQuizActive: false
    },

    async init() {
        console.log(`🚀 PHASE 2: Testing Dashboard UI...`);

        try {
            await DB.connect();
            
            if (MasterAggregator) MasterAggregator.init();
            
            // Initialize UI Shell
            if (window.UI) window.UI.init();

            // Load Preferences
            this._loadPreferences();

            // Start Router
            this._initRouter();

            // Force Render Home
            const container = document.getElementById('app-container');
            if (window.UIHome) {
                await UIHome.render(container);
                console.log("✅ PHASE 2 SUCCESS: Home Dashboard Rendered.");
            }

            // Remove Loader
            const loader = document.getElementById('boot-loader');
            if (loader) loader.style.display = 'none';

        } catch (e) {
            console.error("CRITICAL: Dashboard Failed", e);
        }
    },

    navigate(viewName) {
        // Only allow Home for now
        if (viewName === 'home') {
            this._handleRoute();
        } else {
            console.log(`⚠️ Navigation to '${viewName}' blocked in Phase 2.`);
            alert("Quiz View is disabled in Phase 2. We are testing the Dashboard only.");
        }
    },

    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    },

    async _handleRoute() {
        // Hardcoded to only render Home for safety
        const container = document.getElementById('app-container');
        if (window.UIHome) await UIHome.render(container);
    },

    // Stub for selectSubject so tiles don't crash on click
    selectSubject(id) {
        console.log(`Main: User clicked ${id}, but Quiz is disabled.`);
        alert(`You clicked ${id}! \n\nLogic is working, but Quiz View is off.`);
    },

    async _loadPreferences() {
        const theme = localStorage.getItem('theme') || 'dark';
        if (theme === 'dark') document.documentElement.classList.add('dark');
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

