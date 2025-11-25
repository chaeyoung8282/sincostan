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
 * --- 문제 데이터 ---
 * problem.json 파일을 fetch하는 대신, 404 오류를 피하기 위해 내용을 직접 삽입합니다.
 */
const problemData = {
  "polynomial": {
    "hard": [
      { "id": "p-h-1", "url": "/images/polynomial/hard_1.png" },
      { "id": "p-h-2", "url": "/images/polynomial/hard_2.png" },
      { "id": "p-h-3", "url": "/images/polynomial/hard_3.png" },
      { "id": "p-h-4", "url": "/images/polynomial/hard_4.png" },
      { "id": "p-h-5", "url": "/images/polynomial/hard_5.png" }
    ],
    "medium": [
      { "id": "p-m-1", "url": "/images/polynomial/medium_1.png" },
      { "id": "p-m-2", "url": "/images/polynomial/medium_2.png" },
      { "id": "p-m-3", "url": "/images/polynomial/medium_3.png" },
      { "id": "p-m-4", "url": "/images/polynomial/medium_4.png" },
      { "id": "p-m-5", "url": "/images/polynomial/medium_5.png" }
    ],
    "easy": [
      { "id": "p-e-1", "url": "/images/polynomial/easy_1.png" },
      { "id": "p-e-2", "url": "/images/polynomial/easy_2.png" },
      { "id": "p-e-3", "url": "/images/polynomial/easy_3.png" },
      { "id": "p-e-4", "url": "/images/polynomial/easy_4.png" },
      { "id": "p-e-5", "url": "/images/polynomial/easy_5.png" }
    ],
    "difficulty_map": {
      "easy": "하 (TRAINING)",
      "medium": "중 (CHALLENGE)",
      "hard": "상 (BOSS)"
    }
  },
  "equation": {
    "hard": [], "medium": [], "easy": [],
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "permutation": {
    "hard": [], "medium": [], "easy": [],
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "matrix": {
    "hard": [], "medium": [], "easy": [],
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "geometry": {
    "hard": [], "medium": [], "easy": [],
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "set": {
    "hard": [], "medium": [], "easy": [],
    "difficulty_map": { "easy": "하 (TRAINING)", "medium": "중 (CHALLENGE)", "hard": "상 (BOSS)" }
  },
  "function": {
    "hard": [], "medium": [], "easy": [],
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

/**
 * [중요] 파일 경로 매핑 테이블: 논리적 경로 -> 실제 파일 이름
 * JSON 파일에 정의된 논리적인 경로(키)를 
 * 이 환경에 실제로 업로드된 파일 이름(값)으로 매핑합니다.
 * 이 매핑 테이블이 존재해야만, "/images/..."와 같은 논리적 경로를 사용할 수 있습니다.
 */
const FILE_PATH_MAP = {
    // 다항식 - 하 (EASY)의 첫 번째 문제를 실제 업로드된 파일 이름으로 매핑합니다.
    "/images/polynomial/easy_1.png": "image_926f5c.png", 
    
    // 이후 나머지 119개의 문제도 여기에 추가해야 합니다. 예시:
    // "/images/polynomial/easy_2.png": "실제_업로드된_파일_이름_2.png", 
    // "/images/polynomial/hard_1.png": "실제_업로드된_파일_이름_3.png"
};

/**
 * 논리적 이미지 경로를 실제 로드 가능한 파일 이름으로 변환합니다.
 * @param {string} logicalPath JSON에 정의된 논리적 경로
 * @returns {string} 로드에 사용될 실제 파일 이름
 */
function resolveImagePath(logicalPath) {
    // 맵에 경로가 정의되어 있으면 실제 파일 이름 반환
    if (FILE_PATH_MAP[logicalPath]) {
        return FILE_PATH_MAP[logicalPath];
    }
    // 맵에 없으면 경로 그대로 반환 (이 경우 로딩에 실패할 가능성이 높습니다)
    return logicalPath;
}


// --- 캔버스 드로잉 및 도구 로직은 변경 없음 ---

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
 * 퀴즈 화면을 표시하고 문제를 로드합니다.
 */
async function showQuizScreen() {
    mainScreen.style.display = 'none';
    quizScreen.style.display = 'block';
    
    // === 🚨 (더미) 서버에 문제 요청하는 로직 시뮬레이션 🚨 ===
    // 로컬 데이터를 사용하지만, 로딩 메시지와 딜레이는 유지합니다.
    const subjectName = SUBJECT_NAMES[currentSubject] || '주제';
    const difficultyName = problemData[currentSubject]?.difficulty_map[currentDifficulty] || '난이도';
    const loadingMessage = `${subjectName} / ${difficultyName} 문제를 서버에 요청 중...`;
    
    currentSubjectDifficulty.textContent = loadingMessage;
    problemImage.src = `https://placehold.co/800x250/3498db/ffffff?text=${encodeURIComponent(loadingMessage)}`;
    
    // 서버 응답을 기다리는 것을 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500)); 
    // =======================================================
    
    const subjectData = problemData[currentSubject];
    const problemArray = subjectData ? subjectData[currentDifficulty] : null;

    if (!subjectData || !problemArray || problemArray.length === 0) {
        // 이 메시지가 뜨는 것은 JSON 파일에 해당 주제/난이도 배열이 비어있기 때문입니다.
        currentSubjectDifficulty.textContent = "오류: 해당 주제/난이도의 문제 배열을 찾을 수 없습니다.";
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=JSON+데이터+누락!`;
        return;
    }
    
    // 1. 문제 배열에서 랜덤으로 하나 선택
    const randomIndex = Math.floor(Math.random() * problemArray.length);
    const selectedProblem = problemArray[randomIndex];
    const logicalPath = selectedProblem.url;
    
    // 2. 논리적 경로를 실제 파일 이름으로 변환 (FILE_PATH_MAP 사용)
    const actualImagePath = resolveImagePath(logicalPath); 

    // 현재 문제/난이도 표시 업데이트
    currentSubjectDifficulty.textContent = `${subjectName} / ${difficultyName} (ID: ${selectedProblem.id})`;
    
    // --- 문제 이미지 로딩 로직 ---
    // 3. 이미지 로딩 에러 핸들러 설정
    problemImage.onerror = () => {
        console.error(`Failed to load image: ${actualImagePath}. Falling back to error text.`);
        // 에러 발생 시 폴백 이미지에 실패 경로 표시
        problemImage.src = `https://placehold.co/800x250/dc3545/ffffff?text=로딩+실패!+JSON경로:+${logicalPath}+/ 실제파일명:+${actualImagePath}`;
    };

    // 4. 이미지 소스 설정 (로딩 시작)
    problemImage.src = actualImagePath;
    // --- 문제 이미지 로딩 로직 끝 ---
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


// 앱 초기화: 문제 데이터를 fetch할 필요 없이 바로 UI 이벤트 설정
window.onload = async () => {
    // 문제 데이터가 인라인으로 삽입되었으므로 fetchProblemData 호출 제거
    setupMainUiEvents();
};
