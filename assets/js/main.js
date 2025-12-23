/**
 * MAIN.JS (FINAL PRODUCTION BUILD)
 * Version: 3.1.0
 * Responsibilities:
 * 1. Bootstraps the Application (DB, Services, UI).
 * 2. Manages Global State (User, Theme, Quiz Status).
 * 3. Handles Routing (Home <-> Quiz <-> Results <-> Review).
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';

// ✅ UI MANAGERS
import { UI } from './ui/ui-manager.js'; 

// ✅ VIEW CONTROLLERS
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
import { UIReview } from './ui/views/ui-review.js'; // The new Review Module

// Optional: Lazy load others if needed
// import { UIStats } from './ui/views/ui-stats.js'; 

export const Main = {
    // ============================================================
    // 1. APPLICATION STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null,
        lastResult: null // Critical: Holds data in memory for fast access
    },

    // ============================================================
    // 2. BOOT SEQUENCE
    // ============================================================
    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Database & Config
            await DB.connect();
            
            // 2. Logic Layer (The Brain)
            if (MasterAggregator) MasterAggregator.init();

            // 3. UI Shell (The Body)
            if (window.UI) window.UI.init();

            // 4. Preferences (Theme)
            this._loadPreferences();

            // 5. Router (The Legs)
            this._initRouter();

            // 6. Initial Render
            // Short delay to ensure DOM is painted and Shell is ready
            setTimeout(() => {
                if (!window.location.hash) {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                // Hide Boot Loader with Fade Out
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
        // Safety Guard: Don't leave a live quiz without warning
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        
        // Handle Params
        if (params) {
            if (params.subjectId) this.state.activeSubject = params.subjectId;
            if (params.id) this.state.lastResultId = params.id;
        }

        // Update URL & TRIGGER RENDER
        if (viewName === 'quiz') {
            // replaceState is silent, so we must manually kick the router
            history.replaceState(null, null, `#${viewName}`);
            this._handleRoute(); 
        } else {
            // Normal navigation triggers 'hashchange' automatically
            window.location.hash = `#${viewName}`;
            // If URL is already there (refresh/same click), force render
            if (window.location.hash === `#${viewName}`) {
                this._handleRoute();
            }
        }
    },

    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    },

    async _handleRoute() {
        // Parse Hash: "#results?id=123" -> "results"
        const cleanHash = window.location.hash.split('?')[0].replace('#', '') || 'home';
        const container = document.getElementById('app-container');
        
        // Scroll to top on nav
        window.scrollTo(0, 0);

        // ROUTING TABLE
        switch (cleanHash) {
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
                // ✅ NEW ROUTE
                if (window.UIReview) await UIReview.render(container);
                break;

            case 'stats':
                // Check if Stats loaded, else safe fallback
                if (window.UIStats) await UIStats.render(container);
                else {
                    container.innerHTML = "<h2 class='p-10 text-center text-slate-500'>Stats Module Loading...</h2>";
                }
                break;
                
            default:
                console.warn(`Router: Unknown view ${cleanHash}, redirecting Home.`);
                this.navigate('home');
        }
        
        // Update Bottom Dock Active State (Home/Stats/etc.)
        if (window.UIHeader) UIHeader.updateActiveTab(cleanHash);
    },

    // ============================================================
    // 4. QUIZ CONTROLLER
    // ============================================================

    async selectSubject(subjectId) {
        console.log(`Main: Starting Quiz for -> ${subjectId}`);
        
        // Validate Subject ID against Config
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        const isValid = gs1.some(s => s.id === subjectId) || csat.some(s => s.id === subjectId);
        
        if (!isValid) {
            console.error("Invalid Subject ID");
            return; // Fail silently or show toast
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
            alert("Error starting quiz. Please reload.");
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    },

    handleQuizCompletion(resultData) {
        console.log("Main: Quiz Completed. Results:", resultData);
        
        // 1. Store in Memory (Critical Safety Net)
        // If DB save is slow, UIResults can reads this immediately
        this.state.lastResult = resultData;
        this.state.lastResultId = resultData.id;
        
        this.state.isQuizActive = false;
        
        // 2. Navigate to Results
        this.navigate('results', { id: resultData.id });
    },

    endQuizSession() {
        console.warn("Main: Aborting Quiz Session.");
        if (Engine && Engine.terminateSession) {
            Engine.terminateSession();
        }
        this.state.isQuizActive = false;
        this.state.activeSubject = null;
        this.navigate('home');
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

// Global Export
window.Main = Main;

// Auto-boot
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

