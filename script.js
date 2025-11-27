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
const timerDisplayTop = document.getElementById('timer-display-top'); // 상단 타이머
const timerDisplayBottom = document.getElementById('timer-display-bottom'); // 하단 타이머

// 정답 공개 관련 요소
const revealAnswerBtn = document.getElementById('reveal-answer-btn');
const answerRevealOverlay = document.getElementById('answer-reveal-overlay');
const answerImage = document.getElementById('answer-image');
const closeAnswerBtn = document.getElementById('close-answer-btn');
const confettiContainer = document.getElementById('confetti-container');
// '상 (BOSS)' 난이도 버튼 요소
const hardDifficultyBtn = document.querySelector('.difficulty-btn[data-difficulty="hard"]');


// 캔버스 해상도 설정 (내부 드로잉 해상도)
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
    },
};

// 전역 상태 변수
let currentDifficulty = null;
let currentSubject = null;
let currentProblemArray = []; // 현재 난이도의 남은 문제 목록
let currentProblemId = null; // 현재 출제된 문제의 ID
let timerInterval = null; // 타이머를 제어할 인터벌 ID
let initialTime = 0; // 초기 설정 시간 (난이도별로 다름)
let timeRemaining = 0; // 남은 시간
let ws = null; // WebSocket 연결 객체
let currentAnswerUrl = ''; // 현재 문제의 정답 URL을 저장할 변수

// =========================================================
// 1. 드로잉 및 캔버스 관련 로직 (기존과 동일)
// =========================================================

/**
 * 캔버스 이벤트 리스너 설정
 * @param {string} playerId 'p1' 또는 'p2'
 */
function setupCanvasListeners(playerId) {
    const state = drawingState[playerId];
    
    // 캔버스의 실제 표시 크기(CSS 크기)와 내부 해상도의 비율을 계산하여 좌표 보정
    const getCoordinates = (e) => {
        const rect = state.canvas.getBoundingClientRect();
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        
        // 터치 또는 마우스 이벤트에서 좌표를 가져옵니다.
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const draw = (e) => {
        if (!state.isDrawing) return;
        
        e.preventDefault(); // 터치 스크롤 방지
        const { x, y } = getCoordinates(e);

        // 로컬 드로잉
        performDrawing(playerId, state.lastX, state.lastY, x, y, state.color, state.mode);

        // 서버로 드로잉 데이터 전송 (다른 클라이언트에 동기화)
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
    state.canvas.addEventListener('mousedown', startDrawing);
    state.canvas.addEventListener('mousemove', draw);
    state.canvas.addEventListener('mouseup', stopDrawing);
    state.canvas.addEventListener('mouseout', stopDrawing);
    
    // 터치 이벤트
    state.canvas.addEventListener('touchstart', startDrawing);
    state.canvas.addEventListener('touchmove', draw);
    state.canvas.addEventListener('touchend', stopDrawing);
    state.canvas.addEventListener('touchcancel', stopDrawing);
}

/**
 * 실제로 캔버스에 드로잉을 수행하는 함수 (로컬 및 원격 드로잉 모두 사용)
 */
function performDrawing(playerId, fromX, fromY, toX, toY, color, mode) {
    const state = drawingState[playerId];
    const ctx = state.ctx;

    ctx.beginPath();
    
    if (mode === 'pen') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

    } else if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20; // 지우개 크기
        
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over'; // 기본값으로 복원
    }
}

/**
 * 캔버스의 모든 내용을 지우는 함수
 */
function clearCanvas(playerId) {
    const state = drawingState[playerId];
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    
    // 서버로 캔버스 지우기 동기화
    sendWebSocketData({ type: 'clear', playerId: playerId });
}

/**
 * 드로잉 도구 버튼 이벤트 설정
 */
function setupToolEvents() {
    document.querySelectorAll('.tool-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const player = e.target.getAttribute('data-player');
            const mode = e.target.getAttribute('data-mode') || 'pen'; // mode가 없으면 pen

            // 동일 플레이어의 모든 버튼에서 'selected' 클래스 제거
            document.querySelectorAll(`.drawing-tools [data-player="${player}"]`).forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // 현재 버튼에 'selected' 클래스 추가
            if (mode !== 'clear') {
                e.target.classList.add('selected');
            }

            // 상태 업데이트
            const state = drawingState[player];
            state.mode = mode;
            
            if (mode === 'pen') {
                state.color = e.target.getAttribute('data-color') || '#000000';
            }
        });
    });

    // 전체 지우기 버튼 이벤트
    document.querySelectorAll('.clear-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const player = e.target.getAttribute('data-player');
            clearCanvas(player);
        });
    });
}

// =========================================================
// 2. 타이머 로직 (기존과 동일)
// =========================================================

function startTimer(durationInSeconds) {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    initialTime = durationInSeconds;
    timeRemaining = durationInSeconds;
    
    // 타이머를 1초마다 업데이트
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay(timeRemaining);
    }, 1000);

    // 초기 디스플레이 업데이트
    updateTimerDisplay(timeRemaining);
}

function updateTimerDisplay(timeInSeconds) {
    const minutes = String(Math.floor(timeInSeconds / 60)).padStart(2, '0');
    const seconds = String(timeInSeconds % 60).padStart(2, '0');
    
    const displayTime = `${minutes}:${seconds}`;
    
    timerDisplayTop.textContent = `⏱️ 남은 시간: ${displayTime}`;
    timerDisplayBottom.textContent = `⏱️ 남은 시간: ${displayTime}`; // 하단 타이머도 동기화

    const criticalThreshold = Math.min(initialTime * 0.2, 30); // 전체 시간의 20% 또는 30초 중 작은 값

    // 시간이 적게 남았을 때 스타일 변경 (깜빡임)
    if (timeInSeconds <= criticalThreshold && timeInSeconds > 0) {
        timerDisplayTop.classList.add('critical-time');
    } else {
        timerDisplayTop.classList.remove('critical-time');
    }

    if (timeInSeconds <= 0) {
        // 시간이 0이 되면 타이머 종료 처리
        clearInterval(timerInterval);
        timerDisplayTop.textContent = "⏱️ 시간 종료! (00:00)";
        timerDisplayTop.classList.remove('critical-time');
        
        // 타이머 종료 시 정답 확인 버튼 표시
        revealAnswerBtn.style.display = 'inline-block';
        
        // 문제 동기화와 마찬가지로, 교사 화면에서만 종료 명령을 보내 동기화
        if (currentDifficulty && currentSubject) {
             sendWebSocketData({ 
                type: 'timer_finished',
                difficulty: currentDifficulty 
            });
        }
    }
}


// =========================================================
// 3. 문제 로딩 및 동기화 로직 (AJAX 및 WebSocket)
// =========================================================

const difficultyMap = {
    'easy': { name: '하 (TRAINING)', time: 120 },
    'medium': { name: '중 (CHALLENGE)', time: 90 },
    'hard': { name: '상 (BOSS)', time: 60 },
};

/**
 * 서버의 problems.json 문제 경로를 실제 파일 경로로 변환
 */
function resolveImagePath(logicalPath) {
    // 예: "/images/polynomial/easy_1.png" -> http://localhost:8080/images/polynomial/easy_1.png
    return logicalPath; 
}


/**
 * 새 퀴즈를 서버에 요청하고 화면에 로드
 */
async function loadNewQuiz(subject, difficulty) {
    try {
        const response = await fetch(`/api/quiz/${subject}/${difficulty}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const problemResponse = await response.json(); // 서버 응답은 problemResponse로 받습니다.
        
        if (problemResponse.error) {
            alert(problemResponse.error);
            showMainScreen();
            return;
        }

        // 새 문제를 성공적으로 가져왔으므로 화면 동기화
        sendWebSocketData({ 
            type: 'quiz_start', 
            problemData: problemResponse, // 서버 응답 객체 전체를 전달
            subject: subject, 
            difficulty: difficulty 
        });

        // 로컬에서 화면 동기화 함수 호출
        syncQuizScreen(problemResponse, subject, difficulty);

    } catch (error) {
        // 🚨 [수정] 퀴즈 로드 실패 시 콘솔에만 기록하고 불필요한 알림은 띄우지 않습니다.
        console.error('퀴즈 로드 중 오류 발생. 서버 상태 또는 네트워크를 확인해주세요:', error);
    }
}

/**
 * 퀴즈 화면에 문제 정보 및 이미지 로드
 * @param {object} problemResponse 서버로부터 받은 응답 객체 (nextProblem, remainingProblems, subjectName 포함)
 * @param {string} subject 현재 주제
 * @param {string} difficulty 현재 난이도
 */
function syncQuizScreen(problemResponse, subject, difficulty) {
    // 서버 응답 객체의 구조를 확인하여 문제 데이터를 가져옵니다.
    const problemData = problemResponse.nextProblem;
    // 남은 문제 배열의 길이를 확인합니다.
    const remainingProblemsCount = problemResponse.remainingProblems ? problemResponse.remainingProblems.length : 0;
    
    if (!problemData) {
        // 문제 데이터가 없으면 오류 처리
        console.error("문제 데이터가 유효하지 않습니다.", problemResponse);
        alert("더 이상 남은 문제가 없거나 데이터가 유효하지 않습니다.");
        showMainScreen();
        return;
    }

    const subjectName = problemResponse.subjectName; // 서버 응답에서 subjectName을 가져옴
    const difficultyName = difficultyMap[difficulty].name;
    const problemUrl = problemData.url;
    
    currentProblemId = problemData.id;
    currentSubject = subject;
    currentDifficulty = difficulty;
    // 남은 문제 수 업데이트 로직 (배열 자체는 필요 없으므로 길이만 사용)
    currentProblemArray = problemResponse.remainingProblems || []; 
    
    // 1. 화면 전환 및 캔버스 클리어
    quizScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
    clearCanvas('p1');
    clearCanvas('p2');

    // 2. 문제 이미지 로딩
    let actualImagePath;
    const systemFileName = problemData.system_file_name;

    // 'easy' 난이도이면서 systemFileName이 있는 경우 (특정 서버 설정에 대한 임시 대응)
    if (difficulty === 'easy' && systemFileName) {
        // 서버의 파일 시스템에서 직접 파일을 로드하는 경로를 사용합니다.
        actualImagePath = resolveImagePath(systemFileName);
    } else {
        // 다른 문제들은 기존 로직(problems.json에 등록된 url) 사용
        actualImagePath = resolveImagePath(problemUrl); 
    }
    
    // 정답 이미지 URL 저장
    currentAnswerUrl = problemData.answer_url; 
    
    // 현재 문제/난이도 표시 업데이트
    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${problemData.id}) (남은 문제: ${remainingProblemsCount}개)`;
    
    // 3. 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        // 에러 발생 시 폴백 이미지에 실패 경로 표시
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!`;
    };
    
    // 4. 이미지 소스 설정 (로딩 시작)
    problemImage.src = actualImagePath;
    
    // 5. 타이머 시작
    const duration = difficultyMap[difficulty].time;
    startTimer(duration);

    // 새 문제 시작 시 정답 버튼 숨기기
    revealAnswerBtn.style.display = 'none'; 
    answerRevealOverlay.style.display = 'none'; // 오버레이 숨기기
}


// =========================================================
// 4. 메인 UI 이벤트 및 정답 로직 (기존과 동일)
// =========================================================

function showMainScreen() {
    mainScreen.style.display = 'block';
    quizScreen.style.display = 'none';
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}

/**
 * 팡파레 효과 (Confetti)를 발생시키는 함수
 */
function launchConfetti() {
    // 기존 효과 제거 (중복 방지)
    confettiContainer.innerHTML = ''; 

    // 30개의 색종이 조각 생성
    for (let i = 0; i < 30; i++) {
        const c = document.createElement('div');
        c.classList.add('confetti');
        
        // 무작위 위치 및 애니메이션 설정
        c.style.left = `${Math.random() * 100}vw`; 
        c.style.animationDelay = `${Math.random() * 2}s`; 
        c.style.transform = `translateY(${Math.random() * -10}vh)`; 
        
        // 색상 다양화
        const colors = ['#ff00ff', '#ffeb3b', '#00bcd4', '#4caf50', '#ff5722'];
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        confettiContainer.appendChild(c);
    }

    // 3초 후 효과 제거
    setTimeout(() => {
        confettiContainer.innerHTML = '';
    }, 3000);
}

/**
 * 정답 공개 화면을 표시하는 함수
 */
function showAnswer() {
    if (!currentAnswerUrl) {
        alert("정답 이미지를 찾을 수 없습니다. problems.json에 answer_url을 확인해 주세요.");
        return;
    }

    answerImage.src = currentAnswerUrl;
    answerRevealOverlay.style.display = 'flex';
    
    // 팡파레 효과 실행!
    launchConfetti();
    
    // 다른 클라이언트에게 정답 공개 상태 동기화
    sendWebSocketData({
        type: 'answer_revealed',
        answerUrl: currentAnswerUrl,
    });
}


/**
 * 메인 화면 UI 이벤트 설정
 */
function setupMainUiEvents() {
    // 공통수학 1 (BASIC STAGE)에 해당하는 주제 목록
    const basicSubjects = ['polynomial', 'equation', 'permutation', 'matrix']; 

    // 주제 버튼 클릭 이벤트
    document.querySelectorAll('.subject-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.subject-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            currentSubject = e.target.getAttribute('data-subject');
            
            // 난이도 버튼 가시성 제어 로직
            if (hardDifficultyBtn) {
                if (basicSubjects.includes(currentSubject)) {
                    // BASIC STAGE는 '상 (BOSS)' 난이도를 숨김
                    hardDifficultyBtn.style.display = 'none';
                } else {
                    // ADVANCED STAGE (나머지)는 '상 (BOSS)' 난이도를 표시
                    hardDifficultyBtn.style.display = 'inline-block';
                }
            }
            
            // 난이도 선택 화면 표시
            difficultySelection.style.display = 'block';
        });
    });

    // 난이도 버튼 클릭 이벤트
    document.querySelectorAll('.difficulty-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            currentDifficulty = e.target.getAttribute('data-difficulty');
            
            if (currentSubject && currentDifficulty) {
                loadNewQuiz(currentSubject, currentDifficulty);
            }
        });
    });

    // 메인으로 돌아가기 버튼
    backToMainBtn.addEventListener('click', showMainScreen);
}

/**
 * 정답 공개 관련 이벤트 리스너 설정
 */
function setupAnswerEvents() {
    // 1. '정답 확인하기' 버튼 클릭 시
    revealAnswerBtn.addEventListener('click', () => {
        // 교사(호스트) 클라이언트에서만 showAnswer를 호출하여 동기화 시작
        showAnswer();
    });

    // 2. '닫기' 버튼 클릭 시 오버레이 닫기
    closeAnswerBtn.addEventListener('click', () => {
        answerRevealOverlay.style.display = 'none';
        confettiContainer.innerHTML = ''; // 효과 정리
        
        // 다른 클라이언트에게 오버레이 닫기 상태 동기화
        sendWebSocketData({ type: 'answer_closed' });
    });
}


// =========================================================
// 5. WebSocket 동기화 로직
// =========================================================

function setupWebSocket() {
    // 로컬 환경에서는 ws://localhost:8080 사용
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
        console.log('✅ WebSocket 연결 성공');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'draw':
                // 다른 클라이언트의 드로잉을 받아 로컬 캔버스에 그립니다.
                performDrawing(data.playerId, data.from.x, data.from.y, data.to.x, data.to.y, data.color, data.mode);
                break;
            case 'clear':
                // 다른 클라이언트의 캔버스 지우기를 동기화합니다.
                drawingState[data.playerId].ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                break;
            // 퀴즈 시작 및 새 문제 로드를 동일하게 처리
            case 'quiz_start': 
            case 'new_quiz_problem': 
                // 교사 클라이언트가 시작한 퀴즈를 동기화합니다.
                syncQuizScreen(data.problemData, data.subject, data.difficulty);
                break;
            case 'timer_finished':
                // 타이머 종료 상태를 동기화합니다.
                if (timerInterval) clearInterval(timerInterval);
                timerDisplayTop.textContent = "⏱️ 시간 종료! (00:00)";
                timerDisplayTop.classList.remove('critical-time');
                revealAnswerBtn.style.display = 'inline-block';
                break;
            case 'answer_revealed':
                // 정답 공개 상태를 동기화합니다.
                currentAnswerUrl = data.answerUrl; // 정답 URL 동기화 (혹시 모를 상황 대비)
                answerImage.src = currentAnswerUrl;
                answerRevealOverlay.style.display = 'flex';
                launchConfetti(); // 효과 실행
                break;
            case 'answer_closed':
                // 정답 오버레이 닫기 상태를 동기화합니다.
                answerRevealOverlay.style.display = 'none';
                confettiContainer.innerHTML = '';
                break;
            default:
                console.warn('알 수 없는 WebSocket 메시지 타입:', data.type);
        }
    };

    ws.onclose = () => {
        console.log('❌ WebSocket 연결 종료');
        // 재연결 로직 (선택 사항)
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket 오류 발생:', error);
    };
}

/**
 * WebSocket을 통해 서버로 데이터를 전송
 */
function sendWebSocketData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    } else {
        console.warn('WebSocket이 연결되지 않아 데이터를 전송할 수 없습니다.', data);
    }
}


// =========================================================
// 6. 초기화
// =========================================================

window.onload = async () => {
    // 캔버스 드로잉 리스너 설정
    setupCanvasListeners('p1');
    setupCanvasListeners('p2');
    
    // 도구 버튼 리스너 설정
    setupToolEvents(); 
    
    // 메인 UI 버튼 리스너 설정 (주제/난이도/메인으로 돌아가기)
    setupMainUiEvents();
    
    // 정답 이벤트 설정 (정답 확인, 닫기 버튼)
    setupAnswerEvents(); 
    
    // WebSocket 연결 시작
    setupWebSocket(); 
};
