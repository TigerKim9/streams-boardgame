// 스트림스 보드게임 로직

class StreamsGame {
    constructor() {
        this.tiles = [];
        this.worksheet = new Array(20).fill(null);
        this.currentTile = null;
        this.tilesDrawn = 0;
        this.isWaitingForPlacement = false;

        this.init();
    }

    init() {
        this.createTileBag();
        this.setupUI();
        this.updateDisplay();
    }

    createTileBag() {
        // 0-99 숫자 타일 생성 (각 숫자가 여러 개 있다고 가정)
        this.tiles = [];

        // 0-99 숫자를 각각 2개씩
        for (let i = 0; i <= 99; i++) {
            this.tiles.push(i);
            this.tiles.push(i);
        }

        // 조커(별) 타일 5개 추가
        for (let i = 0; i < 5; i++) {
            this.tiles.push('⭐');
        }

        // 타일 섞기
        this.shuffleTiles();
    }

    shuffleTiles() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
    }

    setupUI() {
        const worksheet = document.getElementById('worksheet');
        worksheet.innerHTML = '';

        // 20개의 칸 생성
        for (let i = 0; i < 20; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.innerHTML = `<span class="cell-index">${i + 1}</span>`;

            cell.addEventListener('click', () => this.placeNumber(i));
            worksheet.appendChild(cell);
        }

        // 버튼 이벤트
        document.getElementById('drawTileBtn').addEventListener('click', () => this.drawTile());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
    }

    drawTile() {
        if (this.isWaitingForPlacement) {
            alert('먼저 현재 타일을 배치해주세요!');
            return;
        }

        if (this.tilesDrawn >= 20) {
            alert('게임이 종료되었습니다!');
            return;
        }

        if (this.tiles.length === 0) {
            alert('타일이 모두 소진되었습니다!');
            return;
        }

        // 타일 뽑기
        const tile = this.tiles.pop();
        this.currentTile = tile;
        this.isWaitingForPlacement = true;

        // 현재 타일 표시
        document.getElementById('currentTile').textContent = tile === '⭐' ? '⭐' : tile;
        document.getElementById('drawTileBtn').disabled = true;
    }

    calculateJokerValue(index) {
        // 조커를 배치할 위치의 왼쪽과 오른쪽 숫자를 고려하여 최적의 값을 계산
        let leftValue = null;
        let rightValue = null;

        // 왼쪽에서 가장 가까운 숫자 찾기
        for (let i = index - 1; i >= 0; i--) {
            if (this.worksheet[i] !== null) {
                leftValue = this.worksheet[i].value;
                break;
            }
        }

        // 오른쪽에서 가장 가까운 숫자 찾기
        for (let i = index + 1; i < 20; i++) {
            if (this.worksheet[i] !== null) {
                rightValue = this.worksheet[i].value;
                break;
            }
        }

        // 최적의 조커 값 계산
        if (leftValue !== null && rightValue !== null) {
            // 양쪽에 숫자가 있는 경우: 중간값
            return Math.floor((leftValue + rightValue) / 2);
        } else if (leftValue !== null) {
            // 왼쪽에만 숫자가 있는 경우: 왼쪽 값보다 큰 값
            return Math.min(leftValue + 10, 99);
        } else if (rightValue !== null) {
            // 오른쪽에만 숫자가 있는 경우: 오른쪽 값보다 작은 값
            return Math.max(rightValue - 10, 0);
        } else {
            // 아무것도 없는 경우: 중간값
            return 50;
        }
    }

    placeNumber(index) {
        if (!this.isWaitingForPlacement) {
            alert('먼저 타일을 뽑아주세요!');
            return;
        }

        if (this.worksheet[index] !== null) {
            alert('이미 숫자가 배치된 칸입니다!');
            return;
        }

        // 숫자 배치
        const isJoker = this.currentTile === '⭐';
        const value = isJoker ? this.calculateJokerValue(index) : this.currentTile;

        this.worksheet[index] = {
            value: value,
            isJoker: isJoker
        };

        // UI 업데이트
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        cell.textContent = isJoker ? `⭐${value}` : value;
        cell.classList.add('filled', 'highlight');

        if (isJoker) {
            cell.classList.add('joker');
        }

        setTimeout(() => cell.classList.remove('highlight'), 500);

        // 상태 업데이트
        this.tilesDrawn++;
        this.currentTile = null;
        this.isWaitingForPlacement = false;

        document.getElementById('drawTileBtn').disabled = false;

        this.updateDisplay();
        this.analyzeStreams();

        // 게임 종료 체크
        if (this.tilesDrawn >= 20) {
            setTimeout(() => this.endGame(), 1000);
        }
    }

    analyzeStreams() {
        const streamDisplay = document.getElementById('streamDisplay');
        const streams = [];
        let currentStream = [];

        // 스트림 분석
        for (let i = 0; i < 20; i++) {
            const cell = this.worksheet[i];

            if (cell === null) {
                continue;
            }

            if (currentStream.length === 0) {
                currentStream.push(cell.value);
            } else {
                const lastValue = currentStream[currentStream.length - 1];

                // 오름차순 체크 (같은 값도 허용)
                if (cell.value >= lastValue) {
                    currentStream.push(cell.value);
                } else {
                    // 스트림 끊김
                    streams.push([...currentStream]);
                    currentStream = [cell.value];

                    // UI에 스트림 끊김 표시
                    const prevCell = document.querySelector(`.cell[data-index="${i - 1}"]`);
                    if (prevCell) {
                        prevCell.classList.add('stream-break');
                    }
                }
            }
        }

        if (currentStream.length > 0) {
            streams.push(currentStream);
        }

        // 스트림 표시
        if (streams.length > 0) {
            streamDisplay.innerHTML = '<h4>현재 스트림:</h4>';
            streams.forEach((stream, idx) => {
                const score = this.calculateStreamScore(stream.length);
                const streamDiv = document.createElement('div');
                streamDiv.className = 'stream';
                streamDiv.textContent = `스트림 ${idx + 1}: [${stream.join(', ')}] - ${stream.length}칸 (${score}점)`;
                streamDisplay.appendChild(streamDiv);
            });
        }

        return streams;
    }

    calculateStreamScore(length) {
        // 점수 = n × (n + 1) / 2
        return (length * (length + 1)) / 2;
    }

    calculateTotalScore() {
        const streams = this.analyzeStreams();
        let totalScore = 0;

        streams.forEach(stream => {
            totalScore += this.calculateStreamScore(stream.length);
        });

        return totalScore;
    }

    updateDisplay() {
        document.getElementById('remainingTiles').textContent = 20 - this.tilesDrawn;

        const score = this.calculateTotalScore();
        document.getElementById('currentScore').textContent = score;
    }

    endGame() {
        const finalScore = this.calculateTotalScore();
        const streams = this.analyzeStreams();

        // 게임 오버 모달 표시
        const modal = document.getElementById('gameOverModal');
        const finalScoreDiv = document.getElementById('finalScore');
        const breakdownDiv = document.getElementById('streamBreakdown');

        finalScoreDiv.textContent = `${finalScore}점`;

        // 스트림 분석 표시
        let breakdownHTML = '<h4>스트림 분석:</h4>';
        streams.forEach((stream, idx) => {
            const score = this.calculateStreamScore(stream.length);
            breakdownHTML += `
                <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                    <strong>스트림 ${idx + 1}:</strong> ${stream.length}칸
                    <br>
                    [${stream.join(', ')}]
                    <br>
                    <strong>점수: ${score}점</strong>
                </div>
            `;
        });

        breakdownDiv.innerHTML = breakdownHTML;
        modal.classList.add('show');

        // 버튼 비활성화
        document.getElementById('drawTileBtn').disabled = true;
    }

    resetGame() {
        // 모달 닫기
        document.getElementById('gameOverModal').classList.remove('show');

        // 상태 초기화
        this.worksheet = new Array(20).fill(null);
        this.currentTile = null;
        this.tilesDrawn = 0;
        this.isWaitingForPlacement = false;

        // 타일 다시 생성
        this.createTileBag();

        // UI 초기화
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, idx) => {
            cell.className = 'cell';
            cell.innerHTML = `<span class="cell-index">${idx + 1}</span>`;
        });

        document.getElementById('currentTile').textContent = '-';
        document.getElementById('streamDisplay').innerHTML = '';
        document.getElementById('drawTileBtn').disabled = false;

        this.updateDisplay();
    }
}

// 게임 시작
let game;

window.addEventListener('DOMContentLoaded', () => {
    game = new StreamsGame();
});
