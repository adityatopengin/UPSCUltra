/**
 * MAIN.JS (FINAL PRODUCTION ROUTER)
 * Version: 3.5.0 (History Stack & Deep Linking)
 * Path: assets/js/main.js
 * Responsibilities:
 * 1. Application Entry Point (Boot Sequence).
 * 2. Global Router (Navigate, GoBack, History).
 * 3. State Orchestrator (Tying Engine, UI, and DB together).
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';
import { UI } from './ui/ui-manager.js'; 

// ✅ IMPORT THE HEADER (Critical Component)
import { UIHeader } from './ui/components/ui-header.js';

// ✅ CORE VIEWS (Loaded Immediately for Critical Path)
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
import { UIReview } from './ui/views/ui-review.js'; 

// ⏳ OPTIONAL VIEWS (Lazy Loaded to save bundle size)
let UISettings, UIStats, UIArcade;

export const Main = {
    // ============================================================
    // 1. GLOBAL STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null,
        lastResult: null,
        // 🛡️ FIX: Navigation History Stack
        history: [], 
        params: {}
    },

    // ============================================================
    // 2. INITIALIZATION (BOOT SEQUENCE)
    // ============================================================
    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Connect Database
            await DB.connect();
            
            // 2. Initialize UI Manager (Loader, Toasts)
            await UI.init();
            
            // 3. Initialize Oracle (Background Worker)
            if (MasterAggregator) MasterAggregator.init();

            // 4. Initialize Data Seeder (if needed)
            if (window.DataSeeder) await window.DataSeeder.init();

            // 5. Check for Deep Links (URL Hash)
            this._handleDeepLink();

        } catch (e) {
            console.error("❌ CRITICAL BOOT FAILURE:", e);
            alert("System Error: " + e.message);
        } finally {
            // 6. Remove Boot Loader
            UI.toggleLoader(false);
        }
    },

    _handleDeepLink() {
        const hash = window.location.hash;
        
        if (hash.includes('results')) {
            const id = hash.split('?id=')[1];
            if (id) {
                this.navigate('results', { id });
                return;
            }
        }
        
        // Default Route
        this.navigate('home');
    },

    // ============================================================
    // 3. THE ROUTER (NAVIGATION ENGINE)
    // ============================================================

    /**
     * Primary method to switch screens.
     * @param {string} viewName - 'home', 'quiz', 'results', etc.
     * @param {object} params - Data to pass to the view (e.g. subjectId)
     */
    async navigate(viewName, params = {}) {
        console.log(`🧭 Router: Navigating to [${viewName}]`, params);

        const container = document.getElementById('app-container');
        if (!container) return;

        // 🛡️ FIX: Prevent navigation if Quiz is locked (Anti-Cheat)
        if (this.state.isQuizActive && viewName !== 'quiz' && viewName !== 'results') {
            if (!confirm("⚠️ Quit Exam?\n\nYour progress will be lost.")) {
                // Restore active tab to quiz
                if (window.UIHeader) UIHeader.updateActiveTab('quiz');
                return;
            }
            this.endQuizSession();
        }

        // 🛡️ FIX: Push to History Stack (unless going Home which clears stack)
        if (viewName === 'home') {
            this.state.history = []; // Root reset
        } else if (this.state.currentView !== viewName) {
            this.state.history.push({
                view: this.state.currentView,
                params: { ...this.state.params }
            });
        }

        // Update State
        this.state.currentView = viewName;
        this.state.params = params;

        // Visual Transition (Fade Out)
        container.classList.add('opacity-0', 'translate-y-4');
        
        setTimeout(async () => {
            // Scroll to top
            window.scrollTo(0, 0);

            // Render Logic
            await this._renderView(viewName, container, params);
            
            // Update Dock
            if (window.UIHeader) UIHeader.updateActiveTab(viewName);

            // Visual Transition (Fade In)
            container.classList.remove('opacity-0', 'translate-y-4');
        }, 200);
    },

    /**
     * 🛡️ FIX: The "Back" Button Handler
     * Restores previous state from history stack.
     */
    goBack() {
        if (this.state.history.length === 0) {
            this.navigate('home');
            return;
        }

        const prevState = this.state.history.pop();
        
        // Direct navigation skipping the history push
        this.state.currentView = prevState.view;
        this.state.params = prevState.params;

        const container = document.getElementById('app-container');
        
        // Fast Render (No animation lag for back)
        this._renderView(prevState.view, container, prevState.params);
        if (window.UIHeader) UIHeader.updateActiveTab(prevState.view);
    },

    // ============================================================
    // 4. VIEW RENDERER (THE SWITCHBOARD)
    // ============================================================

    async _renderView(viewName, container, params) {
        switch (viewName) {
            case 'home':
                await UIHome.render(container);
                break;

            case 'quiz':
                await UIQuiz.render(container);
                break;

            case 'results':
                await UIResults.render(container);
                break;

            case 'review':
                await UIReview.render(container);
                break;

            // ⏳ LAZY LOADED VIEWS
            case 'stats':
                if (!UIStats) UIStats = (await import('./ui/views/ui-stats.js')).UIStats;
                await UIStats.render(container);
                break;

            case 'settings':
                if (!UISettings) UISettings = (await import('./ui/views/ui-settings.js')).UISettings;
                await UISettings.render(container);
                break;

            case 'arcade':
                if (!UIArcade) UIArcade = (await import('./ui/views/ui-arcade.js')).UIArcade;
                await UIArcade.render(container);
                break;

            default:
                console.warn(`Router: Unknown view [${viewName}]`);
                this.navigate('home');
        }
    },

    // ============================================================
    // 5. DOMAIN ACTIONS (QUIZ CONTROL)
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
            if (window.UI) UI.showToast("Could not start quiz. Database empty?", 'error');
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    },

    handleQuizCompletion(resultData) {
        this.state.lastResult = resultData;
        this.state.lastResultId = resultData.id;
        this.state.isQuizActive = false;
        // Replace history so "Back" doesn't go to Quiz
        this.state.history = [{ view: 'home', params: {} }]; 
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

// Global Exposure for Inline HTML Events
window.Main = Main;

// Boot Trigger
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

