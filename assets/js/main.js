/**
 * MAIN.JS (FINAL PRODUCTION)
 * Version: 4.0.0
 * Status: All Systems Go
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';
import { UI } from './ui/ui-manager.js'; 

// View Imports
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
import { UIReview } from './ui/views/ui-review.js';
import { UISettings } from './ui/views/ui-settings.js';
import { UIArcade } from './ui/views/ui-arcade.js';
import { UIStats } from './ui/views/ui-stats.js';

export const Main = {
    // ============================================================
    // 1. STATE
    // ============================================================
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
            // 1. Database & UI Shell
            await DB.connect();
            if (window.UI) await window.UI.init();

            // 2. Logic Engines
            if (MasterAggregator) MasterAggregator.init();

            // 3. Router
            this._initRouter();

            // 4. Initial Render
            // Short delay to ensure DOM is ready
            setTimeout(() => {
                // If the URL has a hash (e.g. #quiz), go there. Otherwise Home.
                const hash = window.location.hash;
                if (!hash || hash === '#') {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                // Hide Boot Loader
                if (window.UI) UI.toggleLoader(false);
                
                // Remove Debugger if it exists
                const dbg = document.getElementById('debug-box');
                if (dbg) dbg.remove();

            }, 500);

            console.log("✅ ALL SYSTEMS ONLINE.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            alert("App Start Failed: " + e.message);
        }
    },

    // ============================================================
    // 3. NAVIGATION (ROUTER)
    // ============================================================
    
    navigate(viewName, params = null) {
        // Safety: Prevent accidental exit during quiz
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        
        if (params) {
            if (params.subjectId) this.state.activeSubject = params.subjectId;
            if (params.id) this.state.lastResultId = params.id;
        }

        // Update URL
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
        
        // Scroll to top
        window.scrollTo(0, 0);

        // ROUTING TABLE
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
                if (window.UISettings) UISettings.render(container);
                break;

            case 'arcade':
                if (window.UIArcade) UIArcade.render(container);
                break;

            case 'stats':
                if (window.UIStats) await UIStats.render(container);
                break;
                
            default:
                this.navigate('home');
        }
        
        // Update Bottom Dock
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },

    // ============================================================
    // 4. ACTIONS
    // ============================================================

    // --- QUIZ ---
    async selectSubject(subjectId) {
        this.state.activeSubject = subjectId;
        await this.startQuizSession(subjectId);
    },

    async startQuizSession(subjectId) {
        if (window.UI) UI.toggleLoader(true);
        await Engine.startSession(subjectId); 
        this.state.isQuizActive = true;
        this.navigate('quiz');
        if (window.UI) UI.toggleLoader(false);
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

    // --- UTILS ---
    showResult(id) {
        this.navigate('results', { id: id });
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if(window.UI) UI.showToast(isDark ? "Dark Mode Active" : "Light Mode Active");
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

