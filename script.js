// script.js 파일 전체 코드

// 캔버스 요소를 가져옵니다.
const canvasP1 = document.getElementById('canvas-p1');
const ctxP1 = canvasP1.getContext('2d');
const canvasP2 = document.getElementById('canvas-p2');
const ctxP2 = canvasP2.getContext('2d');

// 메인 화면과 퀴즈 화면 요소를 가져옵니다.
const mainScreen = document.getElementById('main-screen');
const quizScreen = document.getElementById('quiz-screen');
const currentSubjectDifficulty = document.getElementById('current-subject-difficulty');
const problemImage = document.getElementById('problem-image');
const backToMainBtn = document.getElementById('back-to-main');
const difficultySelection = document.getElementById('difficulty-selection');

// 캔버스 해상도 설정
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 400; 

canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

// 드로잉 상태를 저장할 객체
const drawingState = {
    p1: {
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        color: '#000000',
        mode: 'pen',
        ctx: ctxP1,
        canvas: canvasP1,
        id: 'p1' // Player ID 추가
    },
    p2: {
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        color: '#000000',
        mode: 'pen',
        ctx: ctxP2,
        canvas: canvasP2,
        id: 'p2' // Player ID 추가
    }
};

let currentSubject = '';
let currentDifficulty = '';
let ws; // WebSocket 객체 변수

/**
 * --- 문제 데이터 ---
 */
const problemData = {
  "polynomial": {
    "difficulty_map": {
      "easy": "하 (TRAINING)",
      "medium": "중 (CHALLENGE)",
      "hard": "상 (BOSS)"
    }
  },
  "equation": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "permutation": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "matrix": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "geometry": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "set": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "function": {
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  }
}; 

// 주제 키와 표시 이름을 매핑
const SUBJECT_NAMES = {
    'polynomial': '다항식',
    'equation': '방정식과 부등식',
    'permutation': '순열과 조합',
    'matrix': '행렬',
    'geometry': '도형의 방정식',
    'set': '집합과 명제',
    'function': '함수와 그래프'
};


// 캔버스 초기화 및 스타일 설정 함수
function setupCanvasContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = drawingState.p1.color; 

    // 배경을 흰색으로 초기화
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// 캔버스 초기화
setupCanvasContext(ctxP1);
setupCanvasContext(ctxP2);

/**
 * 💡 새로운 함수: WebSocket으로 데이터를 전송합니다.
 */
function sendWebSocketData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

/**
 * 💡 새로운 함수: 수신된 드로잉 데이터를 캔버스에 그립니다. (동기화 용)
 */
function executeDraw(data) {
    const state = drawingState[data.player];
    const ctx = state.ctx;

    // 지우개 모드 설정
    if (data.mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = data.lineWidth;
    } else {
        // 펜 모드 설정
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = data.lineWidth;
        ctx.strokeStyle = data.color;
    }
    
    // 그리기 실행
    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.stroke();
}


// 드로잉 함수
function draw(e, state) {
    if (!state.isDrawing) return;

    // 터치 이벤트 처리
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

    const rect = state.canvas.getBoundingClientRect();
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;

    const currentX = (clientX - rect.left) * scaleX;
    const currentY = (clientY - rect.top) * scaleY;

    // 🚨 [수정] 캔버스에 그리기 전에 데이터를 서버로 보냅니다.
    // 서버는 이 데이터를 다른 모든 클라이언트(교사 화면 포함)로 브로드캐스트합니다.
    sendWebSocketData({
        type: 'draw_data',
        player: state.id, // 'p1' 또는 'p2'
        x0: state.lastX,
        y0: state.lastY,
        x1: currentX,
        y1: currentY,
        color: state.color,
        mode: state.mode,
        lineWidth: state.mode === 'eraser' ? 20 : 5
    });

    // 로컬 캔버스에 그리기 (이전 로직과 동일)
    executeDraw({
        player: state.id, 
        x0: state.lastX,
        y0: state.lastY,
        x1: currentX,
        y1: currentY,
        color: state.color,
        mode: state.mode,
        lineWidth: state.mode === 'eraser' ? 20 : 5
    });

    [state.lastX, state.lastY] = [currentX, currentY];
}

// 이벤트 리스너 설정
function setupCanvasEvents(canvas, player) {
    const state = drawingState[player];
    const ctx = state.ctx;
    
    // 마우스 및 터치 이벤트 핸들러
    const startDrawing = (e) => {
        e.preventDefault();
        state.isDrawing = true;
        
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        [state.lastX, state.lastY] = [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
    };

    const stopDrawing = () => {
        // 🚨 [수정] 현재 플레이어가 드로잉 중이었다면 상태를 false로 변경
        if (state.isDrawing) {
            state.isDrawing = false;
        }
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', (e) => draw(e, state));

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    canvas.addEventListener('touchmove', (e) => draw(e, state));

    // 툴 버튼 리스너
    document.querySelectorAll(`.tool-btn[data-player="${player}"]`).forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll(`.tool-btn[data-player="${player}"]`).forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            state.mode = button.dataset.mode || 'pen';
            if (button.dataset.color) {
                state.color = button.dataset.color;
            }

            if (button.classList.contains('clear-btn')) {
                // 전체 지우기 (로컬 실행)
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                
                // 🚨 [추가] 전체 지우기 명령을 서버로 전송하여 동기화
                sendWebSocketData({ 
                    type: 'clear_canvas', 
                    player: player 
                });
            }
        });
    });
}

// P1, P2 캔버스에 이벤트 리스너 설정
setupCanvasEvents(canvasP1, 'p1');
setupCanvasEvents(canvasP2, 'p2');


// 메인 화면 UI 로직
function setupMainUiEvents() {
    document.querySelectorAll('.subject-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentSubject = button.dataset.subject;
            // 주제 버튼을 누르면 난이도 선택 화면 표시
            document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');

            difficultySelection.style.display = 'block';
        });
    });

    document.querySelectorAll('.difficulty-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentDifficulty = button.dataset.difficulty;
            
            // 난이도 버튼을 누르면 퀴즈 화면 표시
            showQuizScreen();
        });
    });

    // 🚨 [수정] 교사가 '메인으로 돌아가기' 버튼을 누르면 서버로 명령을 보냅니다.
    backToMainBtn.addEventListener('click', () => showMainScreen(false));
}

// ... (showQuizScreen 함수는 이전 코드와 동일)

async function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    const subjectName = SUBJECT_NAMES[currentSubject] || '주제';
    const difficultyName = problemData[currentSubject]?.difficulty_map[currentDifficulty] || '난이도';
    
    const loadingMessage = `${subjectName} / ${difficultyName} 문제를 서버에 요청 중...`;
    
    currentSubjectDifficulty.textContent = loadingMessage;
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent('서버에 문제 요청 중...')}`;
    
    try {
        const url = `/api/quiz/${currentSubject}/${currentDifficulty}`;
        console.log(`[문제 시스템] 서버 API 호출 시도: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        // API 요청 성공. WebSocket 동기화 대기 중...

    } catch (e) {
        const errorMessage = e.message || "알 수 없는 서버 오류";
        currentSubjectDifficulty.textContent = `오류: 문제를 로드하는 데 실패했습니다. (${errorMessage})`;
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!`;
        console.error("문제 로드 API 실패:", e);
        return;
    }
}

/**
 * 🚨 [수정] 메인 화면 복귀 함수: 교사 버튼 클릭 시(isSync=false) 서버에 명령을 전송하고, 
 * 서버 동기화 명령 수신 시(isSync=true) 화면만 전환합니다.
 */
function showMainScreen(isSync) {
    
    // 교사가 직접 버튼을 누른 경우 (학생들에게 명령 전송)
    if (!isSync) {
        sendWebSocketData({ type: 'go_to_main' });
        console.log('🚀 교사가 메인 화면 복귀 명령을 서버로 전송했습니다.');
    }
    
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    difficultySelection.style.display = 'none';

    // 선택 상태 및 캔버스 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
    // 캔버스 초기화
    setupCanvasContext(ctxP1);
    setupCanvasContext(ctxP2);
    
    // 이미지 에러 핸들러 초기화
    problemImage.onerror = null; 
}


// ... (syncQuizScreen 함수는 이전 코드와 동일)

function syncQuizScreen(problemData, subject, difficulty) {
    // 난이도, 주제 전역 변수 업데이트
    currentSubject = subject;
    currentDifficulty = difficulty;

    const subjectName = SUBJECT_NAMES[subject] || '주제';
    const difficultyName = problemData[subject]?.difficulty_map[difficulty] || '난이도';

    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    // 캔버스 초기화 (새 문제 로드 시 이전 풀이 지우기)
    setupCanvasContext(ctxP1);
    setupCanvasContext(ctxP2);

    const actualImagePath = problemData.url;
    
    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${problemData.id}) [동기화됨]`;
    
    problemImage.onerror = () => {
        console.error(`동기화된 이미지 로드 실패: ${actualImagePath}`); 
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=동기화+실패+경로:+${actualImagePath}`;
    };
    
    problemImage.src = actualImagePath;
}


/**
 * 💡 [수정] WebSocket 연결을 설정하고 이벤트 핸들러를 등록합니다.
 */
function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공. 서버와 통신 준비 완료.');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // 🚨 [핵심 동기화 1] 새로운 문제 출제 메시지를 받으면
            if (data.type === 'new_quiz_problem') {
                console.log('📢 서버로부터 문제 동기화 메시지 수신:', data.problem.id);
                syncQuizScreen(data.problem, data.subject, data.difficulty);
            } 
            // 🚨 [핵심 동기화 2] 드로잉 데이터를 받으면
            else if (data.type === 'draw_data') {
                executeDraw(data);
            } 
            // 🚨 [핵심 동기화 3] 전체 지우기 명령을 받으면
            else if (data.type === 'clear_canvas') {
                const ctx = drawingState[data.player].ctx;
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
            // 🚨 [핵심 동기화 4] 교사 주도 메인 화면 복귀 명령을 받으면
            else if (data.type === 'go_to_main_sync') {
                console.log('📢 서버로부터 메인 화면 복귀 명령 수신.');
                showMainScreen(true); // 동기화 플래그를 true로 전달
            }
            
        } catch (e) {
            console.error('WebSocket 메시지 파싱 오류:', e);
        }
    };

    ws.onclose = () => {
        console.warn('❌ WebSocket 연결이 끊어졌습니다. 5초 후 재접속 시도.');
        setTimeout(setupWebSocket, 5000); 
    };

    ws.onerror = (err) => {
        console.error('WebSocket 오류 발생:', err);
    };
}


// 앱 초기화 로직 변경
window.onload = async () => {
    setupMainUiEvents();
    setupWebSocket(); 
};
