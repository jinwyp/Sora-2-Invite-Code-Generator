#!/usr/bin/env node

'use strict';

const path = require('path');

const { parseArguments, buildHeaders } = require('./utils');
const { downloadSoraVideoAndRemixVideo } = require('./sora_get_single_video_page_list');
const { downloadSoraSingleVideo } = require('./sora_get_single_video');
const { profile } = require('console');

// Load environment variables from a .env file if present
try {
	require('dotenv').config();
} catch (error) {
	// dotenv is optional; ignore if not installed
}


async function main() {
	const argv = parseArguments(process.argv);
    const agent = argv['skip-cert-check'] ? new https.Agent({ rejectUnauthorized: false }) : undefined;
    

	const url = argv.url;
	const outputFile = argv.output;

	// Set auth headers if available
	const headers = buildHeaders(argv, process.env);

	try {
		const data = await downloadSoraVideoAndRemixVideo(url, headers, argv);
		const saveFileJson = {
			videoInfo: data.videoInfo,
			post: data.firstVideo.post,
			profile: data.firstVideo.profile,
		}

		const outputJSONTemp = JSON.stringify(saveFileJson, null, 4);
		// console.log('\n');
		// console.log(`${outputJSONTemp}`);

        const firstVideo = data.firstVideo.post.attachments[0];
        const firstVideoDownloadPath = "downloads/" + data.firstVideo.post.id + "_" + data.firstVideo.profile.username;

        await downloadSoraSingleVideo({
            downloadUrl: firstVideo.downloadable_url,
            outputPath: firstVideoDownloadPath,
            id: data.firstVideo.post.id,
            authorId: data.firstVideo.profile.username,
            promptValue: firstVideo.prompt,
            headers,
            agent,
			videoData:saveFileJson
        });

		const tempRemixVideoList = data.remixVideoList;
		const tempRemixVideoListLength = Array.isArray(tempRemixVideoList) ? tempRemixVideoList.length : 0;

        if (Array.isArray(tempRemixVideoList) && tempRemixVideoListLength > 0) {

			
			for (let i = 0; i < tempRemixVideoListLength; i++) {
				const item = tempRemixVideoList[i];
				console.log('\n');
				console.log(`--- remix video: ${item.post.id}`);

				const remixVideoUrl = item.post.attachments[0];

                await downloadSoraSingleVideo({
                    downloadUrl: remixVideoUrl.downloadable_url,
                    outputPath: firstVideoDownloadPath,
                    id: item.post.id,
                    authorId: item.profile.username,
                    promptValue: remixVideoUrl.prompt,
                    headers,
                    agent,
					videoData: item
                });
			}
            
        }

	} catch (error) {
		console.error(`Failed to scrape page all: ${error.message}`);
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(`Failed to scrape page all: ${error.message}`);
		process.exit(1);
	});
}


