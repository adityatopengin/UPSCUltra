/**
 * UI-HEADER (THE NAVIGATOR)
 * Version: 2.3.0 (Patched: Dual Theme Support)
 * Path: assets/js/ui/components/ui-header.js
 * Responsibilities:
 * 1. Renders the persistent Bottom Navigation Dock.
 * 2. Manages the "Active Tab" state (highlighting the current view).
 * 3. Hides automatically during Quizzes to prevent distraction.
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
            // Structural classes + transitions for toggle logic (Slide Up/Down)
            nav.className = 'fixed bottom-6 left-4 right-4 z-50 flex justify-around transition-transform duration-300 ease-out'; 
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
        // Updated container with adaptive background (White Glass vs Dark Glass)
        return `
        <div class="premium-nav pointer-events-auto w-full h-16 flex items-center justify-around px-2 shadow-2xl rounded-2xl bg-white/90 dark:bg-black/20 backdrop-blur-xl border border-slate-200 dark:border-white/5 transition-all duration-300">
            
            <button onclick="Main.navigate('home')" data-tab="home" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all relative group">
                <i class="fa-solid fa-house text-xl text-slate-400 dark:text-slate-500 group-[.active]:text-blue-600 dark:group-[.active]:text-blue-400 transition-colors"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full opacity-0 transition-all group-[.active]:opacity-100 bg-blue-600 dark:bg-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)] dark:shadow-[0_0_8px_#60a5fa]"></span>
            </button>

            <button onclick="Main.navigate('arcade')" data-tab="arcade" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all relative group">
                <i class="fa-solid fa-gamepad text-xl text-slate-400 dark:text-slate-500 group-[.active]:text-purple-600 dark:group-[.active]:text-purple-400 transition-colors"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full opacity-0 transition-all group-[.active]:opacity-100 bg-purple-600 dark:bg-purple-400 shadow-[0_0_8px_rgba(147,51,234,0.5)] dark:shadow-[0_0_8px_#c084fc]"></span>
            </button>

            <button onclick="Main.navigate('stats')" data-tab="stats" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all relative group">
                <i class="fa-solid fa-chart-pie text-xl text-slate-400 dark:text-slate-500 group-[.active]:text-emerald-600 dark:group-[.active]:text-emerald-400 transition-colors"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full opacity-0 transition-all group-[.active]:opacity-100 bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] dark:shadow-[0_0_8px_#34d399]"></span>
            </button>

            <button onclick="Main.navigate('settings')" data-tab="settings" class="nav-btn w-12 h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all relative group">
                <i class="fa-solid fa-sliders text-xl text-slate-400 dark:text-slate-500 group-[.active]:text-amber-600 dark:group-[.active]:text-amber-400 transition-colors"></i>
                <span class="absolute -bottom-1 w-1 h-1 rounded-full opacity-0 transition-all group-[.active]:opacity-100 bg-amber-600 dark:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)] dark:shadow-[0_0_8px_#fbbf24]"></span>
            </button>

        </div>
        `;
    },

    // ============================================================
    // 3. STATE MANAGEMENT
    // ============================================================

    _bindEvents() {
        // Optional: Hide dock on scroll down, Show on scroll up could go here
    },

    /**
     * Updates the highlighted tab based on the current view.
     * Called by Main.js router.
     */
    updateActiveTab(viewName) {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        // 1. Reset all tabs
        const buttons = nav.querySelectorAll('.nav-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });

        // 2. Logic: Should we hide the dock?
        // Hide on Quiz, Results, and Review pages to minimize distraction
        if (['quiz', 'results', 'review'].includes(viewName)) {
            this.toggle(false); 
            return;
        } else {
            this.toggle(true); 
        }

        // 3. Highlight active tab
        const targetBtn = nav.querySelector(`[data-tab="${viewName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    },

    /**
     * Shows or Hides the bottom dock with animation.
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

window.UIHeader = UIHeader;

