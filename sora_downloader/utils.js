'use strict';
const path = require('path');
const fs = require('fs');
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');


/**
 * 从 URL 中提取 ID
 * @param {string} url - 完整的 URL (如: https://sora.chatgpt.com/p/s_68e5d5037b4c8191b33992ce7f8feaee)
 * @returns {string|null} ID (如: s_68e5d5037b4c8191b33992ce7f8feaee) 或 null
 */
function extractIdFromUrl(url) {
    // 如果输入已经是 ID 格式，直接返回
    if (url.startsWith('s_') && !url.includes('/')) {
        return url;
    }
    
    // 使用正则表达式匹配 s_ 开头的 ID
    // 支持多种 URL 格式:
    // - https://sora.chatgpt.com/p/s_68e5d5037b4c8191b33992ce7f8feaee
    // - https://sora.chatgpt.com/backend/project_y/post/s_68e75d088d0881918a92461a0f7aacf5
    const match = url.match(/\/(s_[a-f0-9]+)/i);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}


const ARG_CONFIG = {
    url: {
        alias: 'u',
        type: 'string',
        describe: 'Sora explore URL that contains the video to download',
        demandOption: true
    },
    output: {
        alias: 'o',
        type: 'string',
        describe: 'Destination file or directory. Defaults to ./downloads/<slug>.mp4'
    },
    auth: {
        alias: 'a',
        type: 'string',
        describe: 'Authorization token or header value. If omitted, SORA_AUTH_TOKEN or HTTP_AUTHORIZATION_HEADER env vars are used.'
    },
    'auth-file': {
        type: 'string',
        describe: 'Path to a file containing the authorization header/token'
    },
    'cookie-file': {
        type: 'string',
        describe: 'Path to a file containing the cookies'
    },

    'device-id': {
        type: 'string',
        describe: 'Override the OAI-Device-Id header'
    },
    'user-agent': {
        type: 'string',
        describe: 'Override the User-Agent header'
    },
    verbose: {
        alias: 'v',
        type: 'boolean',
        default: false,
        describe: 'Enable verbose logging'
    },
    'skip-cert-check': {
        type: 'boolean',
        default: false,
        describe: 'Disable TLS certificate verification (use with caution)'
    },
    headless: {
        type: 'boolean',
        default: false,
        describe: 'Run Puppeteer in headless mode'
    },
    'wait-selector': {
        type: 'string',
        describe: 'CSS selector to wait for before scraping videos',
        default: 'video'
    }
};

function parseArguments(processArgs) {
	const parser = yargs(hideBin( processArgs ));
	const width = typeof parser.terminalWidth === 'function' ? parser.terminalWidth() : (process.stdout && process.stdout.columns ? process.stdout.columns : 120);

	return parser
		.usage('$0 --url <Sora explore URL> [options]')
		.options(ARG_CONFIG)
		.help()
		.alias('help', 'h')
		.wrap(Math.min(120, width))
		.parse();
}







function ensureBearer(token) {
    if (!token) {
        return null;
    }
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function getCookie(arguments_1, processEnv) {
    if (arguments_1['cookie-file']) {
        const resolvedPath = path.resolve(process.cwd(), arguments_1['cookie-file'] || "cookies.txt");
        const contents = fs.readFileSync(resolvedPath, 'utf8');
        const token = contents.trim();
        return token;
    }
}

function getCookieArray(cookieTxt, options = {}) {
    const {
        domain = 'sora.chatgpt.com',
        path: cookiePathValue = '/',
        secure = true,
        httpOnly = true,
        decodeValues = false,
        dedupe = true
    } = options;

    cookieTxt = cookieTxt || "";
    const cookieString = cookieTxt.trim();

    if (!cookieString) {
        return [];
    }

    const entries = cookieString.split(/;\s*/).filter(Boolean);
    const cookies = dedupe ? new Map() : [];

    for (const entry of entries) {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }

        const name = entry.slice(0, separatorIndex).trim();
        if (!name) {
            continue;
        }

        const rawValue = entry.slice(separatorIndex + 1).trim();
        let value = rawValue;

        if (decodeValues && value) {
            try {
                value = decodeURIComponent(value);
            } catch (error) {
                // Ignore decoding errors and fall back to the raw value
                value = rawValue;
            }
        }

        const descriptor = {
            name,
            value,
            domain,
            path: cookiePathValue,
            httpOnly,
            secure
        };

        if (dedupe) {
            cookies.set(name, descriptor);
        } else {
            cookies.push(descriptor);
        }
    }

    return dedupe ? Array.from(cookies.values()) : cookies;
}

function resolveAuthorizationToken(arguments_1, processEnv) {
    if (arguments_1['auth-file']) {
        
        const resolvedPath = path.resolve(process.cwd(), arguments_1['auth-file'] || "token.txt");
        const contents = fs.readFileSync(resolvedPath, 'utf8');
        const token = contents.trim();
        
        return ensureBearer(token);
    }

    if (arguments_1.auth) {
        return ensureBearer(arguments_1.auth.trim());
    }

    const envToken = processEnv.SORA_AUTH_TOKEN || processEnv.HTTP_AUTHORIZATION_HEADER;
    return envToken ? ensureBearer(envToken.trim()) : null;
}

const DEFAULT_HEADERS = {
	'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
	'content-type': 'application/json',
	'referer': 'https://sora.chatgpt.com/explore',
	'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'origin': 'https://sora.chatgpt.com',
    'referer': 'https://sora.chatgpt.com/',
    'oai-device-id': 'd439c49e-4d7f-48e0-98e8-6025343e719c'
};



function buildHeaders(arguments_2, processEnv) {
    const headers = { ...DEFAULT_HEADERS };

    const authHeaderToken = resolveAuthorizationToken(arguments_2, processEnv);
    if (authHeaderToken) {
        headers['authorization'] = authHeaderToken;
    }

    if (arguments_2['device-id']) {
        headers['oai-device-id'] = arguments_2['device-id'];
    }

    if (arguments_2['user-agent']) {
        headers['user-agent'] = arguments_2['user-agent'];
    }

    const cookieObj = getCookie(arguments_2, processEnv);
    if (cookieObj) {
        headers['cookie'] = cookieObj;
    }
    // console.log("cookieString:",headers['cookie'])
    return headers;
}

module.exports = {
    extractIdFromUrl,
    parseArguments,
    resolveAuthorizationToken,
    buildHeaders,
    getCookieArray
};


