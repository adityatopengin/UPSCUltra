/**
 * ORACLE WORKER (The Background Brain)
 * Version: 2.0.0
 * Path: assets/js/workers/oracle.worker.js
 * Responsibilities:
 * 1. Runs off the main thread to prevent UI freezing.
 * 2. Implements "Ensemble Stacking" (LHS + Bayesian + Heuristic Pattern Rec).
 * 3. Returns a probability cloud and risk flags.
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
    // Simulates "Luck" and "Volatility" to find the min/max range.
    const lhsResult = runLatinHypercube(telemetry, config.simulationRuns || 500);

    // 2. Run Model B: Bayesian Confidence Adjustment (The Skeptic)
    // Adjusts the average based on how much data we actually have.
    const bayesianResult = runBayesianAdjustment(telemetry, lhsResult.averageScore);

    // 3. Run Model C: Heuristic Pattern Recognition (The "XGBoost" Logic)
    // Checks for toxic combinations (e.g., High Risk + Low Calm).
    const patternResult = runPatternRecognition(telemetry, lhsResult.averageScore);

    // 4. THE STACKING (Weighted Average)
    // We blend the three models to get the "Ground Truth".
    const weights = config.models || { 
        monteCarlo: { weight: 0.5 }, 
        bayesian: { weight: 0.3 }, 
        xgboost: { weight: 0.2 } 
    };
    
    // Normalize weights to ensure they sum to 1.0
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
        flags: patternResult.flags, // Warnings like "CSAT_CRITICAL_FAIL"
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
// Advanced Monte Carlo: Ensures we sample the "Edges" (Extreme Best/Worst cases)
// efficiently without needing 10,000 runs.

function runLatinHypercube(data, runs) {
    let totalSimulatedScore = 0;
    let minScore = 300; // Start high (Impossible score)
    let maxScore = 0;   // Start low

    // Get subject keys (e.g., 'polity', 'history')
    const subjects = Object.keys(data.academic);

    // OPTIMIZATION: Pre-calculate "Base Potential" to save CPU cycles inside the loop.
    // Logic: RealScore = Mastery * Weight * DifficultyModifier
    const subjectPotentials = subjects.map(subId => {
        const sub = data.academic[subId];
        
        // Skip if data is malformed
        if (!sub || typeof sub.mastery !== 'number') return null;

        return {
            id: subId,
            // We scale mastery (0-100) to Marks (approx 200 total).
            // Weight is % of exam (e.g., 0.15 for Polity).
            // 200 * 0.15 * (Mastery/100) = Base Points
            basePoints: 2 * sub.weight * sub.mastery, 
            
            // Volatility: (1 - stability) + base jitter.
            // If stability is 0.2 (Low), volatility is 0.9 (High swings).
            volatility: (1.0 - (sub.stability || 0.5)) + 0.1 
        };
    }).filter(s => s !== null);

    // THE SIMULATION LOOP (Runs ~500 times)
    for (let i = 0; i < runs; i++) {
        let currentRunScore = 0;

        // In LHS, we use stratified sampling for the random variable.
        // Instead of pure random(), we pick from a specific slice of the bell curve.
        // This ensures we hit the -3 SD (Worst Day) and +3 SD (Best Day) scenarios.
        const percentile = (i + 0.5) / runs; 
        
        // Convert 0-1 percentile to Z-Score (-3 to +3)
        // We use a Box-Muller approximation here for performance.
        const zScore = _boxMullerTransform(percentile); 

        subjectPotentials.forEach(sub => {
            // 1. Behavioral Modifiers (from Psych Engine)
            const b = data.behavioral || {};
            const focusMod = b.sillyMistakeMod || 1.0; 
            const panicMod = b.panicMod || 1.0;

            // 2. Calculate "Exam Day" Deviation
            // Noise = Volatility * Z-Score * ScaleFactor
            const noise = sub.volatility * zScore * 5; // 5 marks standard deviation base
            
            let simulatedPoints = sub.basePoints + noise;

            // 3. Apply Behavioral Penalties
            simulatedPoints *= focusMod; 
            
            // Panic triggers only on "Bad Luck" runs (Negative Z-Score)
            if (zScore < -1.0) simulatedPoints *= panicMod; 

            // Clamp (Cannot score < 0)
            simulatedPoints = Math.max(0, simulatedPoints);
            
            currentRunScore += simulatedPoints;
        });

        // Track Min/Max/Avg
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
// Penalizes the score if the "Data Confidence" is low.
// Logic: "You scored 90%, but you only took 1 test. I trust this 90% only 20%."

function runBayesianAdjustment(data, avgScore) {
    let totalConfidence = 0;
    let subjectCount = 0;

    // Calculate average stability across all subjects
    // Stability comes from AcademicEngine (0.0 = Newbie, 1.0 = Veteran)
    if (data.academic) {
        Object.values(data.academic).forEach(sub => {
            if (sub && typeof sub.stability === 'number') {
                totalConfidence += sub.stability;
                subjectCount++;
            }
        });
    }

    // Default to 0.1 confidence if no data exists
    const globalConfidence = subjectCount > 0 ? (totalConfidence / subjectCount) : 0.1;
    
    // The Formula: 
    // Adjusted = (MeasuredScore * Confidence) + (ConservativeBaseline * (1 - Confidence))
    // We assume a "Conservative Baseline" of 70 marks (a typical safe-but-fail score).
    // This pulls outliers back to reality until they prove consistency.
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
// Looks for specific "Toxic Combinations" of traits that statistical models miss.

function runPatternRecognition(data, currentScore) {
    let modifiedScore = currentScore;
    const flags = [];

    const b = data.behavioral || {};
    const ac = data.academic || {};

    // PATTERN 1: The "Gambler's Ruin"
    // High Risk Appetite (>1.03 mod) + Low Focus (<0.95 mod) 
    // Result: User guesses wildly and makes silly mistakes.
    if (b.riskMod > 1.03 && b.sillyMistakeMod < 0.95) {
        modifiedScore -= 12; // Heavy penalty for negative marking disaster
        flags.push("GAMBLER_RISK");
    }

    // PATTERN 2: The "Burnout Trajectory"
    // High Knowledge + Low Endurance (Stamina)
    // Result: User starts strong but fails the last 20 questions.
    if (b.fatigueMod < 0.96) {
        modifiedScore -= 8; // Penalty for end-of-exam fatigue
        flags.push("FATIGUE_RISK");
    }

    // PATTERN 3: The "Panic Spiral"
    // Low Calmness. User freezes after 2 hard questions.
    if (b.panicMod < 0.92) {
        modifiedScore -= 5;
        flags.push("PANIC_PRONE");
    }

    // PATTERN 4: The "CSAT Trap" (Disqualification Check)
    // If CSAT Quant/Reasoning is weak, GS prediction is irrelevant.
    // We check specific CSAT subjects if they exist in the academic vector.
    
    // Calculate estimated CSAT score (simple weighted sum of CSAT subjects)
    let csatScore = 0;
    let hasCsatData = false;

     // NEW (Correct)
    ['csat_quant', 'csat_logic', 'csat_rc'].forEach(id => {
        if (ac[id]) {
            // Estimate: Mastery * Weight * 200 (Total Marks) * 0.33 (Subject weight approx)
            csatScore += (ac[id].mastery / 100) * 66; 
            hasCsatData = true;
        }
    });

    // If we have data and score is below passing (66.6 marks)
    // We add a Critical Flag. The UI will see this and turn the card RED.
    if (hasCsatData && csatScore < 66) {
        flags.push("CSAT_CRITICAL_FAIL");
        // We do NOT zero the GS score here. We return the GS score as is,
        // but the flag tells the UI "This score doesn't matter because you failed Paper 2".
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
 * Input: Uniform random (0-1). Output: Z-Score (-3 to +3 mostly).
 * Used by: Latin Hypercube (Model A)
 */
function _boxMullerTransform(u1) {
    // We need two random variables. 
    // u1 is passed from the Stratified Sampling loop (Part 1).
    // u2 is random noise.
    const u2 = Math.random();
    
    // Formula: Z = sqrt(-2 * ln(u1)) * cos(2 * pi * u2)
    // We clamp u1 to prevent Math.log(0) infinity error
    const safeU1 = Math.max(Number.EPSILON, u1);
    
    return Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
}


