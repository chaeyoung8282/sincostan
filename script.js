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
    },
    p2: {
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        color: '#000000',
        mode: 'pen',
        ctx: ctxP2,
        canvas: canvasP2,
    }
};

let currentSubject = '';
let currentDifficulty = '';

/**
 * --- 문제 데이터 (클라이언트 측에서 서버로 요청하는 정보만 남김) ---
 * 서버의 problems.json에 정의된 난이도 맵과 주제 이름만 유지합니다.
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

    state.ctx.beginPath();
    
    // 지우개 모드
    if (state.mode === 'eraser') {
        state.ctx.globalCompositeOperation = 'destination-out';
        state.ctx.lineWidth = 20; // 지우개 크기
    } else {
        // 펜 모드
        state.ctx.globalCompositeOperation = 'source-over';
        state.ctx.lineWidth = 5;
        state.ctx.strokeStyle = state.color;
    }
    
    state.ctx.moveTo(state.lastX, state.lastY);
    state.ctx.lineTo(currentX, currentY);
    state.ctx.stroke();

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
        state.isDrawing = false;
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
                // 전체 지우기
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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

    backToMainBtn.addEventListener('click', showMainScreen);
}

/**
 * 퀴즈 화면을 표시하고 서버에서 문제를 로드합니다.
 */
async function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    const subjectName = SUBJECT_NAMES[currentSubject] || '주제';
    const difficultyName = problemData[currentSubject]?.difficulty_map[currentDifficulty] || '난이도';
    
    const loadingMessage = `${subjectName} / ${difficultyName} 문제를 서버에 요청 중...`;
    
    currentSubjectDifficulty.textContent = loadingMessage;
    // 로딩 중임을 표시하는 이미지로 대체
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent('서버에 문제 요청 중...')}`;
    
    let selectedProblem;

    // 1. 서버 API를 호출하여 문제를 가져옵니다.
    try {
        const url = `/api/quiz/${currentSubject}/${currentDifficulty}`;
        console.log(`[문제 시스템] 서버 API 호출 시도: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        selectedProblem = await response.json();
    } catch (e) {
        // API 요청 실패 또는 서버에서 에러 메시지 반환 시 처리
        const errorMessage = e.message || "알 수 없는 서버 오류";
        currentSubjectDifficulty.textContent = `오류: 문제를 로드하는 데 실패했습니다. (${errorMessage})`;
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!`;
        console.error("문제 로드 API 실패:", e);
        return;
    }
    
    // 2. 서버가 반환한 문제의 논리적 URL을 그대로 사용합니다.
    const actualImagePath = selectedProblem.url;
    
    // 현재 문제/난이도 표시 업데이트 (ID 포함)
    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${selectedProblem.id})`;
    
    // 3. 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        // GitHub Pages 환경에서는 /images/... 경로가 루트를 기준으로 로드되어야 합니다.
        console.error(`이미지 로드 실패 (404): ${actualImagePath}. 폴백 텍스트로 대체합니다.`); 
        // 에러 발생 시 폴백 이미지에 실패 경로 표시
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+경로:+${actualImagePath}`;
    };
    
    console.log(`이미지 로딩 시도 경로: ${actualImagePath}`);

    // 4. 이미지 소스 설정 (로딩 시작)
    problemImage.src = actualImagePath;
}

function showMainScreen() {
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    difficultySelection.style.display = 'none';

    // 선택 상태 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
    // 이미지 에러 핸들러 초기화
    problemImage.onerror = null; 
}


// 앱 초기화
window.onload = async () => {
    setupMainUiEvents();
};


// script.js (파일 하단)

let ws; // WebSocket 객체 변수

/**
 * WebSocket 연결을 설정하고 이벤트 핸들러를 등록합니다.
 */
function setupWebSocket() {
    // 현재 접속 환경의 프로토콜을 사용하여 WebSocket 주소 설정
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공. 서버와 통신 준비 완료.');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // 🚨 [핵심 동기화 로직] 서버에서 새로운 문제 출제 메시지를 받으면
            if (data.type === 'new_quiz_problem') {
                console.log('📢 서버로부터 문제 동기화 메시지 수신:', data.problem.id);
                // 모든 클라이언트의 화면을 받은 문제로 전환합니다.
                syncQuizScreen(data.problem, data.subject, data.difficulty);
            }
        } catch (e) {
            console.error('WebSocket 메시지 파싱 오류:', e);
        }
    };

    ws.onclose = () => {
        console.warn('❌ WebSocket 연결이 끊어졌습니다. 5초 후 재접속 시도.');
        // 연결이 끊어지면 자동으로 재접속 시도
        setTimeout(setupWebSocket, 5000); 
    };

    ws.onerror = (err) => {
        console.error('WebSocket 오류 발생:', err);
    };
}

/**
 * 서버에서 전송된 문제 정보로 화면을 동기화합니다.
 */
function syncQuizScreen(problemData, subject, difficulty) {
    // 난이도, 주제 전역 변수 업데이트 (클릭 이벤트가 없었을 경우 대비)
    currentSubject = subject;
    currentDifficulty = difficulty;

    const subjectName = SUBJECT_NAMES[subject] || '주제';
    const difficultyName = problemData[subject]?.difficulty_map[difficulty] || '난이도';

    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';

    const actualImagePath = problemData.url;
    
    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${problemData.id}) [동기화됨]`;
    
    // 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        console.error(`동기화된 이미지 로드 실패: ${actualImagePath}`); 
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=동기화+실패+경로:+${actualImagePath}`;
    };
    
    problemImage.src = actualImagePath;
}


// 앱 초기화 로직 변경
window.onload = async () => {
    setupMainUiEvents();
    setupWebSocket(); // 💡 WebSocket 연결을 시작합니다.
};


/**
 * 💡 기존 showQuizScreen 함수 수정: 
 * API 요청이 성공하면 (교사 태블릿에서), 
 * 서버가 이미 WebSocket으로 브로드캐스팅했기 때문에 
 * 이 함수 내에서는 직접 화면을 바꾸지 않고, 
 * 서버 응답에 맞춰 브로드캐스팅을 기다리도록 로직을 간소화할 수 있습니다.
 * (이미 이전 단계에서 수정된 버전의 script.js를 가정하고 이 로직을 작성합니다.)
 */
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
        
        // 💡 [수정 사항] 서버 API 응답을 기다리지 않고, 
        // 서버가 곧바로 WebSocket으로 브로드캐스팅할 것이므로 
        // 클라이언트(교사 태블릿 포함)는 syncQuizScreen 함수를 통해 동기화됩니다.
        // 여기서는 API 요청 성공만 확인하고 바로 종료합니다.
        console.log('API 요청 성공. WebSocket 동기화 대기 중...');

    } catch (e) {
        const errorMessage = e.message || "알 수 없는 서버 오류";
        currentSubjectDifficulty.textContent = `오류: 문제를 로드하는 데 실패했습니다. (${errorMessage})`;
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!`;
        console.error("문제 로드 API 실패:", e);
        return;
    }
}
