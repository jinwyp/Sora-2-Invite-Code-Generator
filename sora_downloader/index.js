#!/usr/bin/env node

'use strict';

const path = require('path');

const { formatDateStamp, parseArguments, buildHeaders } = require('./utils');
const { downloadSoraVideoAndRemixVideo } = require('./sora_get_single_video_page_list');
const { downloadSoraSingleVideo } = require('./sora_download_single_video');


// Load environment variables from a .env file if present
try {
	require('dotenv').config();
} catch (error) {
	// dotenv is optional; ignore if not installed
}


async function main() {
	const argv = parseArguments(process.argv);
    

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

		let videoCounter = 11
		const dateStamp = formatDateStamp();

        const firstVideo = data.firstVideo.post.attachments[0];
        const firstVideoDownloadPath = `downloads/${dateStamp}_${data.firstVideo.post.id}_${data.firstVideo.profile.username}`;

        await downloadSoraSingleVideo({
            downloadUrl: firstVideo.downloadable_url,
            outputPath: firstVideoDownloadPath,
            id: data.firstVideo.post.id,
            authorId: data.firstVideo.profile.username,
            headers,
			videoData:saveFileJson,
			videoCounter
        });

		const tempRemixVideoList = data.remixVideoList;
		const tempRemixVideoListLength = Array.isArray(tempRemixVideoList) ? tempRemixVideoList.length : 0;

        if (Array.isArray(tempRemixVideoList) && tempRemixVideoListLength > 0) {

			for (let i = 0; i < tempRemixVideoListLength; i++) {
				videoCounter = videoCounter + 1;
				const item = tempRemixVideoList[i];

				const remixVideoUrl = item.post.attachments[0];
                await downloadSoraSingleVideo({
                    downloadUrl: remixVideoUrl.downloadable_url,
                    outputPath: firstVideoDownloadPath,
                    id: item.post.id,
                    authorId: item.profile.username,
                    headers,
					videoData: item,
					videoCounter
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


