const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const { formatDateStamp, extractIdFromUrl, parseArguments, buildHeaders } = require('./utils');
const { downloadSoraSingleVideo } = require('./sora_download_single_video');



/**
 * 标准化 URL - 如果输入的是 ID，则添加完整的 URL 前缀
 * @param {string} urlOrId - 完整的 URL 或者只是 ID (如: s_68e75d088d0881918a92461a0f7aacf5)
 * @returns {string} 完整的 URL
 */
function normalizeUrl(urlOrId, cursor = '') {
    const exampleUrl1 = 'https://sora.chatgpt.com/backend/project_y/post/s_68e75d088d0881918a92461a0f7aacf5';
    const exampleUrl2 = 'https://sora.chatgpt.com/backend/project_y/post/s_68de40ff59f881918d06b9be6b70ed89/remix_feed?cursor=cnM2OjIxMWNkY2Y2LWQ3MDctNGUwMi04NWViLTZlYTgzYTA0ODhhZjpISVJjMVJyOjB-Wkg2OWRYQzRnTHQ2UjB6cE1Ed3NWWnJoekFVX3IxMEEybUROa1ZuOTdVeEtKOUV4N0xRMXZGOGR3WkZ5dFhXcHJtVGhEaU91dVE1U1laZG9aWWY3ZFllZDlNNnYxQnFvSEs3bE5tM185bzB6YjU0U1hidjdDTHdLZzBveENmZF9HV3g4YllKOU4zTT1-c2Vjb25kYXJ5';

    const baseUrl = 'https://sora.chatgpt.com/backend/project_y/post/';

    
    // 如果已经是完整的 URL (以 http:// 或 https:// 开头)，直接返回
    if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
        return urlOrId;
    }
    
    // 如果只是 ID (以 s_ 开头)，添加前缀
    if (urlOrId.startsWith('s_')) {
        if (cursor){
            return baseUrl + urlOrId + '/remix_feed?cursor=' + encodeURIComponent(cursor);
        }

        return baseUrl + urlOrId;
    }
    
    return urlOrId;
}



async function getSingleVideoInfo(videoId, headers, cursor) {
    url = normalizeUrl(videoId, cursor || '');

    try {
        console.log('正在请求页面:', url);
        const response = await axios.get(url, {
            headers: headers,
            timeout: 30000,
        });
        // console.log('请求状态码:', response.status);
        // console.log('响应头 Content-Type:', response.headers['content-type']);
        
        if (response.status !== 200) {
            console.warn(`警告: 收到非 200 状态码: ${response.status}`);
        }

        return response.data;

    } catch (error) {
        console.error('请求失败 axios error:', error.message);
        throw error;
    }
}



/**
 * 主函数
 */
async function main() {
    const targetUrl = 'https://sora.chatgpt.com/p/s_68e5d5037b4c8191b33992ce7f8feaee';


     // 1. 读取 cookies
    const argv = parseArguments(process.argv);
    const headers = buildHeaders(argv, process.env);

    const videoId = extractIdFromUrl(argv.url);
    console.log('提取到的视频 ID:', videoId);

    if (!videoId) {
        console.error('❌ 无效的 URL 或 ID，无法提取视频 ID。请检查输入。');
        process.exit(1);
    } 


    try {
        const firstVideoInfo = await getSingleVideoInfo(videoId, headers);
        let remixVideoList = [];
        let pageNoNextCursor = null;
        let remixCount = 0;
        
        // const tempOutputJson = JSON.stringify(firstVideoInfo, null, 4);
        // console.log(tempOutputJson);

        if (firstVideoInfo && firstVideoInfo.post ) {
            if ( !firstVideoInfo.hasOwnProperty('children')){
                remixCount = firstVideoInfo.post.remix_count;
                pageNoNextCursor = firstVideoInfo.post.remix_posts.cursor;
                remixVideoList.push(...firstVideoInfo.post.remix_posts.items);
            }
        }

        console.log(`\n--- 检测到 remix_count: ${remixCount} 个 remix 视频`);

        if (pageNoNextCursor){
            for (let i=0; i< 20 ; i++){
                console.log(`\n--- 开始请求第 ${i+1} 页 remix 视频`);
                const responseData = await getSingleVideoInfo(videoId, headers, pageNoNextCursor);
                
                if (responseData && responseData.items) {
                    remixVideoList.push(...responseData.items);

                    if (!responseData.cursor){
                        console.log('--- 没有更多的 remix 视频了，结束分页请求');
                        break;
                    }
                    pageNoNextCursor = responseData.cursor;
                }
            }
        }

        const dateStamp = formatDateStamp();
        let videoCounter = 11

        const downloadFirstVideo = firstVideoInfo.post.attachments[0];
        const downloadFirstVideoPath = `downloads/${dateStamp}_${firstVideoInfo.post.id}_${firstVideoInfo.profile.username}`;

        await downloadSoraSingleVideo({
            downloadUrl: downloadFirstVideo.downloadable_url,
            outputPath: downloadFirstVideoPath,
            id: firstVideoInfo.post.id,
            authorId: firstVideoInfo.profile.username,
            headers,
			videoData:firstVideoInfo,
            videoCounter
        });


		const tempRemixVideoListLength = remixVideoList.length

        if (Array.isArray(remixVideoList) && tempRemixVideoListLength > 0) {

			for (let i = 0; i < tempRemixVideoListLength; i++) {
                videoCounter = videoCounter + 1;
				const item = remixVideoList[i];
				const remixVideoUrl = item.post.attachments[0];

                await downloadSoraSingleVideo({
                    downloadUrl: remixVideoUrl.downloadable_url,
                    outputPath: downloadFirstVideoPath,
                    id: item.post.id,
                    authorId: item.profile.username,
                    headers,
					videoData: item,
                    videoCounter
                });
			}
            
        }


    } catch (error) {
        console.error('\n❌ 爬取失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    getSingleVideoInfo,
    normalizeUrl,
    extractIdFromUrl
};
