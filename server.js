// server.js 파일

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url'); // 💡 URL 파싱을 위해 필요

const PORT = process.env.PORT || 8080;

// 💡 1. problems.json 파일에서 문제 데이터를 읽어옵니다. 
const problemsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'problems.json'), 'utf8'));
// 💡 2. 출제된 문제를 기록할 변수
const solvedProblems = {}; 

// 1. HTTP 서버 설정 (파일 제공 및 API 처리 역할)
const server = http.createServer((req, res) => {
    
    // 요청 URL에서 쿼리 문자열을 제거한 순수 경로(pathname)를 추출합니다.
    const parsedUrl = url.parse(req.url); 
    let pathname = parsedUrl.pathname;

    // 💡 퀴즈 요청 처리 API 경로 (/api/quiz/주제/난이도) (생략 가능)
    if (pathname.startsWith('/api/quiz/')) {
        // ... (API 로직 유지)
        const parts = pathname.split('/'); 
        const subject = parts[3]; 
        const difficulty = parts[4];
        
        if (problemsData[subject] && problemsData[subject][difficulty]) {
            const problemList = problemsData[subject][difficulty];
            const key = `${subject}-${difficulty}`;
            const publishedIds = solvedProblems[key] || [];
            let availableProblems = problemList.filter(p => !publishedIds.includes(p.id));

            let nextProblem;
            if (availableProblems.length === 0 && problemList.length > 0) {
                solvedProblems[key] = [];
                availableProblems = problemList;
            } 
            
            if (availableProblems.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableProblems.length);
                nextProblem = availableProblems[randomIndex];
                if (!solvedProblems[key]) solvedProblems[key] = [];
                solvedProblems[key].push(nextProblem.id);
            } else {
                 res.writeHead(404, { 'Content-Type': 'application/json' });
                 res.end(JSON.stringify({ error: '해당 난이도에는 문제가 등록되지 않았습니다.' }));
                 return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(nextProblem));
            return;
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '잘못된 주제 또는 난이도입니다.' }));
            return;
        }
    }
    
    // 3. 정적 파일 제공 로직 (HTML, CSS, JS, 이미지 파일 포함)
    let filePath = '.' + pathname; // 💡 쿼리 문자열이 제거된 pathname 사용 (예: ./images/characters/soldier.png)
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
                res.end('File not found: ' + filePath); // 이 메시지가 표시된다면 파일 구조를 확인해야 함
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
const clients = new Set(); // 연결된 클라이언트 목록

wss.on('connection', (ws) => {
    clients.add(ws); // 클라이언트 추가

    ws.on('message', (message) => {
        const data = message.toString();
        // 발신자를 제외한 모든 클라이언트에게 메시지 전송 (브로드캐스트)
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws); // 클라이언트 제거
    });
});
