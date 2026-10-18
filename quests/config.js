const ENROLL_LOCATIONS = [11, 7, 12, 4, 3, 1, 8, 10, 2, 6];
const MAX_TASK_ATTEMPTS = 3;
const CLAIM_SKIP_IDS = new Set(['1412491570820812933']);
const API_BASE = 'https://discord.com/api/v10';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36';

module.exports = { ENROLL_LOCATIONS, MAX_TASK_ATTEMPTS, CLAIM_SKIP_IDS, API_BASE, USER_AGENT };
