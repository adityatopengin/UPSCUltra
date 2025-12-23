/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.2.0 (Syntax Verified)
 * Path: assets/js/engine/quiz-engine.js
 * Responsibilities:
 * 1. Manages the Test Session (Timer, Questions, Answers).
 * 2. Calculates Real-time Stats (Accuracy, Speed).
 * 3. Saves Progress to DB automatically.
 */

import { DB } from '../services/db.js';
import { CONFIG } from '../config.js';

export const Engine = {
    // ============================================================
    // 1. ENGINE STATE
    // ============================================================
    state: {
        active: false,
        subjectId: null,
        startTime: null,
        totalDuration: 0,
        timeLeft: 0,
        questions: [],
        answers: {}, // Map<QuestionID, OptionIndex>
        bookmarks: new Set(),
        currentIndex: 0,
        historyLog: [] // For analytics (time per question)
    },

    timerInterval: null,

    // ============================================================
    // 2. SESSION MANAGEMENT
    // ============================================================

    /**
     * Starts a new test session.
     * @param {String} subjectId - 'polity', 'history', etc.
     */
    async startSession(subjectId) {
        console.log(`🧠 Engine: Starting Session for ${subjectId}`);
        
        // 1. Reset State
        this._resetState();
        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();

        // 2. Load Questions (Mock Data or from DB)
        // For MVP, we generate mock questions if DB is empty
        this.state.questions = await this._fetchQuestions(subjectId);
        
        if (this.state.questions.length === 0) {
            console.error("Engine: No questions found!");
            return;
        }

        // 3. Set Timer (e.g., 30 mins for 15 questions)
        // 2 minutes per question standard
        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // 4. Start Timer Loop
        this._startTimer();

        // 5. Broadcast Start Event
        this._emit('SESSION_START');
    }, // <--- THIS COMMA IS CRITICAL

    /**
     * Ends the session, calculates score, and saves to History.
     */
    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        this._stopTimer();
        this.state.active = false;

        // 1. Calculate Results
        const result = this._calculateResult();

        // 2. Save to Database
        try {
            await DB.add('history', result);
            
            // Update Academic State (Mastery Levels)
            await this._updateMastery(result);

            // 3. Notify UI (Main Controller will switch view)
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }

        } catch (e) {
            console.error("Engine: Save Failed", e);
            alert("Error saving results. Check console.");
        }
    }, // <--- THIS COMMA IS CRITICAL

    terminateSession() {
        this._stopTimer();
        this.state.active = false;
        this._resetState();
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;

        // Save Answer
        this.state.answers[questionId] = optionIndex;
        
        // Log Time Taken (Analytics)
        // We could track time per question here in v2

        // Broadcast Update
        this._emit('ANSWER_SAVED', { questionId, optionIndex });
    }, // <--- THIS COMMA IS CRITICAL

    toggleBookmark(questionId) {
        if (this.state.bookmarks.has(questionId)) {
            this.state.bookmarks.delete(questionId);
        } else {
            this.state.bookmarks.add(questionId);
        }
        this._emit('BOOKMARK_TOGGLED', { questionId });
    },

    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.state.currentIndex++;
            this._emit('NAVIGATE');
        }
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this._emit('NAVIGATE');
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentIndex = index;
            this._emit('NAVIGATE');
        }
    },

    // ============================================================
    // 4. INTERNAL UTILITIES
    // ============================================================

    _startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.state.timeLeft--;
            
            // Broadcast Tick (for UI Timer)
            window.dispatchEvent(new CustomEvent('quiz-tick', { 
                detail: { timeLeft: this.state.timeLeft } 
            }));

            if (this.state.timeLeft <= 0) {
                this.submitQuiz(); // Auto-submit
            }
        }, 1000);
    },

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    _resetState() {
        this.state = {
            active: false,
            subjectId: null,
            startTime: null,
            totalDuration: 0,
            timeLeft: 0,
            questions: [],
            answers: {},
            bookmarks: new Set(),
            currentIndex: 0,
            historyLog: []
        };
    },

    _calculateResult() {
        let correct = 0;
        let wrong = 0;
        let score = 0;
        const total = this.state.questions.length;

        this.state.questions.forEach(q => {
            const userAnswer = this.state.answers[q.id];
            if (userAnswer !== undefined) {
                if (userAnswer === q.correctAnswer) {
                    correct++;
                    score += 2; // +2 for correct
                } else {
                    wrong++;
                    score -= 0.66; // -0.66 negative marking
                }
            }
        });

        // Ensure score isn't negative for display niceness (optional)
        // score = Math.max(0, score);

        return {
            id: crypto.randomUUID(), // Unique ID for this result
            timestamp: Date.now(),
            subject: this.state.subjectId,
            score: score,
            totalMarks: total * 2,
            correct: correct,
            wrong: wrong,
            skipped: total - (correct + wrong),
            accuracy: correct > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0,
            totalDuration: this.state.totalDuration - this.state.timeLeft
        };
    },

    _emit(type, payload = {}) {
        window.dispatchEvent(new CustomEvent('quiz-update', {
            detail: { type, state: this.state, ...payload }
        }));
    },

    // ============================================================
    // 5. DATA FETCHING (MOCK + REAL)
    // ============================================================

    async _fetchQuestions(subjectId) {
        // 1. Try fetching from DataSeeder (if stored in DB)
        // For now, we return a generated mock list for stability
        
        return Array.from({ length: 15 }, (_, i) => ({
            id: `q_${subjectId}_${i}`,
            text: `Question ${i + 1}: This is a sample question for ${subjectId}. It tests your conceptual understanding.`,
            options: [
                "Option A: This is a plausible distractor.",
                "Option B: This is the correct answer.",
                "Option C: This is completely wrong.",
                "Option D: This is confusing."
            ],
            correctAnswer: 1 // Always B for test
        }));
    }
};

