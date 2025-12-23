/**
 * MAIN.JS (DIAGNOSTIC MODE)
 * Purpose: Force the app to start and report missing files.
 */

// Core Services (Must load)
import { DB } from './services/db.js';
import { CONFIG } from './config.js';

export const Main = {
    state: {
        currentView: 'home',
        isQuizActive: false
    },

    async init() {
        console.log("🚀 DIAGNOSTIC MODE: Starting...");

        // 1. Test Database
        try {
            await DB.connect();
            console.log("✅ Database: Connected");
        } catch (e) {
            console.error("❌ Database: FAILED", e);
        }

        // 2. Load UI Manager safely
        try {
            // Dynamic import to prevent crash if file is missing
            const module = await import('./ui/ui-manager.js');
            if (module.UI) {
                window.UI = module.UI;
                window.UI.init();
                console.log("✅ UI Manager: Loaded");
            }
        } catch (e) {
            console.error("❌ UI Manager: MISSING or BROKEN", e);
        }

        // 3. Load Views safely
        await this._loadView('Home', './ui/views/ui-home.js');
        await this._loadView('Quiz', './ui/views/ui-quiz.js');
        await this._loadView('Results', './ui/views/ui-results.js');

        // 4. Force Boot Complete
        setTimeout(() => {
            console.log("✅ BOOT SEQUENCE FINISHED");
            const loader = document.getElementById('boot-loader');
            if (loader) loader.style.display = 'none';
            
            // Render Home Manually
            const container = document.getElementById('app-container');
            if (container) {
                container.innerHTML = `<div class="p-10 text-center text-white">
                    <h1 class="text-xl font-bold">System Diagnostics</h1>
                    <p class="text-slate-400">If you see this, the App Core is working.</p>
                    <p class="mt-4 text-sm">Check the Console (F12) to see which file failed.</p>
                    <button onclick="Main.navigate('home')" class="mt-6 px-6 py-2 bg-blue-600 rounded">Try Loading Home</button>
                </div>`;
            }
        }, 1000);
    },

    async _loadView(name, path) {
        try {
            const module = await import(path);
            const viewName = `UI${name}`;
            if (module[viewName]) {
                window[viewName] = module[viewName];
                console.log(`✅ View ${name}: Loaded`);
            }
        } catch (e) {
            console.error(`❌ View ${name}: FAILED to load from ${path}`, e);
        }
    },

    navigate(viewName) {
        console.log(`Attempting navigation to: ${viewName}`);
        const container = document.getElementById('app-container');
        
        if (viewName === 'home' && window.UIHome) window.UIHome.render(container);
        else if (viewName === 'quiz' && window.UIQuiz) window.UIQuiz.render(container);
        else if (viewName === 'results' && window.UIResults) window.UIResults.render(container);
        else alert(`View ${viewName} is not loaded properly.`);
    },
    
    // Stub for quiz start
    async selectSubject(id) {
         console.log("Selected:", id);
         this.navigate('quiz');
    }
};

window.Main = Main;
document.addEventListener('DOMContentLoaded', () => Main.init());

