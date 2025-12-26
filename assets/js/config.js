/**
 * CONFIGURATION REGISTRY
 * Version: 2.3.0 (Patched: Correct UPSC Marking Scheme)
 * Path: assets/js/config.js
 * Responsibilities:
 * 1. Defines the Global App Settings (Name, Version, DB).
 * 2. maintain the "Single Source of Truth" for Subject IDs, Colors, and Icons.
 * 3. Centralizes difficulty weights and behavioral constants.
 * * NOTE: This file contains DATA CONFIGURATION. No CSS refactoring required.
 */

export const CONFIG = {
    // ============================================================
    // 1. GLOBAL APP SETTINGS
    // ============================================================
    name: "UPSC SuperApp",
    version: "3.2.0",
    debug: true, // Set to false in production to suppress console logs
    
    // Database Config (Must match what is in db.js)
    dbName: 'UPSCSuperApp_DB',
    dbVersion: 2,

    // ============================================================
    // 2. SUBJECT TAXONOMY: PAPER 1 (GENERAL STUDIES)
    // ============================================================
    // IDs must match the keys used in 'questions.json' and 'AcademicEngine'.
    
    subjectsGS1: [
        {
            id: 'polity',
            name: 'Indian Polity',
            icon: 'scale-balanced', // FontAwesome class (fa-scale-balanced)
            color: 'blue',          // Tailwind color palette (blue-500, blue-100)
            weight: 0.18,           // Approximate exam weightage (18%)
            description: 'Constitution, Governance, and Political System'
        },
        {
            id: 'history_modern',
            name: 'Modern History',
            icon: 'landmark-dome',
            color: 'amber',
            weight: 0.12,
            description: 'Freedom Struggle (1857-1947)'
        },
        {
            id: 'history_ancient',
            name: 'Ancient & Medieval',
            icon: 'scroll',
            color: 'orange',
            weight: 0.08,
            description: 'Art, Culture, and Dynasties'
        },
        {
            id: 'geography',
            name: 'Geography',
            icon: 'earth-asia',
            color: 'emerald',
            weight: 0.14,
            description: 'Physical, Social, and Economic Geography'
        },
        {
            id: 'economy',
            name: 'Economy',
            icon: 'chart-line',
            color: 'teal',
            weight: 0.15,
            description: 'Macroeconomics and Development'
        },
        {
            id: 'environment',
            name: 'Environment',
            icon: 'tree',
            color: 'green',
            weight: 0.16,
            description: 'Ecology, Biodiversity, and Climate Change'
        },
        {
            id: 'science',
            name: 'Science & Tech',
            icon: 'microchip',
            color: 'indigo',
            weight: 0.10,
            description: 'Biology, Space, and Emerging Tech'
        },
        {
            id: 'current_affairs',
            name: 'Current Affairs',
            icon: 'newspaper',
            color: 'rose',
            weight: 0.07,
            description: 'International Relations and News'
        }
    ],
    // ============================================================
    // 3. SUBJECT TAXONOMY: PAPER 2 (CSAT)
    // ============================================================
    
    subjectsCSAT: [
        {
            id: 'csat_quant',
            name: 'Quant (Math)',
            icon: 'calculator',
            color: 'violet',
            weight: 0.35,
            description: 'Arithmetic, Algebra, and Geometry'
        },
        {
            id: 'csat_logic',
            name: 'Logical Reasoning',
            icon: 'puzzle-piece',
            color: 'purple',
            weight: 0.30,
            description: 'Analytical Ability and Problem Solving'
        },
        {
            id: 'csat_rc',
            name: 'Reading Comp.',
            icon: 'book-open-reader',
            color: 'pink',
            weight: 0.35,
            description: 'Comprehension and Inference'
        }
    ],

    // ============================================================
    // 4. ARCADE MODES (THE GYM)
    // ============================================================
    // Defines the mini-games available in the Arcade View.
    
    arcadeModes: [
        {
            id: 'blink_test',
            name: 'Blink Test',
            icon: 'eye',
            color: 'cyan',
            description: 'Train your focus and reaction speed.'
        },
        {
            id: 'pressure_valve',
            name: 'Pressure Valve',
            icon: 'gauge-high',
            color: 'red',
            description: 'Manage stress under rapid-fire questions.'
        },
        {
            id: 'pattern_architect',
            name: 'Pattern Architect',
            icon: 'layer-group',
            color: 'yellow',
            description: 'Enhance fluid intelligence and logic.'
        },
        {
            id: 'balloon_pop',
            name: 'Risk Balloon',
            icon: 'wind', 
            color: 'rose',
            description: 'Test your risk appetite. Pump it up without popping!'
        }
    ],

    // ============================================================
    // 5. GLOBAL CONSTANTS
    // ============================================================
    
    settings: {
        examDate: '2026-05-25', // Target Date for countdowns
        
        // --- UPSC MARKING SCHEME ---
        passingMarks: 66.67,     // CSAT Qualification (33% of 200)
        
        // GS Paper 1 (100 Qs, 200 Marks)
        totalMarksGS: 200,
        marksPerQuestionGS: 2.0,
        
        // GS Paper 2 / CSAT (80 Qs, 200 Marks)
        totalMarksCSAT: 200,
        marksPerQuestionCSAT: 2.5, 

        // Penalty Ratio (Standard 1/3rd deduction)
        // Use this to calculate penalty: correctMark * negativeMarkingRatio
        negativeMarkingRatio: 1/3, 
        
        // Behavioral Thresholds (Synced with Engine)
        impulseThreshold: 1500, // ms
        panicThreshold: 3       // consecutive wrong answers
    }
};

window.CONFIG = CONFIG;

