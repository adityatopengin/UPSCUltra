/**
 * UI MANAGER (THE DIRECTOR)
 * Version: 2.0.0
 * Path: assets/js/ui/ui-manager.js
 * Responsibilities:
 * 1. Centralizes imports for all UI Views (ensuring they register with window).
 * 2. Manages the "App Shell" (Header, Background, Modals).
 * 3. Provides global UI utilities (Toast notifications, Loaders).
 */

// 1. IMPORT SHARED COMPONENTS
import { UIHeader } from './components/ui-header.js';
import { UIOracle } from './components/ui-oracle.js';

// 2. IMPORT VIEWS (Side-effect imports to register window.UIHome, etc.)
// We import these here so Main.js doesn't need to import every single view.
import { UIHome } from './views/ui-home.js';
import { UIQuiz } from './views/ui-quiz.js';
import { UIResults } from './views/ui-results.js';
// import { UIArcade } from './views/ui-arcade.js'; // (Coming Phase 2)
// import { UIStats } from './views/ui-stats.js';   // (Coming Phase 2)

export const UI = {
    // ============================================================
    // 1. INITIALIZATION
    // ============================================================
    
    /**
     * Called by Main.js during boot.
     * Sets up the static parts of the page (Header, Background).
     */
    init() {
        console.log("🎨 UI: Initializing App Shell...");

        // A. Render the Global Header (Bottom Dock / Top Bar)
        // We look for a dedicated header container or prepend it to body
        this._setupShell();

        // B. Initialize the Oracle (Background Animation)
        if (UIOracle) {
            UIOracle.init();
        }

        // C. Initialize Header Logic
        if (UIHeader) {
            UIHeader.init();
        }

        console.log("🎨 UI: Shell Ready.");
    },

    /**
     * Creates the structural HTML if missing from index.html
     */
    _setupShell() {
        // Ensure we have the main app container
        let app = document.getElementById('app-container');
        if (!app) {
            app = document.createElement('div');
            app.id = 'app-container';
            app.className = 'view-container min-h-screen bg-slate-900 text-slate-200 font-sans pb-20'; // pb-20 for bottom dock space
            document.body.prepend(app);
        }

        // We don't render the header *inside* app-container usually,
        // because the container might get cleared by the Router.
        // The Header (UIHeader) usually injects itself into fixed positions.
    },
    // ============================================================
    // 2. GLOBAL UTILITIES (Feedback & Notifications)
    // ============================================================

    /**
     * Shows a temporary notification at the top of the screen.
     * @param {String} message - Text to display
     * @param {String} type - 'success', 'error', 'info'
     */
    showToast(message, type = 'info') {
        const id = `toast-${Date.now()}`;
        
        // Colors
        const colors = {
            success: 'bg-emerald-500 text-white',
            error: 'bg-rose-500 text-white',
            info: 'bg-blue-500 text-white',
            warning: 'bg-amber-500 text-white'
        };
        const colorClass = colors[type] || colors.info;

        // Create Element
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-slide-down ${colorClass}`;
        
        toast.innerHTML = `
            <span class="text-sm font-bold tracking-wide">${message}</span>
        `;

        document.body.appendChild(toast);

        // Auto Remove
        setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-4'); // Exit animation
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    /**
     * Toggles a full-screen blocking loader.
     * @param {Boolean} show - True to show, False to hide
     */
    toggleLoader(show) {
        let loader = document.getElementById('global-loader');
        
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'global-loader';
                loader.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center';
                loader.innerHTML = `
                    <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div class="mt-4 text-xs font-bold text-blue-400 uppercase tracking-widest animate-pulse">Processing...</div>
                `;
                document.body.appendChild(loader);
            }
            loader.classList.remove('hidden');
        } else {
            if (loader) loader.classList.add('hidden');
        }
    },

    // ============================================================
    // 3. THEME & SETTINGS
    // ============================================================

    /**
     * Updates the UI based on user preferences.
     * Called by Main.js on boot or Settings change.
     */
    applyTheme(themeName) {
        const root = document.documentElement;
        if (themeName === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }
};

// Global Exposure
window.UI = UI;
