/**
 * UI MANAGER (THE SKIN)
 * Version: 3.0.0
 * Path: assets/js/ui/ui-manager.js
 * Responsibilities:
 * 1. Manages the Global Loader (Spinner).
 * 2. Handles Global Toasts/Notifications.
 * 3. Initializes the App Shell (Header/Dock).
 * * NOTE: View imports (UIHome, UIQuiz) have been moved to Main.js 
 * to prevent circular dependencies and loading errors.
 */

import { UIHeader } from './components/ui-header.js';

export const UI = {
    // ============================================================
    // 1. INITIALIZATION
    // ============================================================
    init() {
        console.log("🎨 UI: Initializing App Shell...");
        
        // 1. Initialize Header (Navigation Dock)
        if (UIHeader && UIHeader.init) {
            UIHeader.init();
        }

        // 2. Bind Global Clicks (e.g., closing modals on outside click)
        document.addEventListener('click', (e) => {
            // Future logic to close dropdowns/modals can go here
            const modals = document.querySelectorAll('.auto-close-modal');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        });

        console.log("🎨 UI: Shell Ready.");
    },

    // ============================================================
    // 2. LOADERS & SPINNERS
    // ============================================================

    /**
     * Toggles the loading state. 
     * Handles both the startup #boot-loader and the runtime #global-loader.
     */
    toggleLoader(show) {
        // The runtime loader (created dynamically if needed)
        let runtimeLoader = document.getElementById('global-loader');
        // The static HTML loader (used during boot)
        const bootLoader = document.getElementById('boot-loader');

        if (show) {
            // Hiding boot loader? No, we keep it if it's there, or show runtime
            if (bootLoader && bootLoader.style.display !== 'none') {
                return; // Boot loader is already visible
            }

            if (!runtimeLoader) {
                this._createRuntimeLoader();
                runtimeLoader = document.getElementById('global-loader');
            }
            runtimeLoader.classList.remove('hidden');
            runtimeLoader.classList.add('flex');
        } else {
            // HIDE ALL LOADERS
            if (runtimeLoader) {
                runtimeLoader.classList.add('hidden');
                runtimeLoader.classList.remove('flex');
            }
            
            if (bootLoader) {
                bootLoader.style.opacity = '0';
                setTimeout(() => {
                    bootLoader.style.display = 'none';
                }, 500);
            }
        }
    },

    _createRuntimeLoader() {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center hidden animate-fade-in';
        loader.innerHTML = `
            <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="mt-4 text-xs font-bold text-blue-400 uppercase tracking-widest animate-pulse">Processing...</div>
        `;
        document.body.appendChild(loader);
    },

    // ============================================================
    // 3. NOTIFICATIONS (TOASTS)
    // ============================================================

    showToast(message, type = 'info') {
        // Create container if missing
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }

        // Define Colors
        const colors = {
            success: 'bg-emerald-500 text-white shadow-emerald-500/20',
            error:   'bg-rose-500 text-white shadow-rose-500/20',
            info:    'bg-slate-800 text-white border border-white/10 shadow-black/20',
            warning: 'bg-amber-500 text-white shadow-amber-500/20'
        };

        const bgClass = colors[type] || colors.info;
        
        // Icons
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-triangle-exclamation';
        if (type === 'warning') icon = 'fa-bell';

        // Create Toast Element
        const toast = document.createElement('div');
        toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-xl text-xs font-bold uppercase tracking-wide animate-slide-in flex items-center gap-3 min-w-[220px] pointer-events-auto transform transition-all duration-300`;
        
        toast.innerHTML = `
            <i class="fa-solid ${icon} text-lg"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove after 3s
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ============================================================
    // 4. THEME & UTILS
    // ============================================================

    applyTheme(themeName) {
        const root = document.documentElement;
        if (themeName === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }
};

// Global Export
window.UI = UI;

