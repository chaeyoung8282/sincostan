// server (1).js 파일

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// 💡 1. problems.json 파일에서 문제 데이터를 읽어옵니다.
const problemsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'problems.json'), 'utf8'));
// 💡 2. 출제된 문제를 기록할 변수 (서버 재시작 시 초기화됩니다.)
const solvedProblems = {}; 

// 1. HTTP 서버 설정 (파일 제공 및 API 처리 역할)
const server = http.createServer((req, res) => {
    
    // 💡 퀴즈 요청 처리 API 경로 (/api/quiz/주제/난이도)
    if (req.url.startsWith('/api/quiz/')) {
        const parts = req.url.split('/'); 
        const subject = parts[3]; 
        const difficulty = parts[4];
        
        // 문제 데이터가 존재하는지 확인
        if (problemsData[subject] && problemsData[subject][difficulty]) {
            const problemList = problemsData[subject][difficulty];
            const key = `${subject}-${difficulty}`;
            
            // 이미 출제된 문제 목록을 가져옵니다.
            const publishedIds = solvedProblems[key] || [];

            // 출제되지 않은 문제만 필터링합니다.
            let availableProblems = problemList.filter(p => !publishedIds.includes(p.id));

            let nextProblem;

            if (availableProblems.length === 0 && problemList.length > 0) {
                // 모든 문제를 다 풀었으면 (5문제), 목록을 초기화하고 처음부터 다시 랜덤 출제
                solvedProblems[key] = [];
                availableProblems = problemList; // 전체 목록으로 재설정
                
                // 사용자에게 모든 문제가 재출제됨을 알리는 메시지를 보낼 수도 있지만, 여기서는 자동으로 재출제합니다.
            } 
            
            if (availableProblems.length > 0) {
                // 출제되지 않은 문제 중에서 랜덤 선택
                const randomIndex = Math.floor(Math.random() * availableProblems.length);
                nextProblem = availableProblems[randomIndex];
                
                // 선택된 문제를 출제 목록에 추가
                if (!solvedProblems[key]) solvedProblems[key] = [];
                solvedProblems[key].push(nextProblem.id);
            } else {
                // (5문제가 모두 없고) 문제 목록 자체가 비어 있을 때
                 res.writeHead(404, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ error: '해당 난이도에는 문제가 등록되지 않았습니다.' }));
                 return;
            }
            
            // 클라이언트에게 문제 정보 (ID와 URL) 전송
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(nextProblem));
            return; // API 요청 처리 완료
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '잘못된 주제 또는 난이도입니다.' }));
            return;
        }
    }
    
    // 3. 기존의 파일 제공 로직 (HTML, CSS, JS, 이미지 파일)
    // 🚨 핵심 수정: 쿼리 스트링(?...)을 제거하여 실제 파일 경로만 사용합니다.
    let urlWithoutQuery = req.url.split('?')[0]; 
    let filePath = '.' + urlWithoutQuery;
    
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png', 
        '.jpg': 'image/jpeg',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found: ' + filePath);
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8'); 
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ HTTP 서버가 포트 ${PORT} 에서 실행 중입니다.`);
});


// 2. WebSocket 서버 설정 (실시간 데이터 중계 역할)
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('message', (message) => {
        const data = message.toString();
        // 자신을 제외한 모든 클라이언트에게 데이터 중계
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws);
    });
});
