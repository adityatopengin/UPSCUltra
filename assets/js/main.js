/**
 * MAIN.JS (THE MASTER CONTROLLER)
 * Version: 2.1.0 (Patched for Stability)
 * Path: assets/js/main.js
 * Responsibilities:
 * 1. Bootstraps the application (checks DB, Workers, UI).
 * 2. Handles Hash-Based Routing (#home, #quiz, #stats).
 * 3. Manages Global State (Dark Mode, Active Subject).
 */

import { DB } from './services/db.js';
import { DataSeeder } from './services/data-seeder.js'; 
import { MasterAggregator } from './services/master-aggregator.js';
import { UI } from './ui/ui-manager.js';
import { Engine } from './engine/quiz-engine.js';
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

        // GLOBAL ERROR TRAP (Catches unhandled promises)
        window.addEventListener('unhandledrejection', event => {
            console.warn("Async Warning:", event.reason);
            // We don't block the UI for warnings, but we log them.
        });

        try {
            // 1. Initialize Database (The Foundation)
            await DB.connect();
            
            // 2. RUN GENESIS: Seed Database if empty
            if (window.DataSeeder) {
                await DataSeeder.init();
            } else {
                 console.warn("DataSeeder not loaded. Skipping genesis.");
            }
            
            // 3. Initialize Services (The Manager)
            // We check if MasterAggregator is loaded to avoid crash
            if (MasterAggregator && MasterAggregator.init) {
                MasterAggregator.init();
            }

            // 4. Initialize UI Shell (Header/Background)
            if (window.UI) {
                window.UI.init();
            }

            // 5. Load User Preferences (Theme, etc.)
            await this._loadPreferences();

            // 6. Start Router (Navigation)
            this._initRouter();

            // 7. Initial Render
            // We use a small timeout to ensure the DOM is fully painted
            setTimeout(() => {
                if (!window.location.hash) {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                // CRITICAL: Remove Loader only after render is attempted
                const loader = document.getElementById('boot-loader');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 500);
                }
            }, 100);

            console.log("✅ System Online.");

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            // Emergency Error UI
            document.body.innerHTML = `
                <div style="padding:40px; color:#f43f5e; text-align:center; font-family:sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#0f172a;">
                    <div style="font-size:40px; margin-bottom:20px;">⚠️</div>
                    <h2 style="font-size:2rem; margin-bottom:10px; font-weight:900;">SYSTEM FAILURE</h2>
                    <p style="opacity:0.8; max-width:300px; margin:0 auto;">${e.message}</p>
                    <button onclick="window.location.reload()" style="margin-top:30px; padding:12px 24px; background:#3b82f6; color:#fff; border:none; border-radius:12px; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(59,130,246,0.3);">
                        REBOOT SYSTEM
                    </button>
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

        // ZOMBIE FIX: Clean up Arcade loop if we are leaving it
        // This prevents the game loop from running in background
        if (this.state.currentView === 'arcade' && viewName !== 'arcade') {
            if (window.UIArcade && window.UIArcade.quitGame) {
                window.UIArcade.quitGame();
            }
        }

        this.state.currentView = viewName;
        
        // Save params to state if needed
        if (params && params.subjectId) {
            this.state.activeSubject = params.subjectId;
        }
        // Save result ID for the results view
        if (params && params.id) {
            this.state.lastResultId = params.id;
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
        // We check if the View Module is loaded globally before calling render
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
        // We need robust checking here to prevent undefined errors
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        
        const isPaper1 = gs1.some(s => s.id === subjectId);
        const isPaper2 = csat.some(s => s.id === subjectId);
        
        if (!isPaper1 && !isPaper2) {
            console.error("Invalid Subject ID");
            return;
        }

        this.state.activeSubject = subjectId;
        
        // 2. Start The Quiz
        // In V2 we skip the modal and go straight to action
        await this.startQuizSession(subjectId);
    },

    /**
     * Initiates the Engine and Routing for a new test.
     */
    async startQuizSession(subjectId) {
        try {
            // A. Set Loading State (UI feedback)
            if (window.UI) UI.toggleLoader(true);
            
            // B. Handshake with Quiz Engine
            if (Engine) {
                await Engine.startSession(subjectId); 

                // C. Update State & Navigate
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
        this.navigate('results', { id: resultData.id });
    },

    /**
     * Emergency Exit (e.g., User clicks 'End Quiz' button)
     */
    endQuizSession() {
        console.warn("Main: Aborting Quiz Session.");
        
        // Safety check before calling Engine methods
        if (Engine && Engine.terminateSession) {
            Engine.terminateSession(); // Stop timers
        }
        
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
        
        // Optional: Notify UI to update if needed
        if (window.UISettings) UISettings.render(document.getElementById('app-container'));
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
    // We already have a safety trap in index.html, but this is the standard entry
    Main.init();
});

