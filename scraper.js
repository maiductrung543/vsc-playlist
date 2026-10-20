const fs = require('fs');

async function generatePlaylist() {
    console.log('Đang lấy dữ liệu highlight từ ScoreBat API...');
    const url = 'https://www.scorebat.com/video-api/v1/';
    
    let m3uContent = '#EXTM3U\n';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const matches = await response.json();
        console.log(`Lấy thành công ${matches.length} trận đấu.`);

        if (Array.isArray(matches) && matches.length > 0) {
            matches.forEach((item, index) => {
                const title = item.title || `Match ${index + 1}`;
                const thumb = item.thumbnail || '';
                const competition = item.competition ? (item.competition.name || item.competition) : 'Football';
                
                // Trích xuất link video từ chuỗi embed HTML hoặc url
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
        } else {
            throw new Error('Danh sách trận đấu trống');
        }

    } catch (error) {
        console.error('Lỗi khi gọi API, sử dụng dữ liệu dự phòng:', error.message);
        m3uContent += '#EXTINF:-1,ScoreBat Official Website\nhttps://www.scorebat.com\n';
    }

    fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
    console.log('Đã cập nhật file playlist.m3u thành công!');
}

generatePlaylist();
