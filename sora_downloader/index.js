#!/usr/bin/env node

'use strict';

const path = require('path');

const { parseArguments, buildHeaders } = require('./utils');
const { downloadSoraVideoAndRemixVideo } = require('./sora_get_single_video_page_list');
const { downloadSoraSingleVideo } = require('./sora_get_single_video');

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

		const outputJSONTemp = JSON.stringify(data, null, 4);

		console.log('\n');	
		console.log(`${outputJSONTemp}`);

        const firstVideo = data.postOriginal.attachments[0];
        const firstVideoDownloadPath = "downloads/" + data.postOriginal.id + "_" + data.profileOriginal.username;
        const firstVideoPrompt = firstVideo.prompt

        await downloadSoraSingleVideo({
            downloadUrl: firstVideo.downloadable_url,
            outputPath: firstVideoDownloadPath,
            id: data.postOriginal.id,
            authorId: data.profileOriginal.username,
            promptValue: firstVideoPrompt,
            headers,
            agent,
			videoData:data.nextDataJsonData
        });


        if (Array.isArray(data.postOriginal.remix_posts.items) && data.postOriginal.remix_posts.items.length > 0) {
            data.postOriginal.remix_posts.items.forEach(async item => {

				console.log('\n');
                console.log(`----- remix: ${item.post.id}`);

                const remixPostVideo = item.post.attachments[0];
                const remixVideoPrompt = remixPostVideo.prompt;

                await downloadSoraSingleVideo({
                    downloadUrl: remixPostVideo.downloadable_url,
                    outputPath: firstVideoDownloadPath,
                    id: item.post.id,
                    authorId: item.profile.username,
                    promptValue: remixVideoPrompt,
                    headers,
                    agent,
					videoData: item
                });
            });
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


