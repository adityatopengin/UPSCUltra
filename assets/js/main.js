/**
 * MAIN.JS (DEBUGGER EDITION)
 * Purpose: Catch "Silent Spin" errors and show them on screen.
 */

// 1. GLOBAL ERROR TRAP (Runs before anything else)
window.onerror = function(message, source, lineno, colno, error) {
    const errorBox = document.getElementById('debug-box') || createDebugBox();
    errorBox.innerHTML += `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 10px;">
            <strong style="color: #ff5555;">❌ CRASH DETECTED:</strong><br>
            ${message}<br>
            <small style="color: #aaa;">${source.split('/').pop()} : Line ${lineno}</small>
        </div>
    `;
    return false;
};

// Trap Promise Errors (Async fails)
window.onunhandledrejection = function(event) {
    const errorBox = document.getElementById('debug-box') || createDebugBox();
    errorBox.innerHTML += `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 10px;">
            <strong style="color: #ffaa00;">⚠️ ASYNC ERROR:</strong><br>
            ${event.reason ? event.reason.message : event.reason}
        </div>
    `;
};

function createDebugBox() {
    document.body.innerHTML = ''; // Clear screen
    const div = document.createElement('div');
    div.id = 'debug-box';
    div.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#1a1a1a; color:white; padding:20px; font-family:monospace; z-index:9999; overflow:auto; font-size: 14px;";
    div.innerHTML = "<h2 style='color:cyan; border-bottom:2px solid cyan;'>🐞 SYSTEM DEBUGGER</h2>";
    document.body.appendChild(div);
    return div;
}

// 2. ATTEMPT IMPORTS (One by one to find the killer)
console.log("🔍 Starting Import Sequence...");

try {
    // A. Config
    const config = await import('./config.js');
    log("✅ Config Loaded");

    // B. Database
    const db = await import('./services/db.js');
    log("✅ DB Service Loaded");

    // C. Engines (The likely suspects)
    const master = await import('./services/master-aggregator.js');
    log("✅ MasterAggregator Loaded");

    const quizEngine = await import('./engine/quiz-engine.js');
    log("✅ Quiz Engine Loaded");

    // D. UI Manager (Check dependencies)
    const ui = await import('./ui/ui-manager.js');
    log("✅ UI Manager Loaded");
    
    if (window.UI) window.UI.init();

    // E. Views
    await import('./ui/views/ui-home.js');
    log("✅ Home View Loaded");
    
    await import('./ui/views/ui-quiz.js');
    log("✅ Quiz View Loaded");

    // F. Start App
    log("🚀 LAUNCHING APP...");
    
    // Simulate Main Object
    window.Main = {
        navigate: (view) => console.log("Navigating to " + view),
        init: () => console.log("Main Init")
    };
    
    // Manually trigger Home render to see if it works
    const container = document.getElementById('app-container');
    if(container && window.UIHome) {
        window.UIHome.render(container);
        // Hide Debugger if successful after 2 seconds
        setTimeout(() => {
             const dbg = document.getElementById('debug-box');
             if(dbg) dbg.style.display = 'none';
        }, 3000);
    }

} catch (e) {
    // This will catch the specific file that failed
    window.onerror(e.message, e.fileName || "Unknown File", e.lineNumber || 0);
}

function log(msg) {
    console.log(msg);
    const box = document.getElementById('debug-box');
    if(box) box.innerHTML += `<div style="color:#55ff55;">${msg}</div>`;
}

// Dummy Export to keep it a module
export const Debugger = true;

