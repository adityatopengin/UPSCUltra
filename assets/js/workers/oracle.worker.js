/**
 * ORACLE WORKER (The Background Brain)
 * Version: 2.1.0 (Patched: CSAT Fix + Z-Score Clamp)
 * Path: assets/js/workers/oracle.worker.js
 */

// ============================================================
// 1. WORKER EVENT LISTENER (THE GATEWAY)
// ============================================================

self.onmessage = function(e) {
    const { command, data, config } = e.data;

    // A. HEALTH CHECK
    if (command === 'PING') {
        self.postMessage({ status: 'PONG' });
        return;
    }

    // B. RUN PREDICTION
    if (command === 'RUN_ENSEMBLE') {
        try {
            const result = runEnsembleSimulation(data, config);
            
            self.postMessage({
                status: 'SUCCESS',
                result: result
            });
        } catch (err) {
            console.error("🔮 OracleWorker Error:", err);
            self.postMessage({
                status: 'ERROR',
                message: err.message
            });
        }
    }
};

// ============================================================
// 2. THE ENSEMBLE CONTROLLER
// ============================================================

function runEnsembleSimulation(telemetry, config) {
    // 1. Run Model A: Latin Hypercube Simulation (The Stress Test)
    const lhsResult = runLatinHypercube(telemetry, config.simulationRuns || 500);

    // 2. Run Model B: Bayesian Confidence Adjustment (The Skeptic)
    const bayesianResult = runBayesianAdjustment(telemetry, lhsResult.averageScore);

    // 3. Run Model C: Heuristic Pattern Recognition (The "XGBoost" Logic)
    const patternResult = runPatternRecognition(telemetry, lhsResult.averageScore);

    // 4. THE STACKING (Weighted Average)
    const weights = config.models || { 
        monteCarlo: { weight: 0.5 }, 
        bayesian: { weight: 0.3 }, 
        xgboost: { weight: 0.2 } 
    };
    
    const totalW = weights.monteCarlo.weight + weights.bayesian.weight + weights.xgboost.weight;
    
    const finalScore = (
        (lhsResult.averageScore * weights.monteCarlo.weight) +
        (bayesianResult.score   * weights.bayesian.weight) +
        (patternResult.score    * weights.xgboost.weight)
    ) / totalW;

    return {
        score: Math.round(finalScore),
        range: { min: lhsResult.minScore, max: lhsResult.maxScore },
        confidence: bayesianResult.confidence,
        flags: patternResult.flags,
        breakdown: {
            mc: Math.round(lhsResult.averageScore),
            bayesian: Math.round(bayesianResult.score),
            pattern: Math.round(patternResult.score)
        }
    };
}

// ============================================================
// 3. MODEL A: LATIN HYPERCUBE SAMPLING (LHS)
// ============================================================

function runLatinHypercube(data, runs) {
    let totalSimulatedScore = 0;
    let minScore = 300; 
    let maxScore = 0;   

    const subjects = Object.keys(data.academic);

    const subjectPotentials = subjects.map(subId => {
        const sub = data.academic[subId];
        
        if (!sub || typeof sub.mastery !== 'number') return null;

        return {
            id: subId,
            basePoints: 2 * sub.weight * sub.mastery, 
            volatility: (1.0 - (sub.stability || 0.5)) + 0.1 
        };
    }).filter(s => s !== null);

    for (let i = 0; i < runs; i++) {
        let currentRunScore = 0;

        const percentile = (i + 0.5) / runs; 
        const zScore = _boxMullerTransform(percentile); 

        subjectPotentials.forEach(sub => {
            const b = data.behavioral || {};
            const focusMod = b.sillyMistakeMod || 1.0; 
            const panicMod = b.panicMod || 1.0;

            const noise = sub.volatility * zScore * 5; 
            
            let simulatedPoints = sub.basePoints + noise;

            simulatedPoints *= focusMod; 
            
            if (zScore < -1.0) simulatedPoints *= panicMod; 

            simulatedPoints = Math.max(0, simulatedPoints);
            
            currentRunScore += simulatedPoints;
        });

        totalSimulatedScore += currentRunScore;
        if (currentRunScore < minScore) minScore = currentRunScore;
        if (currentRunScore > maxScore) maxScore = currentRunScore;
    }

    return {
        averageScore: totalSimulatedScore / runs,
        minScore: Math.floor(minScore),
        maxScore: Math.ceil(maxScore)
    };
}

// ============================================================
// 4. MODEL B: BAYESIAN CONFIDENCE (The Skeptic)
// ============================================================

function runBayesianAdjustment(data, avgScore) {
    let totalConfidence = 0;
    let subjectCount = 0;

    if (data.academic) {
        Object.values(data.academic).forEach(sub => {
            if (sub && typeof sub.stability === 'number') {
                totalConfidence += sub.stability;
                subjectCount++;
            }
        });
    }

    const globalConfidence = subjectCount > 0 ? (totalConfidence / subjectCount) : 0.1;
    const conservativeBaseline = 70; 
    
    const adjustedScore = (avgScore * globalConfidence) + (conservativeBaseline * (1 - globalConfidence));

    return {
        score: adjustedScore,
        confidence: parseFloat(globalConfidence.toFixed(2))
    };
}

// ============================================================
// 5. MODEL C: PATTERN RECOGNITION (Heuristic XGBoost)
// ============================================================

function runPatternRecognition(data, currentScore) {
    let modifiedScore = currentScore;
    const flags = [];

    const b = data.behavioral || {};
    const ac = data.academic || {};

    // PATTERN 1: The "Gambler's Ruin"
    if (b.riskMod > 1.03 && b.sillyMistakeMod < 0.95) {
        modifiedScore -= 12;
        flags.push("GAMBLER_RISK");
    }

    // PATTERN 2: The "Burnout Trajectory"
    if (b.fatigueMod < 0.96) {
        modifiedScore -= 8;
        flags.push("FATIGUE_RISK");
    }

    // PATTERN 3: The "Panic Spiral"
    if (b.panicMod < 0.92) {
        modifiedScore -= 5;
        flags.push("PANIC_PRONE");
    }

    // PATTERN 4: The "CSAT Trap" (Disqualification Check)
    let csatScore = 0;
    let hasCsatData = false;

    // 🛡️ FIX: Use correct field name (.score) with fallback
    ['csat_quant', 'csat_logic', 'csat_rc'].forEach(id => {
        if (ac[id]) {
            const subject_score = (ac[id].score !== undefined) ? ac[id].score : (ac[id].mastery || 0);
            csatScore += (subject_score / 100) * 66; 
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
// 6. MATH UTILITIES
// ============================================================

/**
 * Box-Muller Transform
 * Generates numbers on a Standard Normal Distribution (Bell Curve).
 * 🛡️ FIX: Added clamping to prevent extreme outliers.
 */
function _boxMullerTransform(u1) {
    const u2 = Math.random();
    const safeU1 = Math.max(Number.EPSILON, u1);
    
    let z = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
    
    // 🛡️ FIX: Clamp to realistic range (-3.5 to +3.5)
    return Math.max(-3.5, Math.min(3.5, z));
}

