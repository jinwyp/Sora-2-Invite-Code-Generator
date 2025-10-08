#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');


const { parseArguments, buildHeaders } = require('./utils');
// Load environment variables from a .env file if present
try {
	require('dotenv').config();
} catch (error) {
	// dotenv is optional; ignore if not installed
}





function buildDownloadHeaders(baseHeaders, downloadUrl) {
	const headers = {
		...baseHeaders,
		accept: 'video/*,application/octet-stream;q=0.9,*/*;q=0.8'
	};

	const urlObj = safeParseUrl(downloadUrl);
	const hostname = urlObj ? urlObj.hostname : null;
	const isSoraHost = hostname && hostname.endsWith('sora.chatgpt.com');

	if (!isSoraHost) {
		delete headers.authorization;
		delete headers['oai-device-id'];
		delete headers['content-type'];
		delete headers['content-length'];
	}

	return headers;
}

function buildRequestOptions(downloadUrl, headers, agent) {
	const urlObj = new URL(downloadUrl);
	return {
		protocol: urlObj.protocol,
		hostname: urlObj.hostname,
		path: `${urlObj.pathname}${urlObj.search}`,
		headers,
		agent
	};
}

function performHttpRequest(options) {
	const protocolModule = options.protocol === 'http:' ? require('http') : require('https');
	return new Promise((resolve, reject) => {
		const request = protocolModule.request(
			options,
			(response) => {
				const statusCode = response.statusCode || 0;
				if (statusCode >= 200 && statusCode < 400) {
					resolve(response);
				} else {
					response.resume();
					reject(new Error(`Failed to download video: ${statusCode} ${response.statusMessage || ''}`));
				}
			}
		);

		request.on('error', (error) => {
			reject(error);
		});

		request.end();
	});
}





async function ensureDirectory(dirPath) {
	await fsp.mkdir(dirPath, { recursive: true });
}

function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return 'unknown size';
	}
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let index = 0;
	let value = bytes;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index++;
	}
	return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateStamp() {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${yyyy}${mm}${dd}`;
}
function safeParseUrl(rawUrl) {
	try {
		return new URL(rawUrl);
	} catch (error) {
		return null;
	}
}


async function downloadSoraSingleVideo({ downloadUrl, outputPath, id, authorId, headers, agent, videoData }) {
	
	// Write JSON data to file
	const dateStamp = formatDateStamp();

	const jsonFileName = `${dateStamp}_${videoData.post.id}_${authorId}.json`;
	const jsonFilePath = path.join(process.cwd(), outputPath, jsonFileName);
	await fsp.mkdir(path.dirname(jsonFilePath), { recursive: true });

	const outputJSON = JSON.stringify(videoData, null, 4);
	await fsp.writeFile(jsonFilePath, outputJSON, 'utf-8');


	console.log('\n');
	console.log(`-- ID: ${videoData.post.id} | JSON saved to: ${jsonFilePath}`);
	console.log(`-- Download url: ${downloadUrl}`);

	// Resolve output path logic (previously in resolveOutputPath function)
	const downloadUrlFixed = safeParseUrl(downloadUrl);


	const originalVideoName = downloadUrlFixed ? path.basename(downloadUrlFixed.pathname) : null;
	const extension = originalVideoName && path.extname(originalVideoName) ? path.extname(originalVideoName) : '.mp4';

	const videoFileName = `${dateStamp}_${id}_${authorId}${extension}`;


	// Determine output file path
	let outputFilePath;
	const resolvedOutput = outputPath ? path.resolve(process.cwd(), outputPath) : path.resolve(process.cwd(), 'downloads');

	try {
		const stats = await fsp.stat(resolvedOutput);
		// If it's an existing directory, use it with generated filename
		outputFilePath = stats.isDirectory() ? path.join(resolvedOutput, videoFileName) : resolvedOutput;
		await ensureDirectory(stats.isDirectory() ? resolvedOutput : path.dirname(resolvedOutput));
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		
		// Path doesn't exist - check if it looks like a file (has extension) or directory
		const isFilePath = path.extname(resolvedOutput);
		outputFilePath = isFilePath ? resolvedOutput : path.join(resolvedOutput, videoFileName);
		await ensureDirectory(isFilePath ? path.dirname(resolvedOutput) : resolvedOutput);
	}

	console.log(`-- Downloading: ${outputFilePath}`);

	// Check if file already exists
	try {
		await fsp.access(outputFilePath, fs.constants.F_OK);
		console.log(`===== File already exists, skipping download: ${videoData.post.id}`);
		return;
	} catch (error) {
		// File doesn't exist, proceed with download
	}

	const sanitizedHeaders = buildDownloadHeaders(headers, downloadUrl);
	const requestOptions = buildRequestOptions(downloadUrl, sanitizedHeaders, agent);

	const response = await performHttpRequest(requestOptions);
	const totalSize = Number(response.headers['content-length']) || null;

	if (totalSize) {
		console.log(`----- Size: ${formatBytes(totalSize)}`);

		let downloaded = 0;
		response.on('data', (chunk) => {
			downloaded += chunk.length;
			const percent = ((downloaded / totalSize) * 100).toFixed(1);
			// process.stdout.write(`    Progress: ${percent}% (${formatBytes(downloaded)}/${formatBytes(totalSize)})\r`);
		});
		response.on('end', () => {
			process.stdout.write('\n');
		});
	}

	const writeStream = fs.createWriteStream(outputFilePath);
	await pipeline(response, writeStream);
	console.log(`===== Download completed: ${outputFilePath}`);
}







async function main() {
	const argv = parseArguments( process.argv );
	const agent = argv['skip-cert-check'] ? new https.Agent({ rejectUnauthorized: false }) : undefined;

	const headers = buildHeaders(argv, process.env);

	if (!headers.authorization) {
		console.warn('No authorization token provided. Requests may fail with 401/403 responses.');
	}

	const downloadUrl = argv.url;

	await downloadSoraSingleVideo({
		downloadUrl,
		outputPath: argv.output,
		id: 'unknown_id',
		authorId,
		headers,
		agent,
		videoData: { }
	});
}



if (require.main === module) {
	main().catch((error) => {
		console.error(`failed single video ${error.message}`);
		process.exit(1);
	});
}

module.exports = { downloadSoraSingleVideo };
