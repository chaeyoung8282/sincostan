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
const solvingContainer = document.getElementById('solving-container'); 

// 💡 [NEW] 넌센스 문제 선택 영역
const nonsenseSelection = document.getElementById('nonsense-selection');

// 💡 채점 및 효과 관련 요소
const scoreButtonsP1 = document.getElementById('score-buttons-p1');
const scoreButtonsP2 = document.getElementById('score-buttons-p2');
const scoreEffectOverlay = document.getElementById('score-effect-overlay');
const scoreEffectMessage = document.getElementById('score-effect-message');


// 💡 [OPTIMIZATION] 캔버스 해상도 설정 (CSS 높이 280px에 맞춰 비율 조정)
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 280; 

canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

// 드로잉 상태를 저장할 객체
const drawingState = {
    p1: {
        isDrawing: false, lastX: 0, lastY: 0, color: '#000000', mode: 'pen',
        ctx: ctxP1, canvas: canvasP1, player: 'p1'
    },
    p2: {
        isDrawing: false, lastX: 0, lastY: 0, color: '#000000', mode: 'pen',
        ctx: ctxP2, canvas: canvasP2, player: 'p2'
    }
};

// 캔버스 초기화 및 스타일 설정 함수
function setupCanvasContext(ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

setupCanvasContext(ctxP1);
setupCanvasContext(ctxP2);

// =========================================================
// 전역 데이터 및 상태
// =========================================================

// --- 문제 관련 데이터 ---
const SUBJECT_NAMES = {
    polynomial: "다항식",
    equation: "방정식과 부등식",
    permutation: "순열과 조합",
    matrix: "행렬",
    geometry: "도형의 방정식",
    set: "집합과 명제",
    function: "함수와 그래프",
    nonsense: "넌센스 퀴즈" // 💡 [NEW] 넌센스 추가
};

// 공통수학 1 (BASIC STAGE)에 해당하는 주제 목록
const BASIC_STAGE_SUBJECTS = ['polynomial', 'equation', 'permutation', 'matrix']; 

// 💡 [NEW] 넌센스 퀴즈 전용 상수
const NONSENSE_SUBJECT = 'nonsense';
const NONSENSE_TIME_SECONDS = 120; // 넌센스 퀴즈 시간 (2분)

// --- 캐릭터/HP 관련 상수 설정 ---
const CHARACTER_CONFIG = {
    P1: {
        name: "WITCH (마녀)",
        imageFile: "witch.png", 
        initialHP: 5.0
    },
    P2: {
        name: "SOLDIER (군인)",
        imageFile: "soldier.png",
        initialHP: 5.0
    }
};

const IMAGE_ROOT_PATH = "/images/character/"; 
const HEART_FILES = {
    FULL: "full_heart.png",
    HALF: "half_heart.png",
    EMPTY: "empty_heart.png" 
};

const MAX_HEART_SLOTS = 10; 


// --- 타이머 관련 상수/변수 ---
const TIMER_DURATIONS = {
    'easy': 120,    // 2분
    'medium': 180,   // 3분
    'hard': 300      // 5분
};

const ALERT_TIME_SECONDS = 10; // 긴급 깜빡임 시작 시간 (초)
let quizTimer = null;
let timeLeft = 0; 
const quizTimerDisplay = document.getElementById('quiz-timer'); 

let currentSubject = '';
let currentDifficulty = ''; // 넌센스 모드일 때는 'nonsense'로 사용
let currentQuizNumber = null; // 넌센스 퀴즈 번호 저장용
let ws = null;

let playerHP = { 
    p1: CHARACTER_CONFIG.P1.initialHP,
    p2: CHARACTER_CONFIG.P2.initialHP
};

let isTeacher = false; 
let myPlayerId = 'p1'; 

// =========================================================
// 0. 역할/플레이어 식별 로직 및 HP 관리 (생략, 이전과 동일)
// =========================================================
function getRoleAndPlayerId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'teacher') {
        isTeacher = true;
        myPlayerId = 'teacher'; 
    } else if (params.get('player')) {
        const player = params.get('player').toLowerCase();
        if (player === 'p1' || player === 'p2') {
            isTeacher = false;
            myPlayerId = player;
        } else {
            isTeacher = false; 
            myPlayerId = 'p1';
        }
    } else {
        isTeacher = false;
        myPlayerId = 'p1';
    }
}

function updateHeartDisplay(playerId, hp) {
    const heartDisplay = document.getElementById(`hearts-${playerId}`);
    let html = '';
    playerHP[playerId] = Math.max(0, hp); 
    let currentHp = Math.min(playerHP[playerId], MAX_HEART_SLOTS);
    
    for (let i = 0; i < MAX_HEART_SLOTS; i++) { 
        let heartSrc = HEART_FILES.EMPTY; 
        if (currentHp >= 1.0) {
            heartSrc = HEART_FILES.FULL; 
            currentHp -= 1.0;
        } else if (currentHp >= 0.5) {
            heartSrc = HEART_FILES.HALF; 
            currentHp = 0; 
        }
        html += `<img src="${IMAGE_ROOT_PATH}${heartSrc}" alt="Heart" class="heart-icon">`;
    }
    heartDisplay.innerHTML = html;
}

function setupCharacterUI() {
    document.getElementById('char-p1').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P1.imageFile})`;
    document.getElementById('char-p2').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P2.imageFile})`;
}


// =========================================================
// 1. 드로잉 및 캔버스 관련 로직 (생략, 이전과 동일)
// =========================================================

function performDrawing(playerId, fromX, fromY, toX, toY, color, mode) {
    const state = drawingState[playerId];
    const ctx = state.ctx;

    ctx.beginPath();
    
    if (mode === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    } else if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20; 
    } else {
         ctx.globalCompositeOperation = 'source-over'; 
    }
    
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    ctx.globalCompositeOperation = 'source-over'; 
}


function setupCanvasListeners(playerId) {
    const state = drawingState[playerId];
    const canvas = state.canvas;

    if (!isTeacher && playerId !== myPlayerId) {
        canvas.style.pointerEvents = 'none'; 
        return; 
    }
    
    // ... (캔버스 좌표 및 드로잉 로직 생략, 이전과 동일)

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const draw = (e) => {
        if (!state.isDrawing) return;
        e.preventDefault(); 
        const { x, y } = getCoordinates(e);

        performDrawing(playerId, state.lastX, state.lastY, x, y, state.color, state.mode);

        sendWebSocketData({
            type: 'draw',
            playerId: playerId,
            from: { x: state.lastX, y: state.lastY },
            to: { x: x, y: y },
            color: state.color,
            mode: state.mode,
        });
        state.lastX = x;
        state.lastY = y;
    };
    
    const startDrawing = (e) => {
        state.isDrawing = true;
        const { x, y } = getCoordinates(e);
        state.lastX = x;
        state.lastY = y;
    };

    const stopDrawing = () => {
        state.isDrawing = false;
    };

    // 마우스 이벤트
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 터치 이벤트
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    // 툴 버튼 리스너 (생략, 이전과 동일)
    document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(btn => btn.classList.remove('selected'));
            
            const mode = button.dataset.mode || 'pen';
            state.mode = mode;
            
            if (mode === 'pen') {
                state.color = button.dataset.color || '#000000';
            }
            
            if (button.classList.contains('clear-btn')) {
                state.ctx.globalCompositeOperation = 'source-over';
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                sendWebSocketData({ type: 'clear', playerId: playerId });
            } else {
                button.classList.add('selected');
            }
        });
    });
}


// =========================================================
// 2. UI/레이아웃 및 동기화 로직 
// =========================================================

/**
 * 교사/학생 역할에 따라 퀴즈 화면 레이아웃을 설정합니다.
 */
function setupQuizView() {
    const player1Area = document.querySelector('.player-writing-area[data-player="p1"]');
    const player2Area = document.querySelector('.player-writing-area[data-player="p2"]');
    
    const isNonsenseMode = currentSubject === NONSENSE_SUBJECT; // 💡 [NEW] 넌센스 모드 확인
    
    if (isTeacher) {
        // 교사 모드: P1, P2 모두 표시 (넌센스 모드에서는 P2 숨김)
        player1Area.style.display = 'block';
        player2Area.style.display = isNonsenseMode ? 'none' : 'block'; // 💡 [MODIFIED] 넌센스일 경우 P2 숨김
        
        document.getElementById('tools-p1').style.display = 'flex';
        document.getElementById('tools-p2').style.display = isNonsenseMode ? 'none' : 'flex'; 
        
        scoreButtonsP1.style.display = 'block'; 
        scoreButtonsP2.style.display = isNonsenseMode ? 'none' : 'block'; // 💡 [MODIFIED] 넌센스일 경우 P2 채점 버튼 숨김
        
        solvingContainer.style.flexDirection = 'row'; 
        
        // 캔버스 크기 조정
        const canvasHeight = isNonsenseMode ? '400px' : '280px'; // 💡 [NEW] 넌센스일 경우 P1 영역을 더 크게
        player1Area.querySelector('.writing-canvas').style.height = canvasHeight; 
        player2Area.querySelector('.writing-canvas').style.height = '280px'; 
        
    } else {
        // 학생 모드: 자신의 영역만 크게 표시 (넌센스 모드에서는 무조건 P1 영역만 표시)
        const playerConfig = myPlayerId === 'p1' ? CHARACTER_CONFIG.P1 : CHARACTER_CONFIG.P2;

        if (myPlayerId === 'p1') {
            player1Area.style.display = 'block';
            player2Area.style.display = 'none';
            player1Area.style.minWidth = '100%'; 
            
            // 캔버스 높이 설정 (학생 모드는 항상 크게)
            const canvasHeight = isNonsenseMode ? '600px' : '600px'; 
            player1Area.querySelector('.writing-canvas').style.height = canvasHeight; 
            player1Area.querySelector('h3').textContent = `${playerConfig.name}님의 풀이`; 
        } else {
            // P2 학생이고 넌센스 모드라면, 풀이 영역이 필요 없으므로 숨김
            if (isNonsenseMode) {
                 player1Area.style.display = 'none';
                 player2Area.style.display = 'none';
            } else {
                 player1Area.style.display = 'none';
                 player2Area.style.display = 'block';
                 player2Area.style.minWidth = '100%';
                 player2Area.querySelector('.writing-canvas').style.height = '600px'; 
                 player2Area.querySelector('h3').textContent = `${playerConfig.name}님의 풀이`; 
            }
        }
        scoreButtonsP1.style.display = 'none'; 
        scoreButtonsP2.style.display = 'none';
        solvingContainer.style.flexDirection = 'column';
    }
}

/**
 * 메인 화면으로 돌아가기 (교사는 동기화 메시지 전송)
 */
function showMainScreen() {
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    difficultySelection.style.display = 'none';
    nonsenseSelection.style.display = 'none'; // 💡 [NEW] 넌센스 선택 UI 숨김
    scoreEffectOverlay.style.display = 'none';

    if (quizTimer) {
        clearInterval(quizTimer); 
        quizTimer = null;
    }
    
    if (isTeacher) {
        sendWebSocketData({ type: 'back_to_main' });
    }
    
    // 선택 상태 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    currentQuizNumber = null; // 💡 [NEW] 퀴즈 번호 초기화
    
    problemImage.onerror = null; 
}


// =========================================================
// 3. 메인 UI 이벤트 로직 
// =========================================================

/**
 * 주제 및 난이도 버튼 클릭 이벤트를 설정합니다.
 */
function setupMainUiEvents() {
    
    // 1. 주제 버튼 클릭 이벤트
    document.querySelectorAll('.subject-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!isTeacher) return; 
            
            document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
            
            currentSubject = e.target.dataset.subject;
            e.target.classList.add('selected');
            
            difficultySelection.style.display = 'none';
            nonsenseSelection.style.display = 'none';
            
            if (currentSubject === NONSENSE_SUBJECT) {
                // 💡 [NEW] 넌센스 선택 시 난이도 건너뛰고 문제 번호 선택 UI 표시
                nonsenseSelection.style.display = 'block';
                currentDifficulty = 'nonsense'; // 난이도에 임시 값 설정
            } else {
                // 💡 [MODIFIED] 수학 과목 선택 시 난이도 선택 UI 표시
                const hardBtn = document.querySelector('.difficulty-btn[data-difficulty="hard"]');
                
                if (BASIC_STAGE_SUBJECTS.includes(currentSubject)) {
                    hardBtn.style.display = 'none';
                } else {
                    hardBtn.style.display = 'inline-block'; 
                }
                difficultySelection.style.display = 'block';
                currentDifficulty = ''; // 난이도 초기화
            }
        });
    });

    // 2. 난이도 버튼 클릭 이벤트 (수학 퀴즈용)
    document.querySelectorAll('.difficulty-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!isTeacher) return; 
            
            currentDifficulty = e.target.dataset.difficulty;
            
            loadNewQuiz();
        });
    });
    
    // 💡 [NEW] 3. 넌센스 문제 번호 선택 이벤트
    document.querySelectorAll('.quiz-number-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!isTeacher) return;
            
            currentQuizNumber = e.target.dataset.quizNumber;
            // 넌센스 퀴즈는 난이도 대신 문제 번호를 서버에 전달하거나, 문제 ID로 사용합니다.
            
            loadNewQuiz();
        });
    });
    
    // 4. 메인으로 돌아가기 버튼 이벤트
    backToMainBtn.addEventListener('click', showMainScreen);
}

// =========================================================
// 4. 퀴즈 로딩 및 화면 표시 로직
// =========================================================

/**
 * 서버에 새로운 퀴즈를 요청하고 화면을 동기화합니다.
 */
async function loadNewQuiz() {
    let url;
    
    if (currentSubject === NONSENSE_SUBJECT) {
        if (!currentQuizNumber) {
            alert("문제 번호를 선택해주세요.");
            return;
        }
        // 넌센스 퀴즈의 URL은 문제 번호를 사용 (예: /api/quiz/nonsense/1)
        url = `/api/quiz/${currentSubject}/${currentQuizNumber}`;
    } else {
        if (!currentSubject || !currentDifficulty) {
            alert("주제와 난이도를 모두 선택해주세요.");
            return;
        }
        // 수학 퀴즈의 URL은 난이도를 사용
        url = `/api/quiz/${currentSubject}/${currentDifficulty}`;
    }

    showQuizScreen(); // 로딩 화면 표시 (선생님 화면 전환)
    
    // 1. 서버 API 호출
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        
        const problem = await response.json();
        
        // 2. 문제 정보 설정
        syncQuizScreen(problem);
        
        // 💡 [MODIFIED] 타이머 시작 (난이도/넌센스 모드에 따라 시간 결정)
        if (currentSubject === NONSENSE_SUBJECT) {
             startQuizTimer(NONSENSE_SUBJECT); // 넌센스 전용 시간 사용
        } else {
             startQuizTimer(currentDifficulty); // 난이도별 시간 사용
        }
        
        // 3. 캔버스 초기화 
        setupCanvasContext(ctxP1);
        setupCanvasContext(ctxP2);

        // 4. WS를 통해 다른 클라이언트에게 퀴즈 정보 및 클리어 메시지 전송
        sendWebSocketData({ 
            type: 'new_quiz', 
            problem: problem, 
            subject: currentSubject,
            difficulty: currentDifficulty,
            quizNumber: currentQuizNumber || null // 넌센스 문제 번호 포함
        });
        sendWebSocketData({ type: 'clear', playerId: 'p1' });
        sendWebSocketData({ type: 'clear', playerId: 'p2' });


    } catch (error) {
        console.error('퀴즈 로드 실패:', error);
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=${encodeURIComponent('퀴즈 로드 실패: ' + error.message)}`;
    }
}

/**
 * 문제 정보에 따라 화면 UI를 업데이트합니다. (로컬 및 원격 동기화 모두 사용)
 */
function syncQuizScreen(problem) {
    const subjectName = SUBJECT_NAMES[currentSubject] || currentSubject;
    const imagePath = problem.url; 

    problemImage.onerror = () => {
        console.error(`이미지 로드 실패 (404): ${imagePath}.`); 
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+파일경로:+${imagePath}`;
    };
    
    problemImage.src = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    canvasP1.width = CANVAS_WIDTH; canvasP1.height = CANVAS_HEIGHT;
    canvasP2.width = CANVAS_WIDTH; canvasP2.height = CANVAS_HEIGHT;

    setupQuizView(); 
}

/**
 * 퀴즈 화면을 표시하고 로딩 메시지를 설정합니다.
 */
function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    const subjectName = SUBJECT_NAMES[currentSubject] || '주제';
    const loadingMessage = `${subjectName} 문제를 서버에 요청 중...`;
    
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent(loadingMessage)}`;
}

/**
 * 타이머를 시작하고 1초마다 업데이트합니다.
 * @param {string} mode 현재 선택된 난이도 ('easy', 'medium', 'hard') 또는 'nonsense'
 */
function startQuizTimer(mode) {
    if (quizTimer) {
        clearInterval(quizTimer);
    }
    
    let initialDuration;
    if (mode === NONSENSE_SUBJECT) {
        initialDuration = NONSENSE_TIME_SECONDS; // 넌센스 전용 시간 (2분)
    } else {
        initialDuration = TIMER_DURATIONS[mode] || 60; // 난이도별 시간
    }
    
    timeLeft = initialDuration;

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `남은 시간: ${minutes}분 ${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}초`;
    };
    
    if (quizTimerDisplay) {
        quizTimerDisplay.textContent = formatTime(timeLeft);
        quizTimerDisplay.classList.remove('urgent'); 
    }
    
    quizTimer = setInterval(() => {
        timeLeft--;
        
        if (quizTimerDisplay) {
            quizTimerDisplay.textContent = formatTime(timeLeft);
        }
        
        if (timeLeft <= ALERT_TIME_SECONDS) {
            quizTimerDisplay.classList.add('urgent');
        }
        
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            if (quizTimerDisplay) {
                quizTimerDisplay.textContent = 'TIME OVER!';
                quizTimerDisplay.classList.remove('urgent'); 
            }
        }
    }, 1000);
}


// =========================================================
// 5. 채점 및 효과 로직 (생략, 이전과 동일)
// =========================================================

function setupScoringEvents() {
    document.querySelectorAll('.grade-btn').forEach(button => {
        if (!isTeacher) { return; }
        
        button.addEventListener('click', (e) => {
            const playerId = e.target.getAttribute('data-player');
            const result = e.target.getAttribute('data-result'); 
            
            let newHp = playerHP[playerId];
            if (result === 'correct') {
                newHp += 1.0; 
            } else if (result === 'incorrect') {
                newHp -= 0.5; 
            }
            
            updateHeartDisplay(playerId, newHp);
            
            sendWebSocketData({
                type: 'score_update',
                playerId: playerId,
                result: result,
                newHp: playerHP[playerId] 
            });
            
            showScoreEffect(result, playerId);
        });
    });
}

function showScoreEffect(result, playerId) {
    const playerConfig = playerId === 'p1' ? CHARACTER_CONFIG.P1 : CHARACTER_CONFIG.P2;
    const playerCharName = playerConfig.name;

    let message = '';
    let bgColor = '';
    
    if (result === 'correct') {
        message = `${playerCharName} 정답! (❤️ +1)`;
        bgColor = 'rgba(40, 167, 69, 0.9)'; 
    } else {
        message = `${playerCharName} 오답.. (💔 -0.5)`;
        bgColor = 'rgba(220, 53, 69, 0.9)'; 
    }
    
    scoreEffectMessage.textContent = message;
    scoreEffectMessage.style.backgroundColor = bgColor;
    scoreEffectOverlay.style.display = 'flex';
    
    setTimeout(() => {
        scoreEffectOverlay.style.display = 'none';
    }, 2000);
}


// =========================================================
// 6. WebSocket 동기화 로직
// =========================================================

function setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => { console.log('✅ WebSocket 연결 성공'); };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'draw':
                performDrawing(data.playerId, data.from.x, data.from.y, data.to.x, data.to.y, data.color, data.mode);
                break;
            case 'clear':
                setupCanvasContext(drawingState[data.playerId].ctx); 
                break;
            case 'back_to_main': 
                if (!isTeacher) { 
                    showMainScreen(); 
                }
                break;
            case 'new_quiz': 
                if (!isTeacher) {
                    currentSubject = data.subject;
                    currentDifficulty = data.difficulty; // nonsense 또는 난이도
                    currentQuizNumber = data.quizNumber || null; // 넌센스 번호
                    
                    showQuizScreen(); 
                    syncQuizScreen(data.problem);
                    setupCanvasContext(ctxP1); 
                    setupCanvasContext(ctxP2); 
                    
                    // 💡 [MODIFIED] 학생 클라이언트에서도 난이도/넌센스 정보를 이용해 타이머 시작
                    const timerMode = currentSubject === NONSENSE_SUBJECT ? NONSENSE_SUBJECT : currentDifficulty;
                    startQuizTimer(timerMode); 
                }
                break;
            case 'score_update': 
                updateHeartDisplay(data.playerId, data.newHp);
                showScoreEffect(data.result, data.playerId);
                break;
            default:
                console.warn('알 수 없는 WebSocket 메시지 타입:', data.type);
        }
    };
    ws.onclose = () => { console.log('❌ WebSocket 연결 종료'); };
    ws.onerror = (error) => { console.error('WebSocket 오류 발생:', error); };
}

function sendWebSocketData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        console.warn('WebSocket이 연결되지 않아 데이터를 전송할 수 없습니다.', data);
    }
}


// =========================================================
// 7. 초기화 (생략, 이전과 동일)
// =========================================================

window.onload = async () => {
    getRoleAndPlayerId(); 
    setupWebSocket();
    setupCanvasListeners('p1');
    setupCanvasListeners('p2');
    setupMainUiEvents(); 
    setupScoringEvents(); 
    setupCharacterUI();
    updateHeartDisplay('p1', playerHP.p1);
    updateHeartDisplay('p2', playerHP.p2);
    setupQuizView(); // 초기 로딩 시 레이아웃 설정
    console.log(`[Init] 역할: ${isTeacher ? '교사' : '학생'}, ID: ${myPlayerId}`);
};
