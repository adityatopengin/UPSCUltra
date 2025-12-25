/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.9.1 (Patched: Toggle Logic + Review Data Fix)
 * Path: assets/js/engine/quiz-engine.js
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
        answers: {}, // Key: Question Index (Int), Value: Option Index (Int)
        bookmarks: new Set(),
        currentIndex: 0,
        // Telemetry Data (Passed to Behavioral Engine later)
        telemetry: {
            impulseClicks: 0,
            switches: {},
            timePerQuestion: {},
            questionStartTimes: {}
        }
    },

    timerInterval: null,

    // ============================================================
    // 2. SESSION MANAGEMENT
    // ============================================================
    
    // 🛡️ FIX: Added 'options' param to support Mock Limits
    async startSession(subjectId, options = {}) {
        console.log(`🧠 Engine: Starting Session for ${subjectId}`, options);
        
        // 1. Check for Orphan Session (Persistence)
        const savedState = localStorage.getItem('quiz_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.active && parsed.subjectId === subjectId) {
                    console.log("🧠 Engine: Restoring Orphan Session...");
                    this.state = {
                        ...parsed,
                        bookmarks: new Set(parsed.bookmarks),
                        telemetry: parsed.telemetry || { impulseClicks: 0, switches: {}, timePerQuestion: {}, questionStartTimes: {} }
                    };
                    this._startTimer();
                    this._emit('SESSION_START');
                    return;
                }
            } catch(e) { localStorage.removeItem('quiz_state'); }
        }

        // 2. Clean Slate
        this.terminateSession(); 

        // 3. Setup New State
        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.bookmarks = new Set();
        this.state.telemetry = { impulseClicks: 0, switches: {}, timePerQuestion: {}, questionStartTimes: {} };

        // 4. Load Questions (Standard vs Mock)
        if (subjectId.startsWith('mock_')) {
            this.state.questions = await this._generateMockPaper(subjectId, options.limit || 50);
        } else {
            this.state.questions = await this._fetchQuestions(subjectId);
        }
        
        if (!this.state.questions || this.state.questions.length === 0) {
            console.error("Engine: No questions found in DB!");
            this.state.active = false; 
            throw new Error("QUIZ_ABORT_NO_DATA"); 
        }

        // 5. Set Timer (2 mins per question)
        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // 6. Initialize First Question Telemetry
        this.state.telemetry.questionStartTimes[0] = Date.now();

        // 7. Start
        this._startTimer();
        this._saveState(); // Initial Save
        this._emit('SESSION_START');
    },
     
    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        
        // Capture time for the final question before closing
        this._recordTime(this.state.currentIndex);

        this._stopTimer();
        this.state.active = false;
        
        // Clear local persistence on explicit finish
        localStorage.removeItem('quiz_state');

        const result = this._calculateResult();

        try {
            // Save raw history (Report Card)
            await DB.put('history', result);
            console.log("🧠 Engine: Results Saved Successfully.");

            // Handshake: Main.js will pick this up
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }

        } catch (e) {
            console.error("Engine: Save Failed", e);
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }
        }
    },

    terminateSession() {
        this._stopTimer();
        this.state.active = false;
        localStorage.removeItem('quiz_state');
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;

        const currentIndex = this.state.currentIndex;

        // Telemetry: Track Answer Switching
        const prevAnswer = this.state.answers[currentIndex]; 
        
        if (prevAnswer !== undefined && prevAnswer !== optionIndex) {
             if (!this.state.telemetry.switches[currentIndex]) {
                this.state.telemetry.switches[currentIndex] = 0;
            }
            this.state.telemetry.switches[currentIndex]++;
        }

        // Telemetry: Record time spent so far
        this._recordTime(currentIndex);

        // 🛡️ FIX: TOGGLE LOGIC (Select / Unselect)
        // If clicking the same option again, deselect it (delete from answers)
        if (this.state.answers[currentIndex] === optionIndex) {
            delete this.state.answers[currentIndex];
            optionIndex = null; // Signal UI to remove highlight
        } else {
            this.state.answers[currentIndex] = optionIndex;
        }
        
        this._saveState();
        this._emit('ANSWER_SAVED', { questionId: currentIndex, optionIndex });
    },

    toggleBookmark(questionId) {
        if (this.state.bookmarks.has(questionId)) {
            this.state.bookmarks.delete(questionId);
        } else {
            this.state.bookmarks.add(questionId);
        }
        this._saveState();
        this._emit('BOOKMARK_TOGGLED', { questionId });
    },

    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this._handleNavigation(this.state.currentIndex, this.state.currentIndex + 1);
        }
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this._handleNavigation(this.state.currentIndex, this.state.currentIndex - 1);
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length && index !== this.state.currentIndex) {
            this._handleNavigation(this.state.currentIndex, index);
        }
    },

    // ============================================================
    // 4. INTERNAL UTILITIES
    // ============================================================

    _handleNavigation(fromIndex, toIndex) {
        // 1. Record Impulse Click (if < 1.5s spent)
        const startTime = this.state.telemetry.questionStartTimes[fromIndex] || Date.now();
        const timeOnQuestion = Date.now() - startTime;
        if (timeOnQuestion < 1500) { 
            this.state.telemetry.impulseClicks++;
        }

        // 2. Accumulate Time
        this._recordTime(fromIndex);

        // 3. Switch Index
        this.state.currentIndex = toIndex;

        // 4. Start Timer for New Question
        this.state.telemetry.questionStartTimes[toIndex] = Date.now();

        this._saveState();
        this._emit('NAVIGATE');
    },

    _recordTime(index) {
        const now = Date.now();
        const start = this.state.telemetry.questionStartTimes[index];
        
        if (start) {
            const delta = now - start;
            if (!this.state.telemetry.timePerQuestion[index]) {
                this.state.telemetry.timePerQuestion[index] = 0;
            }
            this.state.telemetry.timePerQuestion[index] += delta;
            this.state.telemetry.questionStartTimes[index] = now;
        }
    },

    _saveState() {
        const storageObj = {
            ...this.state,
            bookmarks: Array.from(this.state.bookmarks) // Convert Set for JSON
        };
        localStorage.setItem('quiz_state', JSON.stringify(storageObj));
    },

    _startTimer() {
        this._stopTimer(); 
        this.timerInterval = setInterval(() => {
            this.state.timeLeft--;
            if (this.state.timeLeft % 10 === 0) this._saveState();

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

        // 🛡️ FIX: Map User Answers into the Result Object
        // This is critical for the Review Screen to show what you clicked
        const processedQuestions = this.state.questions.map((q, idx) => {
            const userAnswer = this.state.answers[idx];
            let isCorrect = false;

            if (userAnswer !== undefined && userAnswer !== null) {
                if (userAnswer === q.correctAnswer) {
                    correct++;
                    score += 2;
                    isCorrect = true;
                } else {
                    wrong++;
                    score -= 0.66;
                    isCorrect = false;
                }
            }
            
            return {
                ...q,
                userAnswer: userAnswer, // The missing link for Review UI
                isCorrect: isCorrect
            };
        });

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
            totalDuration: this.state.totalDuration - this.state.timeLeft,
            questions: processedQuestions, // Send the processed list
            telemetry: {
                impulseClicks: this.state.telemetry.impulseClicks,
                switches: this.state.telemetry.switches,
                timePerQuestion: this.state.telemetry.timePerQuestion
            }
        };
    },

    _emit(type, payload = {}) {
        window.dispatchEvent(new CustomEvent('quiz-update', {
            detail: { type, state: this.state, ...payload }
        }));
    },

    // ============================================================
    // 6. DATA FETCHING (STANDARD & MOCK)
    // ============================================================

    // 🛡️ FIX: New Mock Generator with "Smart Filter" Logic
    async _generateMockPaper(mockId, totalLimit) {
        console.log(`🧠 Engine: Generating ${mockId} with ${totalLimit} questions...`);
        
        let allQuestions = [];
        // 1. Identify Syllabus
        const subjectsConfig = mockId.includes('csat') ? CONFIG.subjectsCSAT : CONFIG.subjectsGS1;
        
        // 2. Build "Mastered" List (Smart Filter)
        const masteredIds = new Set();
        try {
            const history = await DB.getAll('history');
            if (history) {
                history.forEach(h => {
                    if (h.questions) {
                        h.questions.forEach(q => {
                            if (q.isCorrect) masteredIds.add(q.id);
                        });
                    }
                });
            }
        } catch (e) { console.warn("Engine: Could not fetch history for filter", e); }

        // 3. Fetch for each subject based on weightage
        for (const sub of subjectsConfig) {
            const targetCount = Math.ceil(totalLimit * (sub.weight || 0.1));
            
            // Fetch keys for this subject
            // We use getRandomKeys with a high limit to act as "getAllKeys" for the subject
            const keys = await DB.getRandomKeys('questions', 'subject', sub.id, 500); 
            
            if (keys.length > 0) {
                // Filter: Separate New vs Old
                const freshKeys = keys.filter(k => !masteredIds.has(k));
                const masteredKeys = keys.filter(k => masteredIds.has(k));

                // Shuffle
                this._shuffleArray(freshKeys);
                this._shuffleArray(masteredKeys);

                // Select: Prioritize Fresh, Fallback to Mastered
                let selectedKeys = [];
                if (freshKeys.length >= targetCount) {
                    selectedKeys = freshKeys.slice(0, targetCount);
                } else {
                    selectedKeys = [...freshKeys];
                    const remaining = targetCount - freshKeys.length;
                    selectedKeys = selectedKeys.concat(masteredKeys.slice(0, remaining));
                }

                // Fetch actual data
                const promises = selectedKeys.map(key => DB.get('questions', key));
                const qs = await Promise.all(promises);
                
                allQuestions = allQuestions.concat(qs);
            }
        }

        // 4. Final Shuffle of the aggregated paper
        this._shuffleArray(allQuestions);
        
        // 5. Trim to exact limit (in case rounding errors added extra)
        return allQuestions.slice(0, totalLimit).map(q => this._randomizeOptions(q));
    },

    async _fetchQuestions(subjectId) {
        try {
            const keys = await DB.getRandomKeys('questions', 'subject', subjectId, 15);
            if (!keys || keys.length === 0) return [];

            const promises = keys.map(key => DB.get('questions', key));
            const questions = await Promise.all(promises);
            return questions.map(q => this._randomizeOptions(q));

        } catch(e) {
            console.error("Engine: DB Fetch Failed", e);
            return [];
        }
    },

    _randomizeOptions(question) {
        const q = JSON.parse(JSON.stringify(question));
        const originalCorrectIndex = q.correctAnswer;

        let optionsWithIndex = q.options.map((text, idx) => ({ text, originalIndex: idx }));
        
        // Fisher-Yates Shuffle
        this._shuffleArray(optionsWithIndex);
        
        const newCorrectIndex = optionsWithIndex.findIndex(o => o.originalIndex === originalCorrectIndex);
        
        return {
            ...q,
            options: optionsWithIndex.map(o => o.text),
            correctAnswer: newCorrectIndex
        };
    },

    // Helper: Fisher-Yates Shuffle
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
};

