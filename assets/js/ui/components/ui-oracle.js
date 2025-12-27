/**
 * UI-ORACLE (THE HOLOGRAM)
 * Version: 2.3.0 (Optimized: Uses Worker-Generated Curve)
 * Path: assets/js/ui/components/ui-oracle.js
 * Responsibilities:
 * 1. Visualizes the AI Prediction (Score + Probability).
 * 2. Renders the Bell Curve Chart (Directly from Worker).
 * 3. Listens for 'oracle-update' events from MasterAggregator.
 */

import { MasterAggregator } from '../../services/master-aggregator.js';

export const UIOracle = {
    // ============================================================
    // 1. STATE & CONFIG
    // ============================================================
    state: {
        chartInstance: null,
        lastPrediction: null
    },

    // ============================================================
    // 2. INITIALIZATION
    // ============================================================

    init() {
        console.log("🔮 UIOracle: Listening for prophecies...");
        
        window.addEventListener('oracle-update', (e) => {
            this._updateUI(e.detail);
        });
        
        // Re-render chart on theme switch
        window.addEventListener('theme-changed', () => {
            if (this.state.lastPrediction) {
                this._renderChart(this.state.lastPrediction);
            }
        });
    },

    /**
     * 🛡️ FIX: The Missing Method
     * This is called by UIHome to mount the component.
     */
    render(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="premium-card p-6 relative overflow-hidden group bg-white dark:bg-slate-900/50 shadow-xl shadow-purple-500/5 dark:shadow-none border border-slate-100 dark:border-white/5 rounded-[32px]">
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/10 dark:group-hover:bg-purple-500/20 transition-all duration-1000"></div>
                
                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h2 class="premium-text-head text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">
                                <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>Oracle Prediction
                            </h2>
                            <h1 class="text-3xl font-black tracking-tighter text-slate-900 dark:text-white" id="oracle-score">
                                --- <span class="text-sm opacity-50 font-medium">/ 200</span>
                            </h1>
                        </div>
                        <div class="text-right">
                            <div id="oracle-prob-badge" class="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider opacity-0 transition-opacity text-slate-500 dark:text-slate-400">
                                Calculating...
                            </div>
                        </div>
                    </div>

                    <div class="h-32 w-full relative">
                        <canvas id="oracle-chart"></canvas>
                        
                        <div id="oracle-loader" class="absolute inset-0 flex items-center justify-center">
                            <div class="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>

                    <div id="oracle-warnings" class="mt-4 flex flex-wrap gap-2 min-h-[20px]">
                    </div>
                </div>
            </div>
        `;

        // Trigger Data Fetch immediately
        setTimeout(() => {
            MasterAggregator.getPrediction();
        }, 500);
    },

    // ============================================================
    // 3. UI UPDATE LOGIC
    // ============================================================

    _updateUI(prediction) {
        if (!prediction) return;
        this.state.lastPrediction = prediction; // Cache for theme switch
        
        const scoreEl = document.getElementById('oracle-score');
        const badgeEl = document.getElementById('oracle-prob-badge');
        const loader = document.getElementById('oracle-loader');
        const warningsEl = document.getElementById('oracle-warnings');

        if (!scoreEl) return; // View might be unmounted

        // Hide Loader
        if (loader) loader.style.opacity = '0';

        // Animate Score
        scoreEl.innerHTML = `${prediction.score} <span class="text-sm opacity-50 font-medium">/ 200</span>`;

        // Update Badge
        const confidence = Math.round((prediction.confidence || 0.5) * 100);
        if (badgeEl) {
            badgeEl.textContent = `${confidence}% CONFIDENCE`;
            
            // Adaptive Colors
            let colorClass = 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400';
            if (confidence > 70) {
                colorClass = 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
            }
            
            badgeEl.className = `px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all opacity-100 ${colorClass}`;
        }

        // Render Flags/Warnings
        if (warningsEl && prediction.flags && prediction.flags.length > 0) {
            warningsEl.innerHTML = prediction.flags.map(flag => {
                let color = 'rose';
                let icon = 'triangle-exclamation';
                
                if (flag === 'GAMBLER_RISK') { icon = 'dice'; color = 'amber'; }
                if (flag === 'FATIGUE_RISK') { icon = 'battery-quarter'; color = 'orange'; }
                if (flag === 'PANIC_PRONE') { icon = 'face-dizzy'; color = 'purple'; }

                // Adaptive Pill Style
                return `<span class="px-2 py-1 rounded bg-${color}-100 dark:bg-${color}-500/10 border border-${color}-200 dark:border-${color}-500/20 text-${color}-600 dark:text-${color}-400 text-[9px] font-bold uppercase flex items-center gap-1">
                    <i class="fa-solid fa-${icon}"></i> ${flag.replace('_', ' ')}
                </span>`;
            }).join('');
        } else if (warningsEl) {
            warningsEl.innerHTML = `<span class="opacity-30 text-[9px] font-bold uppercase text-slate-500 dark:text-white">System Stable</span>`;
        }

        // Render Chart
        this._renderChart(prediction);
    },

    _renderChart(prediction) {
        const ctx = document.getElementById('oracle-chart');
        if (!ctx || !window.Chart) return;

        // Cleanup old chart
        if (this.state.chartInstance) {
            this.state.chartInstance.destroy();
        }

        const isDark = document.documentElement.classList.contains('dark');

        // UPGRADE: Use Worker-Generated Curve Data
        // Prioritize 'bellCurve' array from Worker. If missing, fallback to local math.
        let dataPoints = [];
        let labels = [];

        if (prediction.bellCurve && Array.isArray(prediction.bellCurve) && prediction.bellCurve.length > 0) {
            // Mapping Worker Data: [{x, y}, {x, y}] -> Arrays
            labels = prediction.bellCurve.map(p => p.x);
            dataPoints = prediction.bellCurve.map(p => p.y);
        } else {
            // Fallback Logic (Legacy Protection)
            const mean = prediction.score;
            const sigma = (prediction.range.max - prediction.range.min) / 4; 
            for (let x = mean - (2 * sigma); x <= mean + (2 * sigma); x += (sigma / 5)) {
                const y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
                dataPoints.push(y);
                labels.push(Math.round(x));
            }
        }

        // Create Gradient 
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
        // Dark Mode: Bright Neon Purple / Light Mode: Deep Purple
        const colorStart = isDark ? 'rgba(168, 85, 247, 0.5)' : 'rgba(147, 51, 234, 0.3)';
        const colorEnd = isDark ? 'rgba(168, 85, 247, 0)' : 'rgba(147, 51, 234, 0)';
        
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        const borderColor = isDark ? '#a855f7' : '#9333ea'; // Purple-500 vs Purple-600

        this.state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    borderColor: borderColor,
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                animation: { duration: 1000 }
            }
        });
    }
};

