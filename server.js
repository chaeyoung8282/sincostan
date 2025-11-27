// server.js 파일

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

            if (availableProblems.length > 0) {
                // 남은 문제가 있으면 첫 번째 문제를 출제
                nextProblem = availableProblems[0];
            } else if (problemList.length > 0) {
                // 남은 문제가 없으면 출제 목록 초기화 후 첫 번째 문제를 다시 출제
                console.log(`[QUIZ] ${key} 문제가 모두 소진되어 목록을 초기화합니다.`);
                solvedProblems[key] = [];
                nextProblem = problemList[0];
            } else {
                // 문제 목록 자체가 비어있음
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '해당 난이도에 등록된 문제가 없습니다.' }));
                return;
            }
            
            // 출제된 문제 ID를 기록
            if (!solvedProblems[key] || solvedProblems[key].length === 0) {
                solvedProblems[key] = [nextProblem.id];
            } else if (!solvedProblems[key].includes(nextProblem.id)) {
                solvedProblems[key].push(nextProblem.id);
            }

            // 출제 후 남은 문제 목록 (다음 문제부터)
            const remainingProblems = problemList.filter(p => !solvedProblems[key].includes(p.id));

            // 🚨 [수정] 클라이언트가 필요한 모든 정보(nextProblem, subjectName, remainingProblems)를 하나의 객체로 응답합니다.
            const responseData = {
                subjectName: subject, // 클라이언트에서 필요
                nextProblem: nextProblem,
                remainingProblems: remainingProblems,
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));

        } else {
            // 주제 또는 난이도 데이터가 없을 경우
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '유효하지 않은 주제 또는 난이도입니다.' }));
        }

        return; // 퀴즈 요청 처리가 끝났으므로 HTTP 요청 종료
    }
    
    // 💡 정적 파일 요청 처리 (HTML, CSS, JS, 이미지 파일)
    let filePath = '.' + req.url;
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
        // 모든 연결된 클라이언트에게 메시지를 브로드캐스트합니다.
        // (다만, 퀴즈 시작 메시지는 보낸 클라이언트에게는 다시 보내지 않도록 처리하는 것이 일반적이지만,
        // 여기서는 클라이언트 측에서 자체적으로 처리하므로 그대로 브로드캐스트합니다.)
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('클라이언트 연결 종료');
    });
});
