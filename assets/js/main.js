/**
 * MAIN.JS (THE MASTER CONTROLLER)
 * Version: 2.1.0 (Stable Build)
 * Path: assets/js/main.js
 */

import { DB } from './services/db.js';
import { DataSeeder } from './services/data-seeder.js'; 
import { MasterAggregator } from './services/master-aggregator.js';
// We don't import UI to avoid circular deps, we use window.UI
import { Engine } from './engine/quiz-engine.js';
import { CONFIG } from './config.js';

export const Main = {
    // ============================================================
    // 1. APPLICATION STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        userProfile: null,
        lastResultId: null
    },

    // ============================================================
    // 2. INITIALIZATION (BOOT SEQUENCE)
    // ============================================================
    async init() {
        console.log(`🚀 ${CONFIG.name} v${CONFIG.version} Booting System...`);

        window.addEventListener('unhandledrejection', event => {
            console.warn("Async Warning:", event.reason);
        });

        try {
            // 1. Initialize Database
            await DB.connect();
            
            // 2. Seed Database if needed
            if (window.DataSeeder) {
                await DataSeeder.init();
            } else {
                 console.warn("DataSeeder not loaded.");
            }
            
            // 3. Initialize Services
            if (MasterAggregator && MasterAggregator.init) {
                MasterAggregator.init();
            }

            // 4. Initialize UI Shell
            if (window.UI) {
                window.UI.init();
            }

            // 5. Load Preferences
            await this._loadPreferences();

            // 6. Start Router
            this._initRouter();

            // 7. Initial Render
            setTimeout(() => {
                if (!window.location.hash) {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                const loader = document.getElementById('boot-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 500);
                }
            }, 100);

            console.log("✅ System Online.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            document.body.innerHTML = `
                <div style="padding:40px; color:#f43f5e; text-align:center; background:#0f172a; height:100vh;">
                    <h2>⚠️ SYSTEM FAILURE</h2>
                    <p>${e.message}</p>
                    <button onclick="window.location.reload()" style="margin-top:20px; padding:10px; background:#333; color:white;">RETRY</button>
                </div>`;
        }
    }, // <--- CHECK: Comma closing init()

    // ============================================================
    // 3. ROUTER (NAVIGATION)
    // ============================================================
    
    navigate(viewName, params = null) {
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        if (this.state.currentView === 'arcade' && viewName !== 'arcade') {
            if (window.UIArcade && window.UIArcade.quitGame) {
                window.UIArcade.quitGame();
            }
        }

        this.state.currentView = viewName;
        
        if (params && params.subjectId) {
            this.state.activeSubject = params.subjectId;
        }
        if (params && params.id) {
            this.state.lastResultId = params.id;
        }

        if (viewName === 'quiz') {
            history.replaceState(null, null, `#${viewName}`);
        } else {
            window.location.hash = `#${viewName}`;
        }
    },

    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    }, // <--- CHECK: Comma closing _initRouter()

    async _handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const container = document.getElementById('app-container');
        
        window.scrollTo(0, 0);

        switch (hash) {
            case 'home':
                if (window.UIHome) await UIHome.render(container);
                break;
            case 'quiz':
                if (window.UIQuiz) UIQuiz.render(container);
                break;
            case 'stats':
                if (window.UIStats) await UIStats.render(container);
                break;
            case 'arcade':
                if (window.UIArcade) UIArcade.render(container);
                break;
            case 'results':
                if (window.UIResults) await UIResults.render(container);
                break;
            case 'settings':
                if (window.UISettings) UISettings.render(container);
                break;
            default:
                console.warn(`Router: Unknown view ${hash}, redirecting Home.`);
                this.navigate('home');
        }
        
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    }, // <--- CHECK: Comma closing _handleRoute()

    // ============================================================
    // 4. QUIZ CONTROLLER
    // ============================================================

    async selectSubject(subjectId) {
        console.log(`Main: Selected Subject -> ${subjectId}`);
        
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        
        const isPaper1 = gs1.some(s => s.id === subjectId);
        const isPaper2 = csat.some(s => s.id === subjectId);
        
        if (!isPaper1 && !isPaper2) {
            console.error("Invalid Subject ID");
            return;
        }

        this.state.activeSubject = subjectId;
        await this.startQuizSession(subjectId);
    },

    async startQuizSession(subjectId) {
        try {
            if (window.UI) UI.toggleLoader(true);
            
            if (Engine) {
                await Engine.startSession(subjectId); 
                this.state.isQuizActive = true;
                this.navigate('quiz');
            } else {
                throw new Error("Quiz Engine not loaded");
            }

        } catch (e) {
            console.error("Main: Failed to start quiz", e);
            alert("Error starting quiz. Please check database connection.");
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    }, // <--- CHECK: Comma closing startQuizSession()

    handleQuizCompletion(resultData) {
        console.log("Main: Quiz Completed.");
        this.state.isQuizActive = false;
        this.navigate('results', { id: resultData.id });
    },

    endQuizSession() {
        console.warn("Main: Aborting Quiz Session.");
        if (Engine && Engine.terminateSession) {
            Engine.terminateSession();
        }
        this.state.isQuizActive = false;
        this.state.activeSubject = null;
    }, // <--- CHECK: Comma closing endQuizSession()

    // ============================================================
    // 5. UTILITIES
    // ============================================================

    async _loadPreferences() {
        const theme = localStorage.getItem('theme') || 'dark';
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if (window.UISettings) UISettings.render(document.getElementById('app-container'));
    },

    showResult(resultId) {
        this.navigate('results', { id: resultId });
    }
};

// Global Export
window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

