/**
 * MAIN.JS (FINAL PRODUCTION ROUTER)
 * Version: 3.3.1 (Fixed Navigation Import)
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';
import { UI } from './ui/ui-manager.js'; 

// ✅ IMPORT THE HEADER (Critical Fix)
// Note: Ensure ui-header.js is actually in this folder. 
// If it's directly in 'ui', remove '/components'.
import { UIHeader } from './ui/components/ui-header.js'; // 👈 ADDED

// ✅ CORE VIEWS (Loaded Immediately)
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
import { UIReview } from './ui/views/ui-review.js'; 

// ⏳ OPTIONAL VIEWS
let UISettings, UIStats, UIArcade;

export const Main = {
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null,
        lastResult: null
    },

    // ============================================================
    // 2. INITIALIZATION
    // ============================================================
    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Connect Database
            await DB.connect();
            
            // 2. Initialize UI Shell
            if (window.UI) await window.UI.init();

            // 3. INITIALIZE HEADER (Critical Fix)
            if (UIHeader) UIHeader.init(); // 👈 ADDED

            // 4. Initialize Logic Engine
            if (MasterAggregator) MasterAggregator.init();

            // 5. Start Router
            this._initRouter();

            // 6. Initial Render
            setTimeout(() => {
                const hash = window.location.hash;
                if (!hash || hash === '#') {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                if (window.UI) UI.toggleLoader(false);
            }, 500);

            console.log("✅ ALL SYSTEMS ONLINE.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            const loader = document.getElementById('boot-loader');
            if(loader) loader.innerHTML = `
                <div class="premium-panel p-8 text-center font-bold" style="color: var(--danger)">
                    BOOT FAILURE<br>
                    <span class="text-xs opacity-70">${e.message}</span>
                </div>`;
        }
    },

    // ============================================================
    // 3. NAVIGATION (ROUTER)
    // ============================================================
    
    navigate(viewName, params = null) {
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        
        if (params) {
            if (params.subjectId) this.state.activeSubject = params.subjectId;
            if (params.id) this.state.lastResultId = params.id;
        }

        if (viewName === 'quiz') {
            history.replaceState(null, null, `#${viewName}`);
            this._handleRoute(); 
        } else {
            window.location.hash = `#${viewName}`;
        }
    },

    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    },

    async _handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const container = document.getElementById('app-container');
        
        window.scrollTo(0, 0);

        switch (hash.split('?')[0]) {
            case 'home':
                if (window.UIHome) await UIHome.render(container);
                break;
            case 'quiz':
                if (window.UIQuiz) UIQuiz.render(container);
                break;
            case 'results':
                if (window.UIResults) await UIResults.render(container);
                break;
            case 'review':
                if (window.UIReview) await UIReview.render(container);
                break;
            case 'settings':
                await this._loadAndRender('settings', './ui/views/ui-settings.js', container);
                break;
            case 'stats':
                await this._loadAndRender('stats', './ui/views/ui-stats.js', container);
                break;
            case 'arcade':
                await this._loadAndRender('arcade', './ui/views/ui-arcade.js', container);
                break;
            default:
                this.navigate('home');
        }
        
        // Update Bottom Navigation Dock
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },

    async _loadAndRender(moduleName, path, container) {
        try {
            if (moduleName === 'settings') {
                if (!UISettings) {
                    const mod = await import(path);
                    UISettings = mod.UISettings;
                }
                UISettings.render(container);
            } 
            else if (moduleName === 'stats') {
                if (!UIStats) {
                    const mod = await import(path);
                    UIStats = mod.UIStats;
                }
                UIStats.render(container);
            }
            else if (moduleName === 'arcade') {
                if (!UIArcade) {
                    const mod = await import(path);
                    UIArcade = mod.UIArcade;
                }
                UIArcade.render(container);
            }
        } catch (e) {
            console.error(`Failed to load ${moduleName}:`, e);
            UI.showToast(`Error loading ${moduleName}`, 'error');
            this.navigate('home');
        }
    },

    // ============================================================
    // 4. ACTIONS
    // ============================================================

    async selectSubject(subjectId) {
        this.state.activeSubject = subjectId;
        await this.startQuizSession(subjectId);
    },

    async startQuizSession(subjectId) {
        if (window.UI) UI.toggleLoader(true);
        try {
            await Engine.startSession(subjectId); 
            this.state.isQuizActive = true;
            this.navigate('quiz');
        } catch(e) {
            console.error("Quiz Start Failed", e);
            UI.showToast("Could not start quiz", 'error');
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    },

    handleQuizCompletion(resultData) {
        this.state.lastResult = resultData;
        this.state.lastResultId = resultData.id;
        this.state.isQuizActive = false;
        this.navigate('results', { id: resultData.id });
    },

    endQuizSession() {
        if (Engine) Engine.terminateSession();
        this.state.isQuizActive = false;
        this.navigate('home');
    },

    showResult(id) {
        this.navigate('results', { id: id });
    },

    toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

