/**
 * DATA SEEDER (THE GENESIS)
 * Version: 2.1.0 (Hybrid: JSON-First with Generator Fallback)
 * Path: assets/js/services/data-seeder.js
 * Responsibilities:
 * 1. Checks if the App Database is empty on boot.
 * 2. Tries to load real questions from 'assets/data/*.json'.
 * 3. Falls back to internal Mock Generator if files are missing.
 * 4. Populates IndexedDB.
 */

import { DB } from './db.js';
import { CONFIG } from '../config.js';

export const DataSeeder = {
    // ============================================================
    // 1. CONTROL FLOW
    // ============================================================

    /**
     * Called by Main.js during the boot sequence.
     * Returns a Promise that resolves when data is ready.
     */
    async init() {
        console.log("🌱 DataSeeder: Checking database status...");

        try {
            const isEmpty = await this._checkIfEmpty();
            
            if (isEmpty) {
                console.log("🌱 DataSeeder: Database is empty. Initiating Genesis...");
                // Notify UI (if loader exists)
                const loaderText = document.querySelector('#boot-loader div:last-child');
                if (loaderText) loaderText.textContent = "Generating Question Bank...";
                
                await this.seed();
                console.log("🌱 DataSeeder: Genesis Complete.");
            } else {
                console.log("🌱 DataSeeder: Database already populated. Skipping.");
            }
        } catch (e) {
            console.error("🌱 DataSeeder: Critical Failure", e);
        }
    },

    /**
     * Verify if the 'questions' store has any data.
     */
    async _checkIfEmpty() {
        // We assume if there are < 5 questions, it's effectively empty/broken.
        const keys = await DB.getRandomKeys('questions', null, null, 10);
        return keys.length < 5;
    },

    /**
     * The Master Seeder Function
     */
    async seed() {
        const startTime = Date.now();
        
        // 1. Gather Data (Try JSON -> Fallback to Mock)
        const allQuestions = await this._gatherAllData();

        if (allQuestions.length === 0) {
            console.warn("🌱 DataSeeder: No questions generated! Check configuration.");
            return;
        }

        // 2. Bulk Insert into DB
        // DB.bulkPut is optimized for single-transaction writes
        await DB.bulkPut('questions', allQuestions);

        // 3. Log Performance
        const duration = Date.now() - startTime;
        console.log(`🌱 DataSeeder: Planted ${allQuestions.length} questions in ${duration}ms.`);
    },

    // ============================================================
    // 2. DATA GATHERING (THE HYBRID ENGINE)
    // ============================================================

    async _gatherAllData() {
        let masterDataset = [];
        
        // Combine GS and CSAT subjects
        const allSubjects = [...CONFIG.subjectsGS1, ...CONFIG.subjectsCSAT];

        // Process subjects sequentially to manage resources
        for (const sub of allSubjects) {
            let subjectQs = [];

            try {
                // A. TRY EXTERNAL JSON
                // We attempt to fetch a file named exactly like the ID (e.g., 'polity.json')
                const response = await fetch(`assets/data/${sub.id}.json`);
                
                if (response.ok) {
                    const jsonData = await response.json();
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        console.log(`🌱 DataSeeder: Loaded ${jsonData.length} Qs from ${sub.id}.json`);
                        // Normalize data to ensure it has required fields
                        subjectQs = jsonData.map((q, idx) => ({
                            ...q,
                            id: q.id || `json_${sub.id}_${idx}`,
                            subject: sub.id, // Enforce correct subject ID
                            random: Math.random() // Ensure random index exists
                        }));
                    } else {
                        throw new Error("Empty or invalid JSON");
                    }
                } else {
                    throw new Error(`File not found (Status: ${response.status})`);
                }

            } catch (e) {
                // B. FALLBACK TO GENERATOR
                // If 404 or bad JSON, we quietly switch to internal logic
                // console.warn(`🌱 DataSeeder: Could not load ${sub.id}.json (${e.message}). Using Mock Generator.`);
                subjectQs = this._generateMockQuestionsForSubject(sub.id, sub.name);
            }

            masterDataset = masterDataset.concat(subjectQs);
        }

        return masterDataset;
    },

    // ============================================================
    // 3. MOCK GENERATOR (THE FALLBACK FACTORY)
    // ============================================================

    _generateMockQuestionsForSubject(subjectId, subjectName) {
        // Generate 50 questions per subject for the MVP
        return Array.from({ length: 50 }, (_, i) => 
            this._createMockQuestion(subjectId, subjectName, i)
        );
    },

    /**
     * Creates a single question object with realistic metadata.
     */
    _createMockQuestion(subjectId, subjectName, index) {
        // 1. Determine Difficulty based on index
        let level = 'L2';
        if (index < 10) level = 'L1';
        else if (index >= 30) level = 'L3';

        // 2. Select a Topic
        const topic = this._getTopicForSubject(subjectId, index);

        // 3. Generate Text Templates
        const qText = this._generateQuestionText(subjectId, topic, level, index);
        
        return {
            id: `seed_${subjectId}_${index}`,
            subject: subjectId,
            topic: topic,
            level: level, // L1, L2, L3
            text: qText.question,
            options: qText.options,
            correctOption: Math.floor(Math.random() * 4), // Random correct answer (0-3)
            explanation: qText.explanation,
            
            // Metadata for indexing
            random: Math.random(), 
            source: 'Gyan Amala Core (Mock)'
        };
    },

    /**
     * Returns a relevant sub-topic based on subject.
     */
    _getTopicForSubject(subId, index) {
        const topics = {
            polity: ['Preamble', 'Fundamental Rights', 'Parliament', 'Judiciary', 'Amendments'],
            history_modern: ['1857 Revolt', 'Gandhian Era', 'Congress Sessions', 'Social Reforms', 'Acts & Viceroys'],
            geography: ['Monsoon', 'River Systems', 'Minerals', 'Physical Features', 'Climate Types'],
            economy: ['Banking', 'Budget', 'Inflation', 'BOP', 'Agriculture'],
            environment: ['National Parks', 'Pollution', 'Climate Change', 'Biodiversity', 'Acts & Protocols'],
            science: ['Space Tech', 'Diseases', 'Nano Tech', 'Defense', 'Biotech'],
            csat_quant: ['Number System', 'Percentage', 'Time & Work', 'Speed & Distance', 'Permutation'],
            csat_logic: ['Syllogism', 'Blood Relations', 'Direction Sense', 'Coding-Decoding', 'Seating'],
            csat_rc: ['Inference', 'Assumption', 'Main Idea', 'Tone', 'Conclusion']
        };

        const list = topics[subId] || ['General'];
        return list[index % list.length];
    },

    /**
     * Generates realistic text string.
     */
    _generateQuestionText(subId, topic, level, index) {
        // Base Template
        const base = {
            question: `Which of the following statements regarding <b>${topic}</b> is/are correct in the context of ${subId}?`,
            options: [
                "1 only",
                "2 only",
                "Both 1 and 2",
                "Neither 1 nor 2"
            ],
            explanation: `Statement 1 is correct because [AI Generated Reason]. Statement 2 is incorrect due to factual error regarding ${topic}. Refer to Standard Text Ch. ${index + 1}.`
        };

        // Customization for CSAT (Math/Logic needs numbers)
        if (subId.includes('csat')) {
            base.question = `(Mock CSAT ${topic}) If X is ${index * 5}% of Y, and Y is ${index + 10} more than Z, find the value of Z?`;
            base.options = [
                (index * 10).toString(),
                (index * 12).toString(),
                (index * 15).toString(),
                (index * 20).toString()
            ];
            base.explanation = "Use the formula: P = (R/100) * B. Solving for Z gives the answer.";
        } 
        // Customization for Hard Questions (L3)
        else if (level === 'L3') {
            base.question = `Consider the following assertions about <b>${topic}</b>:\n1. It was first introduced in ${1900 + index}.\n2. It violates Article ${10 + index}.\n3. It has been amended ${index} times.\n\nWhich of the above are correct?`;
            base.options = [
                "1 and 2 only",
                "2 and 3 only",
                "1 and 3 only",
                "1, 2 and 3"
            ];
        }

        return base;
    }
};

// Global Exposure (Allows Main.js to call DataSeeder.init())
window.DataSeeder = DataSeeder;

