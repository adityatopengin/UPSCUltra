/**
 * UI-HEADER (THE NAVIGATOR)
 * Version: 2.0.0
 * Path: assets/js/ui/components/ui-header.js
 * Responsibilities:
 * 1. Renders the persistent Bottom Navigation Dock.
 * 2. Manages the "Active Tab" state (highlighting the current view).
 * 3. Handles top-level navigation actions.
 */

export const UIHeader = {
    // ============================================================
    // 1. INITIALIZATION
    // ============================================================

    init() {
        console.log("🧭 UIHeader: Mounting Navigation System...");
        
        // 1. Check if header exists, else create it
        // We inject it directly into the body to ensure it stays outside the #app-container
        if (!document.getElementById('main-nav')) {
            const nav = document.createElement('nav');
            nav.id = 'main-nav';
            nav.className = 'fixed bottom-0 left-0 w-full z-50 pointer-events-none'; // Pointer events handled by children
            nav.innerHTML = this._getDockTemplate();
            document.body.appendChild(nav);
        }

        // 2. Initialize Listeners
        this._bindEvents();
    },

    // ============================================================
    // 2. TEMPLATE: BOTTOM DOCK
    // ============================================================

    _getDockTemplate() {
        return `
        <div class="pointer-events-auto absolute bottom-4 left-4 right-4 h-16 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center justify-around px-2">
            
            <button onclick="Main.navigate('home')" data-tab="home" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/5 active:scale-95 transition-all relative group">
                <i class="fa-solid fa-house text-xl transition-colors group-[.active]:text-blue-400"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full bg-blue-400 opacity-0 transition-all group-[.active]:opacity-100"></span>
            </button>

            <button onclick="Main.navigate('arcade')" data-tab="arcade" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/5 active:scale-95 transition-all relative group">
                <i class="fa-solid fa-gamepad text-xl transition-colors group-[.active]:text-purple-400"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full bg-purple-400 opacity-0 transition-all group-[.active]:opacity-100"></span>
            </button>

            <button onclick="Main.navigate('stats')" data-tab="stats" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/5 active:scale-95 transition-all relative group">
                <i class="fa-solid fa-chart-pie text-xl transition-colors group-[.active]:text-emerald-400"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-400 opacity-0 transition-all group-[.active]:opacity-100"></span>
            </button>

            <button onclick="Main.navigate('settings')" data-tab="settings" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/5 active:scale-95 transition-all relative group">
                <i class="fa-solid fa-user-gear text-xl transition-colors group-[.active]:text-amber-400"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full bg-amber-400 opacity-0 transition-all group-[.active]:opacity-100"></span>
            </button>

        </div>
        `;
    },
    // ============================================================
    // 3. STATE MANAGEMENT
    // ============================================================

    _bindEvents() {
        // Future-proofing: If we want to hide the dock on scroll down
        // window.addEventListener('scroll', () => ... );
    },

    /**
     * Updates the highlighted tab based on the current view.
     * Called by Main.js router.
     * @param {String} viewName - 'home', 'stats', 'arcade', etc.
     */
    updateActiveTab(viewName) {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        // 1. Reset all tabs
        const buttons = nav.querySelectorAll('.nav-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        // 2. Map view names to tab IDs
        // (e.g., 'quiz' view shouldn't highlight 'home', or maybe it hides the dock)
        let activeTab = viewName;
        
        // Edge Case: If in 'quiz' or 'results', usually we hide the dock
        // But if we want to keep it, we might map 'quiz' -> 'home' or nothing.
        if (viewName === 'quiz' || viewName === 'results') {
            this.toggle(false); // Hide dock during test
            return;
        } else {
            this.toggle(true); // Show dock otherwise
        }

        // 3. Highlight active tab
        const targetBtn = nav.querySelector(`[data-tab="${activeTab}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    },

    /**
     * Shows or Hides the bottom dock.
     * @param {Boolean} visible 
     */
    toggle(visible) {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        if (visible) {
            nav.classList.remove('translate-y-24', 'opacity-0');
            nav.classList.add('translate-y-0', 'opacity-100');
        } else {
            nav.classList.add('translate-y-24', 'opacity-0');
            nav.classList.remove('translate-y-0', 'opacity-100');
        }
    }
};

// Global Exposure
window.UIHeader = UIHeader;
