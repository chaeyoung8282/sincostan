// 캔버스 요소를 가져옵니다.
const canvasP1 = document.getElementById('canvas-p1');
const ctxP1 = canvasP1.getContext('2d');
const canvasP2 = document.getElementById('canvas-p2');
const ctxP2 = canvasP2.getContext('2d');

// 메인 화면과 퀴즈 화면 요소를 가져옵니다.
const mainScreen = document.getElementById('main-screen');
const quizScreen = document.getElementById('quiz-screen');
// 💡 [FIX 1] currentSubjectDifficulty 요소는 HTML에서 삭제되었으므로, 변수 선언은 유지하되 사용 시 주의해야 합니다.
const currentSubjectDifficulty = document.getElementById('current-subject-difficulty'); 
const problemImage = document.getElementById('problem-image');
const backToMainBtn = document.getElementById('back-to-main');
const difficultySelection = document.getElementById('difficulty-selection');
const solvingContainer = document.getElementById('solving-container'); 

// 💡 채점 및 효과 관련 요소
const scoreButtonsP1 = document.getElementById('score-buttons-p1');
const scoreButtonsP2 = document.getElementById('score-buttons-p2');
const scoreEffectOverlay = document.getElementById('score-effect-overlay');
const scoreEffectMessage = document.getElementById('score-effect-message');


// 💡 [OPTIMIZATION] 캔버스 해상도 설정 (CSS 높이 280px에 맞춰 비율 조정)
const CANVAS_WIDTH = 550; 
const CANVAS_HEIGHT = 280; // 400px -> 280px로 변경하여 수직 공간 확보

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
    function: "함수와 그래프"
};

// 공통수학 1 (BASIC STAGE)에 해당하는 주제 목록
const BASIC_STAGE_SUBJECTS = ['polynomial', 'equation', 'permutation', 'matrix']; 

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

// 폴더 이름이 'character'라고 가정하고 수정합니다.
const IMAGE_ROOT_PATH = "/images/character/"; 
const HEART_FILES = {
    FULL: "full_heart.png",
    HALF: "half_heart.png",
    EMPTY: "empty_heart.png" 
};

// 하트 아이콘의 최대 표시 개수를 설정합니다.
const MAX_HEART_SLOTS = 10; 


// --- 💡 [MODIFIED] 타이머 관련 상수/변수 ---
const TIMER_DURATIONS = {
    'easy': 120,    // 2분
    'medium': 180,   // 3분
    'hard': 300      // 5분
};

const ALERT_TIME_SECONDS = 10; // 긴급 깜빡임 시작 시간 (초)
let quizTimer = null;
let timeLeft = 0; // 초기값 0으로 설정
const quizTimerDisplay = document.getElementById('quiz-timer'); // HTML에서 추가된 요소

let currentSubject = '';
let currentDifficulty = '';
let ws = null;

// HP 초기화: CONFIG에서 가져옴
let playerHP = { 
    p1: CHARACTER_CONFIG.P1.initialHP,
    p2: CHARACTER_CONFIG.P2.initialHP
};

let isTeacher = false; 
let myPlayerId = 'p1'; 

// =========================================================
// 0. 역할/플레이어 식별 로직 및 HP 관리
// =========================================================

/**
 * URL 파라미터를 파싱하여 역할과 플레이어 ID를 설정합니다.
 */
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

/**
 * HP 상태에 따라 하트 이미지 아이콘을 업데이트합니다.
 */
function updateHeartDisplay(playerId, hp) {
    const heartDisplay = document.getElementById(`hearts-${playerId}`);
    let html = '';
    
    // 1. HP 업데이트: 0보다 큰 값만 허용합니다.
    playerHP[playerId] = Math.max(0, hp); 
    
    // 2. UI 표시를 위해 현재 HP를 가져옵니다. 
    // 최대 MAX_HEART_SLOTS (10.0)까지만 UI에 표시되도록 제한합니다.
    let currentHp = Math.min(playerHP[playerId], MAX_HEART_SLOTS);
    
    // 3. 하트 아이콘 생성: MAX_HEART_SLOTS (10) 만큼 반복하도록 변경
    for (let i = 0; i < MAX_HEART_SLOTS; i++) { 
        let heartSrc = HEART_FILES.EMPTY; // 기본은 빈 하트

        if (currentHp >= 1.0) {
            heartSrc = HEART_FILES.FULL; // 꽉 찬 하트
            currentHp -= 1.0;
        } else if (currentHp >= 0.5) {
            heartSrc = HEART_FILES.HALF; // 반 하트
            currentHp = 0; 
        }
        
        // 이미지 경로에 IMAGE_ROOT_PATH 사용
        html += `<img src="${IMAGE_ROOT_PATH}${heartSrc}" alt="Heart" class="heart-icon">`;
    }
    
    heartDisplay.innerHTML = html;
}

/**
 * 캐릭터 이미지를 UI에 설정합니다. (메인 화면용)
 */
function setupCharacterUI() {
    // 이미지 경로에 IMAGE_ROOT_PATH 사용
    document.getElementById('char-p1').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P1.imageFile})`;
    document.getElementById('char-p2').style.backgroundImage = `url(${IMAGE_ROOT_PATH}${CHARACTER_CONFIG.P2.imageFile})`;
}


// =========================================================
// 1. 드로잉 및 캔버스 관련 로직 
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
    
    // 툴 버튼 리스너
    document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll(`#tools-${playerId} .tool-btn`).forEach(btn => btn.classList.remove('selected'));
            
            const mode = button.dataset.mode || 'pen';
            state.mode = mode;
            
            if (mode === 'pen') {
                state.color = button.dataset.color || '#000000';
            }
            
            if (button.classList.contains('clear-btn')) {
                // 전체 지우기
                state.ctx.globalCompositeOperation = 'source-over';
                state.ctx.fillStyle = '#ffffff';
                state.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                // WS 동기화
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
    
    if (isTeacher) {
        // 교사 모드: P1, P2 모두 표시하고 채점 버튼 표시
        player1Area.style.display = 'block';
        player2Area.style.display = 'block';
        document.getElementById('tools-p1').style.display = 'flex';
        document.getElementById('tools-p2').style.display = 'flex';
        scoreButtonsP1.style.display = 'block'; 
        scoreButtonsP2.style.display = 'block'; 
        solvingContainer.style.flexDirection = 'row'; 
        // 💡 [OPTIMIZATION] CSS와 맞춤
        player1Area.querySelector('.writing-canvas').style.height = '280px'; 
        player2Area.querySelector('.writing-canvas').style.height = '280px'; 
        
    } else {
        // 학생 모드: 자신의 영역만 크게 표시
        const playerConfig = myPlayerId === 'p1' ? CHARACTER_CONFIG.P1 : CHARACTER_CONFIG.P2;

        if (myPlayerId === 'p1') {
            player1Area.style.display = 'block';
            player2Area.style.display = 'none';
            player1Area.style.minWidth = '100%'; 
            player1Area.querySelector('.writing-canvas').style.height = '600px'; 
            player1Area.querySelector('h3').textContent = `${playerConfig.name}님의 풀이`; 
        } else {
            player1Area.style.display = 'none';
            player2Area.style.display = 'block';
            player2Area.style.minWidth = '100%';
            player2Area.querySelector('.writing-canvas').style.height = '600px'; 
            player2Area.querySelector('h3').textContent = `${playerConfig.name}님의 풀이`; 
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
    scoreEffectOverlay.style.display = 'none';

    // 💡 [FIX] 타이머 정지
    if (quizTimer) {
        clearInterval(quizTimer); 
        quizTimer = null;
    }
    
    // 💡 교사일 경우에만 WS 메시지를 보내 다른 클라이언트를 동기화
    if (isTeacher) {
        sendWebSocketData({ type: 'back_to_main' });
    }
    
    // 선택 상태 초기화
    document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
    currentSubject = '';
    currentDifficulty = '';
    
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
            
            // 공통수학 1(BASIC STAGE)을 위한 '상' 난이도 버튼 제어
            const hardBtn = document.querySelector('.difficulty-btn[data-difficulty="hard"]');
            
            if (BASIC_STAGE_SUBJECTS.includes(currentSubject)) {
                // 공통수학 1 (BASIC) 선택 시 '상' 난이도 숨기기
                hardBtn.style.display = 'none';
            } else {
                // 공통수학 2 (ADVANCED) 선택 시 '상' 난이도 보이기
                hardBtn.style.display = 'inline-block'; 
            }
            
            difficultySelection.style.display = 'block';
        });
    });

    // 2. 난이도 버튼 클릭 이벤트
    document.querySelectorAll('.difficulty-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!isTeacher) return; 
            
            currentDifficulty = e.target.dataset.difficulty;
            
            loadNewQuiz();
        });
    });
    
    // 3. 메인으로 돌아가기 버튼 이벤트
    backToMainBtn.addEventListener('click', showMainScreen);
}

// =========================================================
// 4. 퀴즈 로딩 및 화면 표시 로직
// =========================================================

/**
 * 서버에 새로운 퀴즈를 요청하고 화면을 동기화합니다.
 */
async function loadNewQuiz() {
    if (!currentSubject || !currentDifficulty) {
        alert("주제와 난이도를 모두 선택해주세요.");
        return;
    }
    
    showQuizScreen(); // 로딩 화면 표시 (선생님 화면 전환)
    
    // 1. 서버 API 호출
    const url = `/api/quiz/${currentSubject}/${currentDifficulty}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }
        
        const problem = await response.json();
        
        // 2. 문제 정보 설정
        syncQuizScreen(problem);
        
        // 💡 [MODIFIED] 타이머 시작 (난이도 정보 전달)
        startQuizTimer(currentDifficulty);
        
        // 3. 캔버스 초기화 
        setupCanvasContext(ctxP1);
        setupCanvasContext(ctxP2);

        // 4. WS를 통해 다른 클라이언트에게 퀴즈 정보 및 클리어 메시지 전송
        sendWebSocketData({ 
            type: 'new_quiz', 
            problem: problem, 
            subject: currentSubject,
            difficulty: currentDifficulty
        });
        sendWebSocketData({ type: 'clear', playerId: 'p1' });
        sendWebSocketData({ type: 'clear', playerId: 'p2' });


    } catch (error) {
        console.error('퀴즈 로드 실패:', error);
        // 💡 [FIX 2] 오류 발생 시에도 삭제된 요소에 접근하지 않도록 수정
        // currentSubjectDifficulty.textContent = `오류: ${error.message}`; // 이 줄 제거
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=${encodeURIComponent('퀴즈 로드 실패: ' + error.message)}`;
    }
}

/**
 * 문제 정보에 따라 화면 UI를 업데이트합니다. (로컬 및 원격 동기화 모두 사용)
 */
function syncQuizScreen(problem) {
    const subjectName = SUBJECT_NAMES[currentSubject] || currentSubject;
    const imagePath = problem.url; 

    // 💡 [FIX 3] HTML에서 삭제된 요소에 접근하는 코드 제거
    // currentSubjectDifficulty.textContent = `${subjectName} / ${problem.id}`; // 이 줄 제거
    
    problemImage.onerror = () => {
        console.error(`이미지 로드 실패 (404): ${imagePath}.`); 
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+파일경로:+${imagePath}`;
    };
    
    // 이미지 소스 설정: Render는 정적 파일을 프로젝트 루트 기준으로 제공하므로, 절대 경로(/images/...)를 사용합니다.
    problemImage.src = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    // 💡 [OPTIMIZATION] 캔버스 해상도 재설정 (CSS 높이와 맞춤)
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
    
    // 💡 [FIX 4] HTML에서 삭제된 요소에 접근하는 코드 제거
    // currentSubjectDifficulty.textContent = loadingMessage; // 이 줄 제거
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent(loadingMessage)}`;
}

/**
 * 💡 [MODIFIED] 타이머를 시작하고 1초마다 업데이트합니다.
 * @param {string} difficulty 현재 선택된 난이도 ('easy', 'medium', 'hard')
 */
function startQuizTimer(difficulty) {
    // 1. 기존 타이머 제거
    if (quizTimer) {
        clearInterval(quizTimer);
    }
    
    // 2. 초기 시간 설정 (난이도에 따라)
    let initialDuration = TIMER_DURATIONS[difficulty] || 60; // 난이도 정보가 없으면 기본 60초
    timeLeft = initialDuration;

    // 3. 타이머 표시 포맷팅 함수
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `남은 시간: ${minutes}분 ${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}초`;
    };
    
    // 4. 초기 상태 설정
    if (quizTimerDisplay) {
        quizTimerDisplay.textContent = formatTime(timeLeft);
        quizTimerDisplay.classList.remove('urgent'); // 초기화
    }
    
    // 5. 타이머 시작
    quizTimer = setInterval(() => {
        timeLeft--;
        
        if (quizTimerDisplay) {
            quizTimerDisplay.textContent = formatTime(timeLeft);
        }
        
        // 6. 긴급 깜빡임 효과 적용
        if (timeLeft <= ALERT_TIME_SECONDS) {
            quizTimerDisplay.classList.add('urgent');
        }
        
        // 7. 시간 종료 처리
        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            if (quizTimerDisplay) {
                quizTimerDisplay.textContent = 'TIME OVER!';
                quizTimerDisplay.classList.remove('urgent'); // 혹시 남아있을 경우 제거
            }
            
            // TODO: (선택 사항) 시간이 초과되었을 때 정답/오답 처리를 강제로 진행하거나 HP를 차감하는 로직을 여기에 추가할 수 있습니다.
        }
    }, 1000);
}


// =========================================================
// 5. 채점 및 효과 로직 
// =========================================================

/**
 * 채점 버튼 이벤트 설정 (교사 전용)
 */
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

/**
 * 채점 결과에 따른 시각적 효과를 표시합니다.
 */
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
    // 💡 Render 환경에 맞춰 프로토콜 및 호스트 사용
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
                    currentDifficulty = data.difficulty;
                    showQuizScreen(); 
                    syncQuizScreen(data.problem);
                    setupCanvasContext(ctxP1); 
                    setupCanvasContext(ctxP2); 
                    // 💡 [MODIFIED] 학생 클라이언트에서도 난이도 정보를 이용해 타이머 시작
                    startQuizTimer(currentDifficulty); 
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
// 7. 초기화
// =========================================================

window.onload = async () => {
    // 1. 역할 및 플레이어 ID를 먼저 설정합니다.
    getRoleAndPlayerId(); 
    
    // 2. WebSocket 연결 설정
    setupWebSocket();
    
    // 3. 캔버스 드로잉 리스너 설정
    setupCanvasListeners('p1');
    setupCanvasListeners('p2');
    
    // 4. 메인 UI 버튼 리스너 설정
    setupMainUiEvents(); 
    
    // 5. 채점 버튼 리스너 설정 (교사 전용)
    setupScoringEvents(); 
    
    // 6. 캐릭터 이름 및 이미지 설정 (메인 화면)
    setupCharacterUI();
    
    // 7. 초기 HP 표시 (메인 화면)
    updateHeartDisplay('p1', playerHP.p1);
    updateHeartDisplay('p2', playerHP.p2);
    
    // 8. 초기 레이아웃 설정 (퀴즈 화면용)
    setupQuizView();
    
    console.log(`[Init] 역할: ${isTeacher ? '교사' : '학생'}, ID: ${myPlayerId}`);
};
