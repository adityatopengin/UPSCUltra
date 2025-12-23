/**
 * MAIN.JS (FINAL PRODUCTION BUILD)
 * Version: 3.0.0
 * All systems active: Dashboard, Quiz, Results, and Logic.
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';

// ✅ UNCOMMENTING ALL VIEWS
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
// We use conditional loading for Stats/Arcade/Settings to be safe
// import { UIStats } from './ui/views/ui-stats.js'; 

export const Main = {
    // ============================================================
    // 1. APPLICATION STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null
    },

    // ============================================================
    // 2. BOOT SEQUENCE
    // ============================================================
    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Database & Config
            await DB.connect();
            
            // 2. Logic Layer
            if (MasterAggregator) MasterAggregator.init();

            // 3. UI Shell
            if (window.UI) window.UI.init();

            // 4. Preferences
            this._loadPreferences();

            // 5. Router
            this._initRouter();

            // 6. Initial Render
            // Short delay to ensure DOM is painted
            setTimeout(() => {
                if (!window.location.hash) {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                // Hide Boot Loader
                const loader = document.getElementById('boot-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 500);
                }
            }, 100);

            console.log("✅ ALL SYSTEMS ONLINE.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            alert("System Error: " + e.message);
        }
    },

    // ============================================================
    // 3. ROUTER (NAVIGATION)
    // ============================================================
    
    navigate(viewName, params = null) {
        // Safety Guard for Active Quiz
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        
        if (params && params.subjectId) {
            this.state.activeSubject = params.subjectId;
        }
        if (params && params.id) {
            this.state.lastResultId = params.id;
        }

        // Update URL Hash
        if (viewName === 'quiz') {
            history.replaceState(null, null, `#${viewName}`);
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

        // ROUTING TABLE
        switch (hash) {
            case 'home':
                if (window.UIHome) await UIHome.render(container);
                break;
                
            case 'quiz':
                if (window.UIQuiz) UIQuiz.render(container);
                break;
                
            case 'results':
                if (window.UIResults) await UIResults.render(container);
                break;

            case 'stats':
                // Check if Stats loaded, else safe fallback
                if (window.UIStats) await UIStats.render(container);
                else {
                    container.innerHTML = "<h2 class='p-10 text-center text-slate-500'>Stats Module Loading...</h2>";
                    // Lazy load functionality could go here
                }
                break;
                
            default:
                console.warn(`Router: Unknown view ${hash}, redirecting Home.`);
                this.navigate('home');
        }
        
        // Update Bottom Dock Active State
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },

    // ============================================================
    // 4. QUIZ CONTROLLER
    // ============================================================

    async selectSubject(subjectId) {
        console.log(`Main: Starting Quiz for -> ${subjectId}`);
        
        // Validate Subject ID
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        const isValid = gs1.some(s => s.id === subjectId) || csat.some(s => s.id === subjectId);
        
        if (!isValid) {
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
            alert("Error starting quiz.");
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    },

    handleQuizCompletion(resultData) {
        console.log("Main: Quiz Completed. Results:", resultData);
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
    },

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
    },

    showResult(resultId) {
        this.navigate('results', { id: resultId });
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

