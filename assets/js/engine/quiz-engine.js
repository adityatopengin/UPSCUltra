/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.3.0 (Fixed Save Crash & Timer)
 * Path: assets/js/engine/quiz-engine.js
 */

import { DB } from '../services/db.js';

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
        answers: {}, 
        bookmarks: new Set(),
        currentIndex: 0
    },

    timerInterval: null,

    // ============================================================
    // 2. SESSION MANAGEMENT
    // ============================================================

    async startSession(subjectId) {
        console.log(`🧠 Engine: Starting Session for ${subjectId}`);
        
        // 1. Clean Slate
        this.terminateSession(); // Ensure any old timers are killed

        // 2. Setup New State
        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.bookmarks = new Set();

        // 3. Load Questions
        this.state.questions = await this._fetchQuestions(subjectId);
        
        if (!this.state.questions || this.state.questions.length === 0) {
            console.error("Engine: No questions found!");
            return;
        }

        // 4. Set Timer (2 mins per question)
        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // 5. Start Timer Loop
        this._startTimer();

        // 6. Notify UI
        this._emit('SESSION_START');
    },

    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        this._stopTimer();
        this.state.active = false;

        const result = this._calculateResult();

        try {
            // 1. Save to History
            await DB.add('history', result);
            
            // 2. Update Mastery (The missing function!)
            await this._updateMastery(result);

            console.log("🧠 Engine: Results Saved Successfully.");

            // 3. Navigate to Results
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }

        } catch (e) {
            console.error("Engine: Save Failed", e);
            // Even if save fails, show results so user doesn't get stuck
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }
        }
    },

    terminateSession() {
        this._stopTimer();
        this.state.active = false;
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;
        this.state.answers[questionId] = optionIndex;
        this._emit('ANSWER_SAVED', { questionId, optionIndex });
    },

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
        this._stopTimer(); // Safety clear
        
        this.timerInterval = setInterval(() => {
            this.state.timeLeft--;
            
            window.dispatchEvent(new CustomEvent('quiz-tick', { 
                detail: { timeLeft: this.state.timeLeft } 
            }));

            if (this.state.timeLeft <= 0) {
                this.submitQuiz(); 
            }
        }, 1000);
    },

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
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
                    score += 2;
                } else {
                    wrong++;
                    score -= 0.66;
                }
            }
        });

        // Use Date.now() if crypto is unavailable (older phones)
        const id = (window.crypto && window.crypto.randomUUID) 
            ? crypto.randomUUID() 
            : 'res_' + Date.now();

        return {
            id: id,
            timestamp: Date.now(),
            subject: this.state.subjectId,
            score: Number(score.toFixed(2)),
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
    // 5. MISSING FUNCTION ADDED HERE
    // ============================================================
    async _updateMastery(result) {
        try {
            // Update the "Academic State" table for the Oracle
            const subjectId = result.subject;
            const currentEntry = await DB.get('academic_state', subjectId) || { subjectId, mastery: 0, attempts: 0 };
            
            // Simple Moving Average for Mastery
            const newMastery = ((currentEntry.mastery * currentEntry.attempts) + result.score) / (currentEntry.attempts + 1);
            
            currentEntry.mastery = newMastery;
            currentEntry.attempts += 1;
            currentEntry.lastStudied = Date.now();

            await DB.put('academic_state', currentEntry);
            
        } catch (e) {
            console.warn("Engine: Failed to update mastery stats (non-critical)", e);
        }
    },

    // ============================================================
    // 6. DATA FETCHING
    // ============================================================

    async _fetchQuestions(subjectId) {
        // Mock Generator
        return Array.from({ length: 15 }, (_, i) => ({
            id: `q_${subjectId}_${i}`,
            text: `Question ${i + 1} for ${subjectId}. <br> What is the correct answer?`,
            options: [
                "This is the wrong answer",
                "This is the correct answer (Option B)",
                "Another wrong answer",
                "Definitely not this one"
            ],
            correctAnswer: 1 
        }));
    }
};

