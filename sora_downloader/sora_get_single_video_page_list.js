#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const puppeteer = require('puppeteer');

const { downloadSoraSingleVideo } = require('./sora_get_single_video');
const { parseArguments, buildHeaders, getCookieArray } = require('./utils');


// Load environment variables from a .env file if present
try {
	require('dotenv').config();
} catch (error) {
	// dotenv is optional; ignore if not installed
}


/**
 * Scrape comprehensive information from a Sora post page
 * @param {string} pageUrl - The Sora post URL to scrape
 * @param {Object} options - Configuration options
 * @returns {Object} Scraped page data
 */
async function downloadSoraVideoAndRemixVideo(pageUrl, headers, options = {}) {
    
	const browser = await puppeteer.launch({
		executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
		headless: options.headless,
		args: [
			'--disable-blink-features=AutomationControlled',
			'--lang=en-US,en',
			'--window-size=1440,1000'
		]
	});

	const cookies = getCookieArray(headers['cookie']);

	const page = await browser.newPage();
	// await page.setExtraHTTPHeaders(headers);

	for (const cookie of cookies) {
		await page.setCookie(cookie);
	}

	await page.setViewport({ width: 1440, height: 1000 });

	page.on('console', (msg) => {
		console.log(`[--- Browser log type: ${msg.type()}]: ${msg.text()}`);
	});

	// 设置一个 Promise 来“捕获”我们想要的数据

	let ajaxInfoData = {
		id : '',
		remix_count : 0,
		remixLoopNumber : 0,
		nextCursor : '',
		firstVideo: null,
		remixVideoList: [],
		pageNoCursor: []

	};
	const responsePromise = new Promise(resolve => {
		page.on('response', async (response) => {
			if (response.url().includes('sora.chatgpt.com/backend/project_y/post')) {

				console.log(`----- AJAX response: ${response.url()}`);
				
				try {
					const responseData = await response.json();
					// console.log(`----- ${JSON.stringify(responseData, null, 4)}`);

					if (responseData && responseData.post ) {
						if ( !responseData.hasOwnProperty('children')){
							ajaxInfoData.firstVideo = responseData;
							ajaxInfoData.id = responseData.post.id;
							ajaxInfoData.nextCursor = responseData.post.remix_posts.cursor;
							ajaxInfoData.remix_count = responseData.post.remix_count;

							const tempRemixCount = responseData.post.remix_posts.items[0]?.post?.remix_count || 0;
							if (responseData.post.remix_count > 2){
								ajaxInfoData.remixLoopNumber = Math.ceil(responseData.post.remix_count / 10);
							}else if (tempRemixCount > 2){
								ajaxInfoData.remixLoopNumber = Math.ceil(tempRemixCount / 10);
								ajaxInfoData.remix_count = tempRemixCount;
							}
						}
					}

					if (responseData && responseData.items) {
						ajaxInfoData.remixVideoList.push(...responseData.items);
						ajaxInfoData.pageNoCursor.push(responseData.cursor);
						ajaxInfoData.nextCursor = responseData.cursor;
					}

					resolve(responseData); 
				} catch (error) {
					console.error('Parse json error:', error);
					resolve(null); 
				}
			}
		});
	});



	try {
		console.log(`===== Starting page: ${pageUrl}`);
		await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 600000 });

		await page.waitForSelector('video', { timeout: 200000 });
		await page.waitForSelector('.truncate', { timeout: 200000 });

		// Wait for remix buttons to load and click the third one using locator API

		const containerSelector = 'div.flex.flex-col.gap-2.p-5';
		await page.waitForSelector(containerSelector, { timeout: 40000 });
		let boxDivCount = await page.$eval(containerSelector, (node) => node.childElementCount);
		// console.log(`----- Detected Total ${boxDivCount} box div`);

		if (boxDivCount > 3){
			
			const remixButtonsSelector = 'div.flex.w-fit.items-center.justify-end.gap-2 button';
			await page.waitForSelector(remixButtonsSelector, { timeout: 40000 });
			let remixButtonCount = await page.$$eval(remixButtonsSelector, (nodes) => nodes.length);
			const initialRemixButtonCount = remixButtonCount;

			// console.log(`----- starting remixLoopNumber ${ajaxInfoData.remixLoopNumber} `);
			if (ajaxInfoData.remixLoopNumber > 0){
				for (let i=0; i< ajaxInfoData.remixLoopNumber; i++){
					const lastButtonIndex = 10*i + 3;
					const nextButtonIndex = 10*i + 4;

					if (remixButtonCount === lastButtonIndex ){
						const lastRemixButtonSelector = `${remixButtonsSelector}:last-of-type`;
						await page.locator(lastRemixButtonSelector)
							.setEnsureElementIsInTheViewport(true)
							.setWaitForEnabled(true)
							.setTimeout(5000)
							.click();

						const needCheckedButtonSelector = `${remixButtonsSelector}:nth-of-type(${nextButtonIndex})`;
						await page.waitForSelector(needCheckedButtonSelector, { timeout: 40000 });
						remixButtonCount = await page.$$eval(remixButtonsSelector, (nodes) => nodes.length);
						// console.log(`----- Detected ${remixButtonCount} remix button after click`);
					} else {
						break;
					}
				}
			}

			const remixButtonCountFinal = await page.$$eval(remixButtonsSelector, (nodes) => nodes.length);
			// console.log(`----- Detected Total ${remixButtonCountFinal} remix button`);
		}

		// Extract all page data
		const pageData = await page.evaluate(() => {
			const data = {
				videoInfo: {
					metadata: {},
					pageTitle: '',
					likesCount: 0,
					remixCount: 0,
					prompt: '',
					authorProfileUrl: '',
					authorUsername: '',
					video: {},
				},

				relatedPosts: [],
                nextDataJsonData: {},
                postOriginal: {},
                initialComments: {},
				profileOriginal: {}
			};

            // Extract page title
			data.videoInfo.pageTitle = document.title;

			// Extract metadata
			const metaTags = {};
			document.querySelectorAll('meta').forEach(meta => {
				const name = meta.getAttribute('name') || meta.getAttribute('property');
				const content = meta.getAttribute('content');
				if (name && content) {
					metaTags[name] = content;
				}
			});
			data.videoInfo.metadata = metaTags;

            // Extract prompt from meta or page
			const promptMeta = document.querySelector('meta[name="twitter:description"]');
			if (promptMeta) {
				data.videoInfo.prompt = promptMeta.getAttribute('content');
			}


			// Extract author info
			const authorLink = document.querySelector('.font-semibold');
			if (authorLink) {
				data.videoInfo.authorProfileUrl = authorLink.getAttribute('href');
			}
            const authorName = document.querySelector('.truncate');
            if (authorName) {
                data.videoInfo.authorUsername = authorName.textContent?.trim();
            }

			// Extract like count
			const likeButton = document.querySelector('button svg path[d*="M9 3.991"]')?.closest('button');
			if (likeButton) {
				const likeCountSpan = likeButton.querySelector('span.truncate');
				if (likeCountSpan) {
					data.videoInfo.likesCount = parseInt(likeCountSpan.textContent?.trim()) || 0;
				}
			}

			// Extract remix count
			const remixButton = document.querySelector('button svg circle[cx="9"][cy="9"][r="6.75"]')?.closest('button');
			if (remixButton) {
				const remixCountSpan = remixButton.querySelector('span.truncate');
				if (remixCountSpan) {
					data.videoInfo.remixCount = parseInt(remixCountSpan.textContent?.trim()) || 0;
				}
			}


			// Extract video information
			const video = document.querySelector('main video') || document.querySelector('video');
			if (video) {
				data.videoInfo.video.currentSrc = video.currentSrc;
				data.videoInfo.video.src = video.getAttribute('src');
				data.videoInfo.video.poster = video.getAttribute('poster');

				const sources = [];
				video.querySelectorAll('source').forEach(source => {
					sources.push({
						src: source.getAttribute('src'),
						type: source.getAttribute('type')
					});
				});
				data.videoInfo.video.sources = sources;
			}

/* 
			// Extract series/related post IDs from inline scripts
			const seriesIds = new Set();
			document.querySelectorAll('script').forEach(script => {
				const text = script.textContent || '';
				const normalized = text.replace(/\\\//g, '/');
				const pattern = /(https?:\/\/)?sora\.chatgpt\.com\/p\/(s_[a-z0-9]{32})/gi;
				let match;
				while ((match = pattern.exec(normalized)) !== null) {
					seriesIds.add(match[2]);
				}
			});
			data.relatedPosts = Array.from(seriesIds).map(id => ({
				id,
				url: `https://sora.chatgpt.com/p/${id}`
			}));



			// Extract JSON data from Next.js script tags
			document.querySelectorAll('script').forEach((script) => {
				const scriptText = script.textContent || '';
				
				// Look for the script containing "5:[" which has the main post data
				if (scriptText.includes('"5:[') || scriptText.includes('5:[')) {
					try {
						// Extract the JSON string between the quotes
						// Match: self.__next_f.push([1,"5:..."]) or self.__next_f.push([1, "5:..."])
						const match = scriptText.match(/self\.__next_f\.push\(\[1,\s*"(5:.*)"\]\)/s);
						
						if (match && match[1]) {
							let rawString = match[1];
							
							// Remove the "5:" prefix
							if (rawString.startsWith('5:')) {
								rawString = rawString.substring(2);
							}
							
							// Remove trailing \n if exists
							if (rawString.endsWith('\\n')) {
								rawString = rawString.slice(0, -2);
							}
							
							try {
								// The rawString contains JavaScript escape sequences like \"
								// We need to unescape them to get valid JSON
								let jsonString = rawString
									.replace(/\\\\/g, '\\')    // \\\\ -> \\
									.replace(/\\\"/g, '"')      // \" -> "
									.replace(/\\\'/g, "'")      // \' -> '

									// .replace(/\\n/g, '\n')     // \\n -> actual newline
									// .replace(/\\r/g, '\r')     // \\r -> carriage return
									// .replace(/\\t/g, '\t');    // \\t -> tab
								
								// Parse the JSON
								const parsedData = JSON.parse(jsonString);
								
								
								// The structure is: ["$", "$b", null, {children: [...]}]
								if (parsedData && Array.isArray(parsedData) && parsedData.length > 3) {
									
									if (parsedData[3] && parsedData[3].children) {
										// children is an array: ["$", "$L13", null, {post: {...}, initialComments: {...}, ...}]

										if (Array.isArray(parsedData[3].children) && parsedData[3].children.length > 3) {
											const postData = parsedData[3].children[3];
											
											if (postData) {
												data.nextDataJsonData = postData.post || null;
												data.postOriginal = postData.post.post || null;
												data.initialComments = postData.initialComments || null;
												data.profileOriginal = postData.post.profile || null;
											}
										}
									}
								}
							} catch (parseErr) {
								// Silently ignore parse errors
								console.error('Failed to parse Next.js data:', parseErr.message);
							}
						}
					} catch (err) {
						// Silently ignore extraction errors
						console.error('Failed to extract Next.js data:', err.message);
					}
				}
			});
			 */
			return data;
		});
		console.log('\n')
		console.log('========== Page scraped successfully');
/* 
		if (pageData.postOriginal.attachments[0] && pageData.postOriginal.attachments[0].prompt) {
			const promptText = pageData.postOriginal.attachments[0].prompt;
			console.log(`----- Extracted prompt: ${promptText}`);
			if (promptText.includes('17')) {
				pageData.postOriginal.attachments[0].prompt = pageData.metadata['twitter:description'];
				pageData.nextDataJsonData.post.attachments[0].prompt = pageData.metadata['twitter:description'];
			}
		}
 */
		await responsePromise;
		ajaxInfoData.videoInfo = pageData.videoInfo;

		return ajaxInfoData;

	} catch (error) {
		console.error('Error scraping page:', error.message);
		throw error;
	} finally {
		await browser.close();
	}
}

// CLI usage
async function main() {
	const argv = parseArguments(process.argv);
    const agent = argv['skip-cert-check'] ? new https.Agent({ rejectUnauthorized: false }) : undefined;
    

	const url = argv.url;
	const outputFile = argv.output;

	// Set auth headers if available
	const headers = buildHeaders(argv, process.env);

	try {
		const data = await downloadSoraVideoAndRemixVideo(url, headers, argv);

        const firstVideo = data.postOriginal.attachments[0];
        const firstVideoDownloadPath = "downloads/" + data.postOriginal.id;
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

    
	} catch (error) {
		console.error(`Failed to scrape page list: ${error.message}`);
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch((error) => {
		console.error(`Failed to scrape page list: ${error.message}`);
		process.exit(1);
	});
}

module.exports = { downloadSoraVideoAndRemixVideo };
