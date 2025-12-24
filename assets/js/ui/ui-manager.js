/**
 * UI MANAGER (CRASH PROOF)
 * Version: 2.2.0 (Patched: Toast Stacking)
 * Path: assets/js/ui/ui-manager.js
 */

export const UI = {
    // We do NOT statically import UIHeader here to prevent boot crashes.
    
    async init() {
        console.log("🎨 UI: Initializing...");
        
        // 1. Dynamic Load of Header
        // This tries multiple paths. If one fails, it tries the next.
        try {
            let HeaderModule;
            try {
                // Try subfolder first
                HeaderModule = await import('./components/ui-header.js');
            } catch (e) {
                // Try same folder
                HeaderModule = await import('./ui-header.js');
            }

            if (HeaderModule && HeaderModule.UIHeader) {
                HeaderModule.UIHeader.init();
                // Attach to window so Main.js can find it
                window.UIHeader = HeaderModule.UIHeader;
            }
        } catch (e) {
            console.warn("⚠️ UIHeader could not be loaded. Navigation Dock is missing.");
        }

        this._setupGlobalClicks();
        console.log("🎨 UI: Ready.");
    },

    toggleLoader(show) {
        const loader = document.getElementById('boot-loader');
        const globalLoader = document.getElementById('global-loader');

        if (show) {
            if (globalLoader) {
                globalLoader.classList.remove('hidden');
                globalLoader.classList.add('flex');
            } else if (loader) {
                loader.style.display = 'flex';
                loader.style.opacity = '1';
            } else {
                this._createRuntimeLoader();
            }
        } else {
            if (globalLoader) {
                globalLoader.classList.add('hidden');
                globalLoader.classList.remove('flex');
            }
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }
        }
    },

    _createRuntimeLoader() {
        const div = document.createElement('div');
        div.id = 'global-loader';
        // REFACTOR: Replaced bg-slate-900/80 with neutral bg-black/80
        div.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center animate-fade-in';
        div.innerHTML = `<div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>`;
        document.body.appendChild(div);
    },

    showToast(message, type = 'info') {
        // 1. Find or Create Container (The Stacking Context)
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            // Fixed position, centers items, allows click-through
            container.className = 'fixed top-6 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none';
            document.body.appendChild(container);
        }

        // 2. Create Toast Element
        const div = document.createElement('div');
        const colors = { 
            success: 'bg-emerald-600', 
            error: 'bg-rose-600', 
            info: 'premium-card border border-white/10' 
        };
        
        // 🛡️ FIX: Removed 'fixed' positioning from individual toasts.
        // Added 'pointer-events-auto' so users can dismiss or copy text if needed.
        div.className = `px-6 py-3 rounded-full shadow-2xl text-white text-xs font-bold uppercase tracking-wide animate-slide-down pointer-events-auto ${colors[type] || colors.info}`;
        div.innerText = message;
        
        // 3. Append to Stack
        container.appendChild(div);

        // 4. Remove after delay with fade out
        setTimeout(() => {
            div.classList.add('opacity-0', 'scale-95', 'transition-all', 'duration-300'); // Smooth Exit
            setTimeout(() => div.remove(), 300); // Wait for transition
        }, 3000);
    },

    _setupGlobalClicks() {
        document.addEventListener('click', (e) => {
            // Placeholder for global modal closing logic if needed
        });
    }
};

window.UI = UI;

