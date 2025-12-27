/**
 * ORACLE WORKER (BACKGROUND INTELLIGENCE)
 * Version: 3.3.0 (Patched: Pure GS Prediction Logic)
 * Path: assets/js/workers/oracle.worker.js
 */

// 1. GLOBAL ERROR TRAP (Catches silent failures)
self.onerror = function(message, source, lineno, colno, error) {
    self.postMessage({
        status: 'ERROR',
        message: "Worker Global Crash: " + message,
        stack: error ? error.stack : 'No stack trace'
    });
    return true; // Prevent default browser handler
};

// 2. MAIN EVENT LISTENER
self.onmessage = function(e) {
    // 🛡️ SAFETY: Wrap everything to catch logic errors
    try {
        let { command, data, config, history } = e.data;

        // A. PING CHECK
        if (command === 'PING') {
            self.postMessage({ status: 'PONG' });
            return;
        }

        // B. INPUT NORMALIZATION (CRITICAL FIX)
        // Previous Bug: If 'history' existed, it overwrote 'data' completely.
        // Fix: Only build data from history if 'data' is missing or empty.
        // Otherwise, preserve the 'data' (which contains Behavioral Profile) and just use 'history' for depth checks.
        if (history && (!data || !data.academic)) {
            data = _transformHistoryToData(history);
        } else if (!data) {
            data = { academic: {}, behavioral: {} };
        }

        // C. EMPTY STATE HANDLING
        // If there is no academic data, return a Safe Default immediately.
        if (!data.academic || Object.keys(data.academic).length === 0) {
            self.postMessage({
                score: 0,
                range: { min: 0, max: 200 },
                confidence: 0,
                flags: ['NEW_RECRUIT'],
                bellCurve: _generateNeutralCurve(), // Return dummy curve
                status: 'SUCCESS'
            });
            return;
        }

        // D. RUN SIMULATION
        if (command === 'RUN_ENSEMBLE' || command === undefined) { 
            // Default to running if command is missing but data exists
            const result = runEnsembleSimulation(data, config || { simulationRuns: 500 }, history);
            
            self.postMessage({
                status: 'SUCCESS',
                score: result.score,
                range: result.range,
                confidence: result.confidence,
                flags: result.flags,
                bellCurve: result.bellCurve,
                breakdown: result.breakdown
            });
        }

    } catch (err) {
        // 🛡️ ERROR SERIALIZATION FIX
        // Ensure we send a string, never null
        const msg = (err && err.message) ? err.message : String(err);
        const stack = (err && err.stack) ? err.stack : "No stack";
        
        console.error("🔮 Worker Caught Error:", msg);
        
        self.postMessage({
            status: 'ERROR',
            message: msg,
            stack: stack
        });
    }
};

// ============================================================
// 3. ENSEMBLE ENGINE
// ============================================================

function runEnsembleSimulation(telemetry, config, rawHistory) {
    // 1. Latin Hypercube (Stress Test with Global Bias)
    const lhsResult = runLatinHypercube(telemetry, config.simulationRuns);

    // 2. Bayesian (Confidence)
    const bayesianResult = runBayesianAdjustment(telemetry, lhsResult.averageScore);

    // 3. Pattern Recognition (Fuzzy Flags)
    const patternResult = runPatternRecognition(telemetry, lhsResult.averageScore);

    // 4. Stacking (Dynamic Weighting)
    // Check how much history we have to decide trust levels
    // We prioritize the raw history array length if available
    let historyDepth = 0;
    
    if (Array.isArray(rawHistory)) {
        historyDepth = rawHistory.length;
    } else if (telemetry.academic) {
        // Fallback: Count scores inside academic objects
        Object.values(telemetry.academic).forEach(sub => {
            if (sub && sub.scores) historyDepth += sub.scores.length;
        });
    }

    // Default weights
    let wMC = 0.5; // Monte Carlo
    let wBay = 0.3; // Bayesian
    let wPat = 0.2; // Pattern (XGBoost logic)

    // UPGRADE: Adjust weights based on data availability
    if (config && config.models) {
        // Allow manual override
        wMC = config.models.monteCarlo.weight;
        wBay = config.models.bayesian.weight;
        wPat = config.models.xgboost.weight;
    } else if (historyDepth > 25) {
        // High History: Trust Bayesian/History more
        wMC = 0.3;
        wBay = 0.6;
        wPat = 0.1;
    } else if (historyDepth < 3) {
        // Low History: Trust Simulation more
        wMC = 0.6;
        wBay = 0.2;
        wPat = 0.2;
    }
    
    const totalW = wMC + wBay + wPat;
    
    const finalScore = (
        (lhsResult.averageScore * wMC) +
        (bayesianResult.score   * wBay) +
        (patternResult.score    * wPat)
    ) / totalW;

    // Generate Chart Data
    const stdDev = Math.max(10, (lhsResult.maxScore - lhsResult.minScore) / 4);
    const bellCurve = _generateBellCurvePoints(finalScore, stdDev);

    return {
        score: Math.round(finalScore),
        range: { min: lhsResult.minScore, max: lhsResult.maxScore },
        confidence: bayesianResult.confidence,
        flags: patternResult.flags,
        bellCurve: bellCurve,
        breakdown: {
            mc: Math.round(lhsResult.averageScore),
            bayesian: Math.round(bayesianResult.score),
            pattern: Math.round(patternResult.score)
        }
    };
}

// ============================================================
// 4. MODELS
// ============================================================

function runLatinHypercube(data, runs) {
    let totalSimulatedScore = 0;
    let minScore = 300; 
    let maxScore = 0;   

    // Safety Check
    if (!data.academic) return { averageScore: 0, minScore: 0, maxScore: 0 };
    
    // UPGRADE: Pure GS Logic
    // Filter OUT CSAT subjects to prevent score inflation
    const subjects = Object.keys(data.academic).filter(id => !id.startsWith('csat_'));
    
    if (subjects.length === 0) return { averageScore: 0, minScore: 0, maxScore: 0 };

    const subjectPotentials = subjects.map(subId => {
        const sub = data.academic[subId];
        if (!sub) return null;
        
        const weight = sub.weight || 0.15;
        const mastery = sub.mastery || 0;
        
        return {
            id: subId,
            basePoints: 2 * weight * mastery, 
            volatility: (1.0 - (sub.stability || 0.5)) + 0.1 
        };
    }).filter(s => s !== null);

    for (let i = 0; i < runs; i++) {
        let currentRunScore = 0;
        const percentile = (i + 0.5) / runs; 

        // UPGRADE: Global "Day Luck" Factor
        // Simulates that if you have a bad day, ALL subjects suffer.
        // If Day Factor is low, it pulls down all subjects slightly.
        const dayFactor = _boxMullerTransform(Math.random()); 

        subjectPotentials.forEach(sub => {
            const b = data.behavioral || {};
            const focusMod = b.sillyMistakeMod || 1.0; 
            const panicMod = b.panicMod || 1.0;

            // Mix specific subject noise with global day noise (70% subject / 30% day)
            const rawZ = _boxMullerTransform(percentile);
            const zScore = (rawZ * 0.7) + (dayFactor * 0.3);

            const noise = sub.volatility * zScore * 5; 
            let simulatedPoints = sub.basePoints + noise;
            simulatedPoints *= focusMod; 
            
            // Panic penalty applies more harshly on bad luck rolls
            if (zScore < -1.0) simulatedPoints *= panicMod; 
            
            // Clamp individual subject score
            simulatedPoints = Math.max(0, simulatedPoints);
            currentRunScore += simulatedPoints;
        });

        // Clamp total score
        currentRunScore = Math.min(200, Math.max(0, currentRunScore));

        totalSimulatedScore += currentRunScore;
        if (currentRunScore < minScore) minScore = currentRunScore;
        if (currentRunScore > maxScore) maxScore = currentRunScore;
    }

    return {
        averageScore: runs > 0 ? totalSimulatedScore / runs : 0,
        minScore: Math.floor(minScore === 300 ? 0 : minScore),
        maxScore: Math.ceil(maxScore)
    };
}

function runBayesianAdjustment(data, avgScore) {
    let totalConfidence = 0;
    let subjectCount = 0;

    if (data.academic) {
        // UPGRADE: Calculate confidence using ONLY GS subjects
        Object.keys(data.academic)
            .filter(id => !id.startsWith('csat_'))
            .forEach(subId => {
                const sub = data.academic[subId];
                if (sub) {
                    totalConfidence += (sub.stability || 0.5);
                    subjectCount++;
                }
            });
    }

    const globalConfidence = subjectCount > 0 ? (totalConfidence / subjectCount) : 0.1;
    const conservativeBaseline = 50; 
    
    // Confidence Weighted Average
    const adjustedScore = (avgScore * globalConfidence) + (conservativeBaseline * (1 - globalConfidence));

    return {
        score: adjustedScore,
        confidence: parseFloat(globalConfidence.toFixed(2))
    };
}

function runPatternRecognition(data, currentScore) {
    let modifiedScore = currentScore;
    const flags = [];
    const b = data.behavioral || {};
    const ac = data.academic || {};

    // UPGRADE: Fuzzy Logic Implementation (Sliding Scale)
    // We keep strict flag names for UI compatibility but smooth the scoring logic.

    // 1. GAMBLER_RISK
    // Penalize heavily if high risk AND high silly mistakes
    if ((b.riskMod || 1.0) > 1.0) {
        const excessRisk = b.riskMod - 1.0;
        const mistakeFactor = 1.0 - (b.sillyMistakeMod || 1.0); // 0.1 means 10% penalty
        
        // If you take risks AND make mistakes, the penalty multiplies
        if (mistakeFactor > 0) {
            const riskPenalty = excessRisk * 200 * (1 + mistakeFactor);
            modifiedScore -= riskPenalty;

            // Trigger flag only if impact is significant
            if (riskPenalty > 8) flags.push("GAMBLER_RISK");
        }
    }

    // 2. FATIGUE_RISK
    if ((b.fatigueMod || 1) < 0.96) {
        const fatigueSeverity = 0.96 - b.fatigueMod;
        const penalty = fatigueSeverity * 100; // Linear penalty
        modifiedScore -= Math.max(4, penalty); // Minimum 4 point hit
        flags.push("FATIGUE_RISK");
    }

    // 3. PANIC_PRONE
    if ((b.panicMod || 1) < 1.0) {
        const panicSeverity = 1.0 - b.panicMod;
        const penalty = panicSeverity * 50; 
        modifiedScore -= penalty;
        
        // Only flag if panic is causing real damage (> 5 points)
        if (penalty > 5) flags.push("PANIC_PRONE");
    }

    // 4. CSAT Check (Critical Logic - Kept Static)
    // Note: We still inspect CSAT data here for disqualification, 
    // even though we removed it from the score simulation.
    let csatScore = 0;
    let hasCsatData = false;
    ['csat_quant', 'csat_logic', 'csat_rc'].forEach(id => {
        if (ac[id]) {
            const score = (ac[id].score !== undefined) ? ac[id].score : (ac[id].mastery || 0);
            csatScore += (score / 100) * 66; 
            hasCsatData = true;
        }
    });

    if (hasCsatData && csatScore < 66) {
        flags.push("CSAT_CRITICAL_FAIL");
    }

    return {
        score: Math.max(0, modifiedScore),
        flags: flags
    };
}

// ============================================================
// 5. UTILITIES
// ============================================================

function _boxMullerTransform(u1) {
    const u2 = Math.random();
    const safeU1 = Math.max(Number.EPSILON, u1);
    let z = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(-3.5, Math.min(3.5, z));
}

function _generateBellCurvePoints(mean, stdDev) {
    const points = [];
    // Ensure stdDev is safe
    const safeStd = Math.max(5, stdDev);
    const start = Math.max(0, mean - (3 * safeStd));
    const end = Math.min(200, mean + (3 * safeStd));
    const step = (end - start) / 20;

    if (step <= 0) return []; 

    for (let x = start; x <= end; x += step) {
        const exponent = -0.5 * Math.pow((x - mean) / safeStd, 2);
        const y = Math.exp(exponent);
        points.push({ x: Math.round(x), y: parseFloat(y.toFixed(3)) });
    }
    return points;
}

function _generateNeutralCurve() {
    return [
        { x: 0, y: 0.1 }, { x: 50, y: 0.5 }, { x: 100, y: 1.0 }, 
        { x: 150, y: 0.5 }, { x: 200, y: 0.1 }
    ];
}

function _transformHistoryToData(history) {
    const academic = {};
    const behavioral = { 
        riskMod: 1.0, 
        sillyMistakeMod: 1.0, 
        panicMod: 1.0, 
        fatigueMod: 1.0 
    };

    if (!Array.isArray(history) || history.length === 0) return { academic, behavioral };

    history.forEach(h => {
        const sub = h.subject || 'unknown';
        if (!academic[sub]) {
            academic[sub] = { mastery: 0, stability: 0.5, weight: 0.15, scores: [] };
        }
        
        const max = h.totalMarks || 200;
        // Safety: Avoid divide by zero
        const normScore = max > 0 ? (h.score / max) * 100 : 0;
        academic[sub].scores.push(normScore);
    });

    Object.keys(academic).forEach(key => {
        const sub = academic[key];
        const sum = sub.scores.reduce((a, b) => a + b, 0);
        sub.mastery = sum / sub.scores.length;
        
        const variance = sub.scores.length > 1 ? 5 : 20; 
        sub.stability = Math.max(0.1, 1.0 - (variance/100));
    });

    return { academic, behavioral };
}

