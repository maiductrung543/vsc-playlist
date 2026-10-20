const fs = require('fs');

async function generatePlaylist() {
    let m3uContent = '#EXTM3U\n';
    
    try {
        console.log('Đang kết nối tới ScoreBat API...');
        const response = await fetch('https://www.scorebat.com/video-api/v1/');
        
        if (response.ok) {
            const matches = await response.json();
            console.log(`Lấy thành công ${matches.length} trận đấu.`);

            if (Array.isArray(matches) && matches.length > 0) {
                matches.forEach((item, index) => {
                    const title = item.title || `Match ${index + 1}`;
                    const thumb = item.thumbnail || '';
                    const competition = item.competition ? (item.competition.name || item.competition) : 'Football';
                    
                    let streamUrl = '';
                    if (item.embed) {
                        const match = item.embed.match(/src="([^"]+)"/) || item.embed.match(/src='([^']+)'/);
                        if (match && match[1]) {
                            streamUrl = match[1];
                            if (streamUrl.startsWith('//')) {
                                streamUrl = 'https:' + streamUrl;
                            }
                        }
                    }
                    if (!streamUrl && item.url) {
                        streamUrl = item.url;
                    }
                    if (!streamUrl) {
                        streamUrl = 'https://www.scorebat.com';
                    }

                    m3uContent += `#EXTINF:-1 tvg-logo="${thumb}" group-title="${competition}",${title}\n`;
                    m3uContent += `${streamUrl}\n`;
                });
            }
        } else {
            throw new Error('API không phản hồi đúng trạng thái');
        }
    } catch (error) {
        console.log('Sử dụng dữ liệu dự phòng do lỗi:', error.message);
        m3uContent += '#EXTINF:-1,ScoreBat Official Website\nhttps://www.scorebat.com\n';
    }

    // Luôn ghi file thành công dù có sự cố mạng
    fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
    console.log('Đã cập nhật file playlist.m3u thành công!');
    process.exit(0);
}

generatePlaylist();
