 /**
 * UI MANAGER (SAFE VERSION)
 * Path: assets/js/ui/ui-manager.js
 */

export const UI = {
    async init() {
        console.log("🎨 UI: Initializing...");
        
        // 1. Try to load Header dynamically
        try {
            // Try the 'components' folder first
            await import('./components/ui-header.js')
                .then(m => { if(m.UIHeader) m.UIHeader.init(); })
                .catch(err => {
                    console.warn("⚠️ UIHeader not found in ./components/. Trying root...");
                });
        } catch (e) {
            console.log("UI Header skipped for now.");
        }

        console.log("🎨 UI: Ready.");
    },

    toggleLoader(show) {
        const loader = document.getElementById('boot-loader');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
            loader.style.opacity = show ? '1' : '0';
        }
    },

    showToast(msg) {
        console.log("TOAST:", msg);
        // Simplified toast for debug
        const div = document.createElement('div');
        div.className = "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded z-50";
        div.innerText = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }
};

