'use strict';
const path = require('path');
const fsp = require('fs').promises;
const { hideBin } = require('yargs/helpers');
const yargs = require('yargs/yargs');



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


const DEFAULT_HEADERS = {
	accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
	'content-type': 'application/json',
	referer: 'https://sora.chatgpt.com/explore',
	'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};




function ensureBearer(token) {
    if (!token) {
        return null;
    }
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

async function resolveAuthorizationToken(arguments_1, processEnv) {
    if (arguments_1['auth-file']) {
        
        const resolvedPath = path.resolve(process.cwd(), arguments_1['auth-file']);
        const contents = await fsp.readFile(resolvedPath, 'utf8');
        const token = contents.trim();
        
        return ensureBearer(token);
    }

    if (arguments_1.auth) {
        return ensureBearer(arguments_1.auth.trim());
    }

    const envToken = processEnv.SORA_AUTH_TOKEN || processEnv.HTTP_AUTHORIZATION_HEADER;
    return envToken ? ensureBearer(envToken.trim()) : null;
}


async function buildHeaders(arguments_2, processEnv) {
    const headers = { ...DEFAULT_HEADERS };

    const authHeaderToken = await resolveAuthorizationToken(arguments_2, processEnv);

    if (authHeaderToken) {
        headers.authorization = authHeaderToken;
    }

    if (arguments_2['device-id']) {
        headers['oai-device-id'] = arguments_2['device-id'];
    }

    if (arguments_2['user-agent']) {
        headers['user-agent'] = arguments_2['user-agent'];
    }

    return headers;
}

module.exports = {
    parseArguments,
    resolveAuthorizationToken,
    buildHeaders
};


