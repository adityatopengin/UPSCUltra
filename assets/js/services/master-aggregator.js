/**
 * MASTER AGGREGATOR (THE MANAGER)
 * Version: 2.2.0 (Syntax Verified)
 * Path: assets/js/services/master-aggregator.js
 */

import { DB } from './db.js';

export const MasterAggregator = {
    
    // ============================================================
    // 1. CONFIGURATION & STATE
    // ============================================================
    
    worker: null,
    isCalculating: false,
    
    config: {
        simulationRuns: 500,
        models: {
            monteCarlo: { weight: 0.50 },
            bayesian:   { weight: 0.30 },
            xgboost:    { weight: 0.20 }
        }
    },

    lastPrediction: null,
    lastDataSignature: "",
    _pendingResolve: null, 

    // ============================================================
    // 2. INITIALIZATION
    // ============================================================

    init() {
        console.log("🔮 MasterAggregator: Initializing Oracle System...");

        if (this.worker) return; 

        if (window.Worker) {
            try {
                // Try standard path relative to your index.html location
                  const workerPath = 'assets/js/workers/oracle.worker.js'; 

                 this.worker = new Worker(workerPath);
                
                this.worker.onmessage = (e) => this._handleWorkerResponse(e);
                
                this.worker.onerror = (err) => {
                    console.error("🔮 OracleWorker Error:", err);
                    this.isCalculating = false;
                };

                this.worker.postMessage({ command: 'PING' });
                console.log("🔮 OracleWorker Spawned Successfully.");

            } catch (e) {
                console.warn("🔮 OracleWorker path error. Using Fallback.", e);
            }
        } else {
            console.warn("🔮 Web Workers not supported. Using Fallback.");
        }
    }, // <--- THIS COMMA IS CRITICAL

    // ============================================================
    // 3. PUBLIC API
    // ============================================================

    async getPrediction() {
        if (!this.worker) this.init();

        if (this.isCalculating) return null; 

        try {
            const telemetry = await this._gatherTelemetry();
            const currentSignature = JSON.stringify(telemetry);

            if (this.lastPrediction && this.lastDataSignature === currentSignature) {
                return this.lastPrediction;
            }

            this.isCalculating = true;
            this.lastDataSignature = currentSignature;

            return new Promise((resolve) => {
                if (this.worker) {
                    this.worker.postMessage({
                        command: 'RUN_ENSEMBLE',
                        data: telemetry,
                        config: this.config
                    });
                    this._pendingResolve = resolve;
                } else {
                    const fallbackResult = this._runFallbackSimulation(telemetry);
                    this.isCalculating = false;
                    this.lastPrediction = fallbackResult;
                    resolve(fallbackResult);
                }
            });
        } catch (e) {
            console.error("🔮 Prediction Failed:", e);
            this.isCalculating = false;
            return null;
        }
    }, // <--- THIS COMMA IS CRITICAL

    // ============================================================
    // 4. DATA COLLECTION
    // ============================================================

    async _gatherTelemetry() {
        const academicState = {};
        
        try {
            await DB.connect();
            const academicRaw = await DB.getAll('academic_state');
            if (academicRaw && academicRaw.length > 0) {
                academicRaw.forEach(item => {
                    academicState[item.subjectId] = item;
                });
            }
        } catch (e) {
            console.warn("🔮 Oracle: Academic data fetch failed.", e);
        }

        let behavioralProfile = null;
        try {
            behavioralProfile = await DB.get('profiles', 'user_1');
        } catch (e) {}
        
        if (!behavioralProfile) {
            behavioralProfile = {
                focus: { value: 0.5 },
                risk: { value: 0.5 },
                calm: { value: 0.5 },
                sillyMistakeMod: 1.0,
                panicMod: 1.0
            };
        }

        let historyCount = 0;
        try {
            const historyKeys = await DB.getRandomKeys('history', null, null, 10000); 
            historyCount = historyKeys.length;
        } catch (e) {}
        
        return {
            academic: academicState,
            behavioral: behavioralProfile,
            meta: {
                totalTests: historyCount,
                daysToExam: this._getDaysToExam()
            }
        };
    }, // <--- THIS COMMA IS CRITICAL

    // ============================================================
    // 5. WORKER RESPONSE
    // ============================================================

    _handleWorkerResponse(e) {
        const { status, result } = e.data;

        if (status === 'SUCCESS') {
            this.lastPrediction = result;
            this.isCalculating = false;

            if (this._pendingResolve) {
                this._pendingResolve(result);
                this._pendingResolve = null;
            }
            window.dispatchEvent(new CustomEvent('oracle-update', { detail: result }));
        } else {
            console.error("🔮 Oracle Worker Error:", e.data.message);
            this.isCalculating = false;
        }
    },

    // ============================================================
    // 6. UI FORMATTERS
    // ============================================================

    formatForDisplay(prediction) {
        if (!prediction) return null;

        const score = prediction.score;
        const flags = prediction.flags || [];

        if (flags.includes("CSAT_CRITICAL_FAIL")) {
            return {
                displayScore: score,
                probabilityText: "CSAT DISQUALIFIED",
                probabilityValue: 0,
                color: '#F44336',
                chartData: [],
                warnings: ["CSAT Score < 66", ...flags]
            };
        }

        let probability = 0;
        let color = '#F44336'; 

        if (score > 105) { probability = 95; color = '#00E676'; } 
        else if (score > 98) { probability = 80; color = '#00E676'; } 
        else if (score > 88) { probability = 55; color = '#FFC107'; } 
        else if (score > 75) { probability = 25; color = '#FF5722'; } 
        else { probability = 10; color = '#F44336'; }

        const range = prediction.range || { min: score * 0.9, max: score * 1.1 };
        const bellCurveData = this._generateBellCurvePoints(score, range);

        return {
            displayScore: score,
            probabilityText: `${probability}% CHANCE`,
            probabilityValue: probability,
            color: color,
            chartData: bellCurveData,
            warnings: flags
        };
    },

    _generateBellCurvePoints(mean, range) {
        const points = [];
        const stdDev = Math.max(1, (range.max - range.min) / 6); 
        
        for (let i = -3; i <= 3; i += 0.3) {
            const x = mean + (i * stdDev);
            const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
            const y = Math.exp(exponent);
            points.push({ x: Math.round(x), y: y });
        }
        return points;
    },

    // ============================================================
    // 7. UTILITIES
    // ============================================================

    _getDaysToExam() {
        try {
            const examDate = new Date('2025-05-25');
            const diff = examDate - new Date();
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch (e) {
            return 100;
        }
    },

    _runFallbackSimulation(data) {
        let totalScore = 0;
        const subjects = data.academic ? Object.values(data.academic) : [];
        
        subjects.forEach(sub => {
            totalScore += (sub.mastery || 0) * (sub.weight || 0) * 2;
        });

        const safeScore = Math.max(0, Math.min(200, Math.round(totalScore)));

        return {
            score: safeScore,
            range: { min: safeScore * 0.85, max: safeScore * 1.15 },
            confidence: 0.5,
            flags: ["LOW_POWER_MODE"], 
            breakdown: { mc: safeScore, bayesian: safeScore, pattern: safeScore }
        };
    }
};

