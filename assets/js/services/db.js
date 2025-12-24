/**
 * DB SERVICE (THE WAREHOUSE)
 * Path: assets/js/services/db.js
 * Version: 2.3.0 (Patched: Added Indexes for Source & Tags)
 * Status: Production Ready
 */

export const DB = {
    // Configuration
    _dbName: 'UPSCSuperApp_DB',
    // 🛡️ UPDATE: Bumped version to 3 to trigger schema upgrade for new fields
    _version: 3, 
    _db: null,

    // ============================================================
    // 1. CONNECTION & SCHEMA
    // ============================================================

    async connect() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, this._version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                console.log(`💾 DB: Upgrading Schema to v${this._version}...`);

                // 1. History
                if (!db.objectStoreNames.contains('history')) {
                    const hStore = db.createObjectStore('history', { keyPath: 'id' });
                    hStore.createIndex('timestamp', 'timestamp', { unique: false });
                    hStore.createIndex('subject', 'subject', { unique: false });
                }

                // 2. Mistakes
                if (!db.objectStoreNames.contains('mistakes')) {
                    const mStore = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
                    mStore.createIndex('qId', 'qId', { unique: false });
                    mStore.createIndex('subjectId', 'subjectId', { unique: false });
                }

                // 3. Questions (UPDATED)
                let qStore;
                if (!db.objectStoreNames.contains('questions')) {
                    qStore = db.createObjectStore('questions', { keyPath: 'id' });
                } else {
                    qStore = request.transaction.objectStore('questions');
                }

                // Standard Indexes
                if (!qStore.indexNames.contains('subject')) qStore.createIndex('subject', 'subject', { unique: false });
                if (!qStore.indexNames.contains('topic')) qStore.createIndex('topic', 'topic', { unique: false });
                if (!qStore.indexNames.contains('level')) qStore.createIndex('level', 'level', { unique: false });
                if (!qStore.indexNames.contains('random')) qStore.createIndex('random', 'random', { unique: false });

                // 🛡️ NEW: Support for Holistic Assessment Features
                // Allows filtering by "UPSC 2022" vs "Mock"
                if (!qStore.indexNames.contains('source')) qStore.createIndex('source', 'source', { unique: false });
                // Allows filtering by "Conceptual" vs "Factual"
                if (!qStore.indexNames.contains('type')) qStore.createIndex('type', 'type', { unique: false });
                // Allows searching by Tags (MultiEntry for Arrays)
                if (!qStore.indexNames.contains('tags')) qStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });


                // 4. Academic State
                if (!db.objectStoreNames.contains('academic_state')) {
                    db.createObjectStore('academic_state', { keyPath: 'subjectId' });
                }

                // 5. User Profiles
                if (!db.objectStoreNames.contains('profiles')) {
                    db.createObjectStore('profiles', { keyPath: 'userId' });
                }

                // 6. Telemetry
                if (!db.objectStoreNames.contains('telemetry')) {
                    const tStore = db.createObjectStore('telemetry', { keyPath: 'id', autoIncrement: true });
                    tStore.createIndex('sessionId', 'sessionId', { unique: false });
                    tStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };

            request.onerror = (e) => {
                console.error("💾 DB Connection Failed", e);
                reject(e);
            };
        });
    },

    // ============================================================
    // 2. CORE OPERATIONS
    // ============================================================

    async get(storeName, key) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async getAll(storeName) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(storeName, item) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            tx.oncomplete = () => resolve(req.result);
            tx.onerror = () => reject(tx.error);
        });
    },

    async delete(storeName, key) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    async clearStore(storeName) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    // ============================================================
    // 3. UTILITIES
    // ============================================================

    async bulkPut(storeName, items) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e);
        });
    },

    async getRandomKeys(storeName, indexName, value, count) {
        await this.connect();
        return new Promise((resolve) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const index = indexName ? store.index(indexName) : store;
            const req = indexName ? index.getAllKeys(value) : store.getAllKeys();

            req.onsuccess = () => {
                const keys = req.result;
                if (keys.length === 0) return resolve([]);
                const shuffled = keys.sort(() => 0.5 - Math.random());
                resolve(shuffled.slice(0, count));
            };
        });
    },
    
    close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }
};

/**
 * STORAGE SERVICE
 * Handles JSON Import/Export for Backup functionality
 */
export const StorageService = {
    async exportData() {
        // Gather all critical user data
        const data = {
            history: await DB.getAll('history'),
            profiles: await DB.getAll('profiles'),
            academic: await DB.getAll('academic_state'),
            mistakes: await DB.getAll('mistakes'),
            timestamp: Date.now()
        };
        return JSON.stringify(data);
    },

    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Clear existing data to avoid conflicts
            await DB.clearStore('history');
            await DB.clearStore('profiles');
            await DB.clearStore('academic_state');
            await DB.clearStore('mistakes');
            
            // Restore new data
            if(data.history) await DB.bulkPut('history', data.history);
            if(data.profiles) await DB.bulkPut('profiles', data.profiles);
            if(data.academic) await DB.bulkPut('academic_state', data.academic);
            if(data.mistakes) await DB.bulkPut('mistakes', data.mistakes);
            
            return true;
        } catch (e) {
            console.error("Import Failed:", e);
            throw new Error("Invalid Backup File");
        }
    }
};

