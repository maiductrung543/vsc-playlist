const fs = require('fs');

async function fetchHighlightsFromAPI() {
    console.log('Đang gọi ScoreBat API để lấy danh sách Highlight...');
    
    // Đường dẫn Free API công khai của ScoreBat
    const apiUrl = 'https://www.scorebat.com/video-api/v3/free-feed/';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Lỗi kết nối API: ${response.statusText}`);
        }

        const data = await response.json();
        const matches = data.response || [];

        console.log(`Bắt thành công ${matches.length} trận đấu highlight từ API.`);

        let m3uContent = '#EXTM3U\n';

        matches.forEach((item) => {
            const title = item.title || 'Highlight Match';
            const competition = item.competition || 'Bóng đá Quốc tế';
            const thumbnail = item.thumbnail || '';
            
            // Trích xuất link video / iframe nhúng từ API
            let videoUrl = '';
            if (item.videos && item.videos.length > 0) {
                const embedHtml = item.videos[0].embed || '';
                const matchSrc = embedHtml.match(/src='([^']+)'/) || embedHtml.match(/src="([^"]+)"/);
                if (matchSrc && matchSrc[1]) {
                    videoUrl = matchSrc[1];
                }
            }

            if (!videoUrl) {
                videoUrl = item.matchviewUrl || 'https://www.scorebat.com';
            }

            // Ghi dữ liệu dạng Playlist M3U chuẩn
            m3uContent += `#EXTINF:-1 tvg-logo="${thumbnail}" group-title="${competition}",${title}\n`;
            m3uContent += `${videoUrl}\n`;
        });

        fs.writeFileSync('playlist.m3u', m3uContent, 'utf-8');
        console.log('Đã tạo thành công file playlist.m3u từ ScoreBat API!');

    } catch (error) {
        console.error('Lỗi trong quá trình lấy dữ liệu:', error);
        
        // Tạo file fallback nếu có lỗi mạng
        const fallbackContent = '#EXTM3U\n#EXTINF:-1,ScoreBat Feed Error\nhttps://www.scorebat.com\n';
        fs.writeFileSync('playlist.m3u', fallbackContent, 'utf-8');
    }
}

fetchHighlightsFromAPI();
