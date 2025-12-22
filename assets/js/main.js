/**
 * MAIN.JS (THE MASTER CONTROLLER)
 * Version: 2.0.0 (Robust Worker Architecture)
 * Path: assets/js/main.js
 * Responsibilities:
 * 1. Bootstraps the application (checks DB, Workers, UI).
 * 2. Handles Hash-Based Routing (#home, #quiz, #stats).
 * 3. Manages Global State (Dark Mode, Active Subject).
 */

import { DB } from './services/db.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { UI } from './ui/ui-manager.js'; // Assumes you have a UI Manager that loads views
import { Engine } from './engine/quiz-engine.js'; // The new Engine module
import { CONFIG } from './config.js';

export const Main = {
    // ============================================================
    // 1. APPLICATION STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false, // Critical: Prevents accidental back-navigation
        userProfile: null
    },

    // ============================================================
    // 2. INITIALIZATION (BOOT SEQUENCE)
    // ============================================================
    async init() {
        console.log(`🚀 ${CONFIG.name} v${CONFIG.version} Booting System...`);

        try {
            // A. Initialize Database (The Foundation)
            await DB.connect();
            
            // B. Initialize Services (The Manager)
            MasterAggregator.init();

            // C. Load User Preferences (Theme, etc.)
            await this._loadPreferences();

            // D. Start Router (Navigation)
            this._initRouter();

            // E. Initial Render (Force Home if no hash)
            if (!window.location.hash) {
                this.navigate('home');
            } else {
                this._handleRoute(); // Handle deep link (e.g., Refresh on #stats)
            }

            console.log("✅ System Online.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            document.body.innerHTML = `<div style="padding:20px; color:red; text-align:center;">
                <h2>System Failure</h2><p>${e.message}</p>
                <button onclick="window.location.reload()">Reboot</button>
            </div>`;
        }
    },

    // ============================================================
    // 3. ROUTER (NAVIGATION)
    // ============================================================
    
    /**
     * Changes the view and updates URL hash.
     * @param {String} viewName - 'home', 'quiz', 'results', 'stats', 'arcade'
     * @param {Object} params - Optional data (e.g., subjectId for quiz)
     */
    navigate(viewName, params = null) {
        // Guard: Prevent leaving active quiz without confirmation
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession(); // Clean up timer/workers
        }

        this.state.currentView = viewName;
        
        // Save params to state if needed
        if (params && params.subjectId) {
            this.state.activeSubject = params.subjectId;
        }

        // Update Hash (triggers _handleRoute)
        // We use 'replaceState' for quiz to avoid back-button loops
        if (viewName === 'quiz') {
            history.replaceState(null, null, `#${viewName}`);
        } else {
            window.location.hash = `#${viewName}`;
        }
    },

    /**
     * Internal: Listens for Hash Changes
     */
    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    },

    async _handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const container = document.getElementById('app-container');
        
        // Scroll to top on nav
        window.scrollTo(0, 0);

        // Routing Switch
        switch (hash) {
            case 'home':
                // We use the UI module to render views
                if (window.UIHome) await UIHome.render(container);
                break;
                
            case 'quiz':
                if (window.UIQuiz) UIQuiz.render(container);
                break;
                
            case 'stats':
                if (window.UIStats) await UIStats.render(container);
                break;
                
            case 'arcade':
                if (window.UIArcade) UIArcade.render(container); // The new Arcade View
                break;
                
            case 'results':
                // Results usually need an ID, stored in a global or query param
                // For MVP, we assume the ID is passed via state or URL params (handled in Part 2)
                if (window.UIResults) await UIResults.render(container);
                break;

            case 'settings':
                if (window.UISettings) UISettings.render(container);
                break;
                
            default:
                console.warn(`Router: Unknown view ${hash}, redirecting Home.`);
                this.navigate('home');
        }
        
        // Update Bottom Dock (UIHeader) active state
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },
    // ============================================================
    // 4. QUIZ CONTROLLER (SESSION MANAGEMENT)
    // ============================================================

    /**
     * Called when a user clicks a subject tile on the Dashboard.
     * @param {String} subjectId - e.g., 'polity', 'history'
     */
    async selectSubject(subjectId) {
        console.log(`Main: Selected Subject -> ${subjectId}`);
        
        // 1. Validation: Does the subject exist in Config?
        const isPaper1 = CONFIG.subjectsGS1.some(s => s.id === subjectId);
        const isPaper2 = CONFIG.subjectsCSAT.some(s => s.id === subjectId);
        
        if (!isPaper1 && !isPaper2) {
            console.error("Invalid Subject ID");
            return;
        }

        this.state.activeSubject = subjectId;

        // 2. Open Setup Modal (Optional Step)
        // For MVP, we skip the "Select 10/20 Qs" modal and jump straight to starting the quiz.
        // In Phase 2, you can call UIModals.openSetup(subjectId) here.
        
        // 3. Start The Quiz
        await this.startQuizSession(subjectId);
    },

    /**
     * Initiates the Engine and Routing for a new test.
     */
    async startQuizSession(subjectId) {
        try {
            // A. Set Loading State (UI feedback)
            // (You could show a spinner here)
            
            // B. Handshake with Quiz Engine
            // This function (to be built in quiz-engine.js) will:
            // 1. Fetch random questions from DB.js
            // 2. Initialize the timer
            // 3. Reset internal score state
            await Engine.startSession(subjectId); 

            // C. Update State & Navigate
            this.state.isQuizActive = true;
            this.navigate('quiz');

        } catch (e) {
            console.error("Main: Failed to start quiz", e);
            alert("Error starting quiz. Please check database connection.");
        }
    },

    /**
     * Called by the Quiz Engine when time is up or user submits.
     * @param {Object} resultData - The final score object
     */
    handleQuizCompletion(resultData) {
        console.log("Main: Quiz Completed. Processing results...");
        
        this.state.isQuizActive = false; // Release the "back button" guard

        // 1. Navigate to Results View
        // We pass the result ID so the view can fetch details from DB
        // (Assuming Engine has already saved the result to DB 'history')
        this.navigate('results', { id: resultData.id });
    },

    /**
     * Emergency Exit (e.g., User clicks 'End Quiz' button)
     */
    endQuizSession() {
        console.warn("Main: Aborting Quiz Session.");
        Engine.terminateSession(); // Stop timers
        this.state.isQuizActive = false;
        this.state.activeSubject = null;
    },

    // ============================================================
    // 5. PREFERENCES & UTILITIES
    // ============================================================

    async _loadPreferences() {
        // Simple Dark Mode Logic
        // We check LocalStorage (via our DB or raw LS)
        const theme = localStorage.getItem('theme') || 'dark'; // Default to Dark
        
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Load other settings (sound, notifications) if needed
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    },

    /**
     * Helper to show a result from History (Resume functionality)
     */
    showResult(resultId) {
        this.navigate('results', { id: resultId });
    }
};

// ============================================================
// 6. GLOBAL EXPORT
// ============================================================
// We attach Main to window so HTML onclick events (like in tiles) can find it.
window.Main = Main;

// Auto-boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});
