/**
 * QUIZ ENGINE (THE PROCTOR)
 * Version: 2.0.0
 * Path: assets/js/engine/quiz-engine.js
 * Responsibilities:
 * 1. Manages the active test session (State, Timer, Score).
 * 2. Fetches questions dynamically from IndexedDB.
 * 3. Records detailed telemetry (Time per question, Switches) for the Behavioral Engine.
 */

import { DB } from '../services/db.js';
import { AcademicEngine } from './academic-engine.js';     // For saving academic results
import { BehavioralEngine } from './behavioral-engine.js'; // For analyzing clicks

export const Engine = {
    // ============================================================
    // 1. ENGINE STATE
    // ============================================================
    state: {
        active: false,
        subjectId: null,
        startTime: 0,
        
        // Question Data
        questions: [],      // Array of full question objects
        currentIndex: 0,    // Pointer to current Q
        
        // User Inputs
        answers: {},        // Map: { qId: optionIndex }
        bookmarks: new Set(),
        
        // Telemetry (For Behavioral Analysis)
        telemetry: {
            timePerQuestion: {}, // { qId: ms }
            switches: {},        // { qId: count } - Tracking second-guessing
            impulseClicks: 0,    // Count of clicks < 1.5s
            sequence: []         // Order in which user navigated
        },
        
        // Timer
        timer: null,
        timeLeft: 0,
        totalDuration: 0
    },

    // ============================================================
    // 2. SESSION CONTROL (START / STOP)
    // ============================================================

    /**
     * Boots up a new test session.
     * @param {String} subjectId - The topic to test.
     * @param {Number} count - Number of questions (Default 15).
     */
    async startSession(subjectId, count = 15) {
        console.log(`⚙️ Engine: Starting Session for ${subjectId}...`);
        
        this._resetState();
        this.state.subjectId = subjectId;
        this.state.active = true;

        // 1. Fetch Questions (High Performance Way)
        // We use the 'random' index trick from DB.js to get IDs fast, then fetch objects.
        try {
            // Step A: Get Random Keys (Lightweight)
            const randomIds = await DB.getRandomKeys('questions', 'subject', subjectId, count);
            
            if (randomIds.length === 0) {
                throw new Error(`No questions found for subject: ${subjectId}`);
            }

            // Step B: Fetch Full Objects (Parallel Requests)
            // We map the IDs to promises and wait for all.
            const fetchPromises = randomIds.map(id => DB.get('questions', id));
            this.state.questions = await Promise.all(fetchPromises);
            
            // Validation: Filter out any nulls if DB lookup failed
            this.state.questions = this.state.questions.filter(q => q);

            console.log(`⚙️ Engine: Loaded ${this.state.questions.length} questions.`);

            // 2. Initialize Timer
            // Standard: 2 minutes per question approx -> 15 Qs = 30 mins
            this.state.totalDuration = count * 2 * 60; 
            this.state.timeLeft = this.state.totalDuration;
            this._startTimer();

            // 3. Notify UI to Render First Question
            // We dispatch an event so UI-Quiz.js can pick it up
            this._dispatchUpdate('SESSION_START');

        } catch (e) {
            console.error("⚙️ Engine: Critical Error starting session", e);
            alert("Could not load questions. Please check if data is imported.");
            this.terminateSession();
            throw e; // Propagate error to Main.js
        }
    },

    terminateSession() {
        console.log("⚙️ Engine: Terminating Session.");
        this._stopTimer();
        this.state.active = false;
        this.state.questions = [];
        this.state.answers = {};
    },

    _resetState() {
        this.state = {
            active: false,
            subjectId: null,
            startTime: Date.now(),
            questions: [],
            currentIndex: 0,
            answers: {},
            bookmarks: new Set(),
            telemetry: {
                timePerQuestion: {},
                switches: {},
                impulseClicks: 0,
                sequence: []
            },
            timer: null,
            timeLeft: 0,
            totalDuration: 0
        };
    },

    // ============================================================
    // 3. TIMER LOGIC
    // ============================================================

    _startTimer() {
        if (this.state.timer) clearInterval(this.state.timer);
        
        this.state.timer = setInterval(() => {
            if (!this.state.active) return;

            this.state.timeLeft--;
            
            // Update UI every second
            // Using a CustomEvent is cleaner than direct DOM manipulation
            window.dispatchEvent(new CustomEvent('quiz-tick', { 
                detail: { timeLeft: this.state.timeLeft } 
            }));

            // Time's Up Logic
            if (this.state.timeLeft <= 0) {
                this.submitQuiz(true); // true = forceSubmit
            }
        }, 1000);
    },

    _stopTimer() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }
    },
    // ============================================================
    // 4. INTERACTION & TELEMETRY (THE SENSORS)
    // ============================================================

    /**
     * User selects an option.
     * @param {Number} qId - Question ID
     * @param {Number} optionIndex - 0, 1, 2, 3
     */
    submitAnswer(qId, optionIndex) {
        if (!this.state.active) return;

        // A. Telemetry: Check for Impulse Click
        // If user answers within 1.5s of seeing the question, it's impulsive.
        const now = Date.now();
        const timeSpent = now - (this._lastNavTime || this.state.startTime);
        
        if (timeSpent < 1500) {
            this.state.telemetry.impulseClicks++;
        }

        // B. Telemetry: Check for Switching (Second Guessing)
        // If they already had an answer recorded and are changing it...
        if (this.state.answers[qId] !== undefined && this.state.answers[qId] !== optionIndex) {
            this.state.telemetry.switches[qId] = (this.state.telemetry.switches[qId] || 0) + 1;
        }

        // C. Record Answer
        this.state.answers[qId] = optionIndex;
        
        // D. Dispatch Event (So UI updates the grid color)
        this._dispatchUpdate('ANSWER_SAVED', { qId, optionIndex });
    },

    toggleBookmark(qId) {
        if (this.state.bookmarks.has(qId)) {
            this.state.bookmarks.delete(qId);
        } else {
            this.state.bookmarks.add(qId);
        }
        this._dispatchUpdate('BOOKMARK_TOGGLED', { qId });
    },

    // ============================================================
    // 5. NAVIGATION
    // ============================================================

    goToQuestion(index) {
        if (index < 0 || index >= this.state.questions.length) return;
        
        // Track time spent on previous question before leaving
        this._recordTimeSpent();

        this.state.currentIndex = index;
        this._lastNavTime = Date.now(); // Reset question timer
        
        this._dispatchUpdate('NAVIGATE', { index });
    },

    nextQuestion() {
        this.goToQuestion(this.state.currentIndex + 1);
    },

    prevQuestion() {
        this.goToQuestion(this.state.currentIndex - 1);
    },

    /**
     * Helper to track milliseconds spent on a specific Q.
     */
    _recordTimeSpent() {
        const currentQ = this.state.questions[this.state.currentIndex];
        if (!currentQ) return;
        
        const now = Date.now();
        const diff = now - (this._lastNavTime || now);
        
        // Add to existing time (user might revisit)
        this.state.telemetry.timePerQuestion[currentQ.id] = 
            (this.state.telemetry.timePerQuestion[currentQ.id] || 0) + diff;
    }
    // ============================================================
    // 6. SUBMISSION & SCORING (THE JUDGE)
    // ============================================================

    /**
     * Ends the quiz and calculates results.
     * @param {Boolean} force - True if time ran out (skips confirmation).
     */
    async submitQuiz(force = false) {
        if (!this.state.active) return;

        // 1. Confirmation (unless forced by timer)
        if (!force) {
            const answered = Object.keys(this.state.answers).length;
            const total = this.state.questions.length;
            if (!confirm(`You have answered ${answered}/${total} questions.\nSubmit now?`)) {
                return;
            }
        }

        console.log("⚙️ Engine: Submitting Quiz...");
        this._stopTimer();
        this._recordTimeSpent(); // Capture the last question's time

        // 2. Calculate Stats
        const result = this._calculateResult();

        // 3. Update Sub-Engines (The Brains)
        try {
            // A. Behavioral Analysis (Psych Profile)
            // We pass the raw telemetry + the result summary
            if (BehavioralEngine) {
                BehavioralEngine.processQuizTelemetry(this.state.telemetry, result);
            }

            // B. Academic Analysis (Knowledge Map)
            // We pass the result + the full question objects (to check L1/L2/L3)
            if (AcademicEngine) {
                // We format questions to include user's answer for the engine to check
                const detailedQuestions = this.state.questions.map(q => ({
                    ...q,
                    userAnswer: this.state.answers[q.id],
                    isCorrect: this.state.answers[q.id] === q.correctOption
                }));
                
                AcademicEngine.processTestResult(result, detailedQuestions);
            }
        } catch (e) {
            console.error("⚙️ Engine: Sub-Engine Analysis Failed", e);
            // We continue anyway so user doesn't lose their result
        }

        // 4. Persistence (Save to DB)
        try {
            // Save the main result to History
            await DB.put('history', result);

            // Save specific mistakes for the "Review" feature
            // We filter out correct answers
            const mistakes = this.state.questions
                .filter(q => this.state.answers[q.id] !== q.correctOption)
                .map(q => ({
                    qId: q.id,
                    subjectId: this.state.subjectId,
                    userAnswer: this.state.answers[q.id] ?? null,
                    timestamp: Date.now()
                }));

            if (mistakes.length > 0) {
                await DB.bulkPut('mistakes', mistakes);
            }

        } catch (e) {
            console.error("⚙️ Engine: Failed to save result to DB", e);
            alert("Warning: Result could not be saved to disk.");
        }

        // 5. Handover to Main Controller
        // This triggers the view switch to #results
        if (window.Main) {
            Main.handleQuizCompletion(result);
        }
        
        this.terminateSession();
    },

    /**
     * Internal Grading Logic
     */
    _calculateResult() {
        let correct = 0;
        let wrong = 0;
        let skipped = 0;
        let score = 0;

        this.state.questions.forEach(q => {
            const userAns = this.state.answers[q.id];

            if (userAns === undefined || userAns === null) {
                skipped++;
            } else if (userAns === q.correctOption) {
                correct++;
                score += 2; // UPSC Standard: +2 for correct
            } else {
                wrong++;
                score -= 0.66; // UPSC Standard: -0.66 for wrong
            }
        });

        // Normalize Score (avoid negative total)
        const finalScore = Math.max(0, score);
        const accuracy = (correct / (correct + wrong)) * 100 || 0;

        return {
            id: `res_${Date.now()}`, // Unique Result ID
            subject: this.state.subjectId,
            timestamp: Date.now(),
            totalDuration: (this.state.totalDuration - this.state.timeLeft), // Time taken in seconds
            totalMarks: this.state.questions.length * 2,
            score: parseFloat(finalScore.toFixed(2)),
            correct,
            wrong,
            skipped,
            accuracy: parseFloat(accuracy.toFixed(2)),
            
            // Pass minimal QIDs for history reference
            questionIds: this.state.questions.map(q => q.id),
            
            // Pass telemetry snapshot for "Results View" analysis
            telemetry: { ...this.state.telemetry }
        };
    },

    // ============================================================
    // 7. UTILITIES
    // ============================================================

    /**
     * Helper to broadcast events to the UI.
     * UIQuiz.js listens for these to update the DOM.
     */
    _dispatchUpdate(type, payload = {}) {
        const event = new CustomEvent('quiz-update', {
            detail: {
                type,
                ...payload,
                state: {
                    currentIndex: this.state.currentIndex,
                    total: this.state.questions.length,
                    answers: this.state.answers,
                    bookmarks: this.state.bookmarks
                }
            }
        });
        window.dispatchEvent(event);
    }
};
