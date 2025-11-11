// 스트림스 보드게임 로직 - 멀티플레이어 지원

class StreamsGame {
    constructor() {
        this.numPlayers = 0;
        this.players = [];
        this.tiles = [];
        this.currentTile = null;
        this.tilesDrawn = 0;
        this.currentPlayerIndex = 0;
        this.isWaitingForPlacement = false;
        this.gameStarted = false;

        this.init();
    }

    init() {
        this.setupInitialUI();
    }

    setupInitialUI() {
        // 플레이어 선택 버튼 이벤트
        document.querySelectorAll('.player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const numPlayers = parseInt(e.target.dataset.players);
                this.startGame(numPlayers);
            });
        });

        // 게임 버튼 이벤트
        document.getElementById('drawTileBtn').addEventListener('click', () => this.drawTile());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
    }

    startGame(numPlayers) {
        this.numPlayers = numPlayers;
        this.gameStarted = true;

        // 플레이어 초기화
        this.players = [];
        const playerNames = ['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4'];
        const playerColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b'];

        for (let i = 0; i < numPlayers; i++) {
            this.players.push({
                id: i,
                name: playerNames[i],
                color: playerColors[i],
                worksheet: new Array(20).fill(null),
                tilesPlaced: 0,
                score: 0
            });
        }

        // 타일 생성
        this.createTileBag();

        // UI 설정
        document.getElementById('setupModal').classList.remove('show');
        this.setupPlayersUI();
        this.updateDisplay();

        // 멀티플레이어인 경우 턴 표시
        if (numPlayers > 1) {
            document.getElementById('currentTurnCard').style.display = 'block';
        }
    }

    createTileBag() {
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

    setupPlayersUI() {
        const container = document.getElementById('playersContainer');
        container.innerHTML = '';

        this.players.forEach(player => {
            const playerBoard = document.createElement('div');
            playerBoard.className = 'player-board';
            playerBoard.id = `player-${player.id}`;

            const header = document.createElement('div');
            header.className = 'player-header';
            header.innerHTML = `
                <div>
                    <span class="player-name" style="color: ${player.color}">${player.name}</span>
                    <span class="player-status" id="status-${player.id}"></span>
                </div>
                <div class="player-score" id="score-${player.id}">0점</div>
            `;

            const worksheet = document.createElement('div');
            worksheet.className = 'worksheet';
            worksheet.id = `worksheet-${player.id}`;

            // 20개의 칸 생성
            for (let i = 0; i < 20; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.playerId = player.id;
                cell.dataset.index = i;
                cell.innerHTML = `<span class="cell-index">${i + 1}</span>`;
                cell.addEventListener('click', () => this.placeNumber(player.id, i));
                worksheet.appendChild(cell);
            }

            const streamDisplay = document.createElement('div');
            streamDisplay.className = 'stream-display';
            streamDisplay.id = `stream-${player.id}`;

            playerBoard.appendChild(header);
            playerBoard.appendChild(worksheet);
            playerBoard.appendChild(streamDisplay);
            container.appendChild(playerBoard);
        });

        // 첫 번째 플레이어 활성화
        if (this.numPlayers > 1) {
            this.setActivePlayer(0);
        }
    }

    setActivePlayer(index) {
        // 모든 플레이어 보드 비활성화
        document.querySelectorAll('.player-board').forEach(board => {
            board.classList.remove('active');
        });

        // 현재 플레이어 활성화
        const activeBoard = document.getElementById(`player-${index}`);
        if (activeBoard) {
            activeBoard.classList.add('active');
        }

        this.currentPlayerIndex = index;
        this.updateTurnDisplay();
    }

    updateTurnDisplay() {
        const turnDisplay = document.getElementById('currentTurn');
        if (this.numPlayers > 1) {
            turnDisplay.textContent = this.players[this.currentPlayerIndex].name;
        }
    }

    drawTile() {
        if (!this.gameStarted) {
            alert('먼저 플레이어 수를 선택해주세요!');
            return;
        }

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

        // 첫 번째 플레이어로 설정
        if (this.numPlayers > 1) {
            this.setActivePlayer(0);
        }
    }

    placeNumber(playerId, index) {
        if (!this.isWaitingForPlacement) {
            alert('먼저 타일을 뽑아주세요!');
            return;
        }

        // 멀티플레이어에서 현재 플레이어만 배치 가능
        if (this.numPlayers > 1 && playerId !== this.currentPlayerIndex) {
            alert(`${this.players[this.currentPlayerIndex].name}의 차례입니다!`);
            return;
        }

        const player = this.players[playerId];

        if (player.worksheet[index] !== null) {
            alert('이미 숫자가 배치된 칸입니다!');
            return;
        }

        // 숫자 배치
        const isJoker = this.currentTile === '⭐';
        const value = isJoker ? '⭐' : this.currentTile;

        player.worksheet[index] = {
            value: value,
            isJoker: isJoker
        };

        player.tilesPlaced++;

        // UI 업데이트
        const cell = document.querySelector(`.cell[data-player-id="${playerId}"][data-index="${index}"]`);
        cell.textContent = value;
        cell.classList.add('filled', 'highlight');

        if (isJoker) {
            cell.classList.add('joker');
        }

        setTimeout(() => cell.classList.remove('highlight'), 500);

        // 플레이어 점수 및 스트림 분석
        this.analyzeStreams(playerId);
        this.updatePlayerScore(playerId);

        // 다음 플레이어로 넘어가기
        if (this.numPlayers > 1) {
            const nextPlayerIndex = (this.currentPlayerIndex + 1) % this.numPlayers;

            // 모든 플레이어가 배치했는지 확인
            if (nextPlayerIndex === 0) {
                // 라운드 완료
                this.tilesDrawn++;
                this.currentTile = null;
                this.isWaitingForPlacement = false;
                document.getElementById('drawTileBtn').disabled = false;

                // 플레이어 상태 업데이트
                this.players.forEach(p => {
                    const statusEl = document.getElementById(`status-${p.id}`);
                    statusEl.textContent = `✓ 배치 완료`;
                    statusEl.style.color = '#28a745';
                });

                // 상태 초기화 (1초 후)
                setTimeout(() => {
                    this.players.forEach(p => {
                        const statusEl = document.getElementById(`status-${p.id}`);
                        statusEl.textContent = '';
                    });
                }, 1000);

                this.updateDisplay();

                // 게임 종료 체크
                if (this.tilesDrawn >= 20) {
                    setTimeout(() => this.endGame(), 1000);
                }
            } else {
                // 다음 플레이어로
                this.setActivePlayer(nextPlayerIndex);
                const statusEl = document.getElementById(`status-${playerId}`);
                statusEl.textContent = `✓ 배치 완료`;
                statusEl.style.color = '#28a745';
            }
        } else {
            // 싱글 플레이어
            this.tilesDrawn++;
            this.currentTile = null;
            this.isWaitingForPlacement = false;
            document.getElementById('drawTileBtn').disabled = false;
            this.updateDisplay();

            // 게임 종료 체크
            if (this.tilesDrawn >= 20) {
                setTimeout(() => this.endGame(), 1000);
            }
        }
    }

    analyzeStreams(playerId) {
        const player = this.players[playerId];
        const streamDisplay = document.getElementById(`stream-${playerId}`);
        const streams = [];
        let currentStream = [];

        // 스트림 끊김 표시 초기화
        document.querySelectorAll(`.cell[data-player-id="${playerId}"].stream-break`).forEach(cell => {
            cell.classList.remove('stream-break');
        });

        // 스트림 분석
        for (let i = 0; i < 20; i++) {
            const cell = player.worksheet[i];

            if (cell === null) {
                continue;
            }

            if (currentStream.length === 0) {
                currentStream.push(cell.value);
            } else {
                // 이전 값 찾기 (조커가 아닌 마지막 값)
                let lastValue = null;
                for (let j = currentStream.length - 1; j >= 0; j--) {
                    if (currentStream[j] !== '⭐') {
                        lastValue = currentStream[j];
                        break;
                    }
                }

                // 조커는 항상 오름차순을 유지
                if (cell.value === '⭐') {
                    currentStream.push(cell.value);
                } else if (lastValue === null) {
                    // 이전이 모두 조커인 경우
                    currentStream.push(cell.value);
                } else if (cell.value >= lastValue) {
                    // 오름차순 체크 (같은 값도 허용)
                    currentStream.push(cell.value);
                } else {
                    // 스트림 끊김
                    streams.push([...currentStream]);
                    currentStream = [cell.value];

                    // UI에 스트림 끊김 표시
                    const prevCell = document.querySelector(`.cell[data-player-id="${playerId}"][data-index="${i - 1}"]`);
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
            streamDisplay.innerHTML = '<h4 style="font-size: 0.9em; color: #667eea; margin-bottom: 10px;">현재 스트림:</h4>';
            streams.forEach((stream, idx) => {
                const score = this.calculateStreamScore(stream.length);
                const streamDiv = document.createElement('div');
                streamDiv.className = 'stream';
                streamDiv.style.fontSize = '0.85em';
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

    calculateTotalScore(playerId) {
        const streams = this.analyzeStreams(playerId);
        let totalScore = 0;

        streams.forEach(stream => {
            totalScore += this.calculateStreamScore(stream.length);
        });

        return totalScore;
    }

    updatePlayerScore(playerId) {
        const score = this.calculateTotalScore(playerId);
        this.players[playerId].score = score;
        document.getElementById(`score-${playerId}`).textContent = `${score}점`;
    }

    updateDisplay() {
        document.getElementById('remainingTiles').textContent = 20 - this.tilesDrawn;
    }

    endGame() {
        // 모든 플레이어 점수 계산
        this.players.forEach(player => {
            player.score = this.calculateTotalScore(player.id);
        });

        // 승자 찾기
        const maxScore = Math.max(...this.players.map(p => p.score));
        const winners = this.players.filter(p => p.score === maxScore);

        // 게임 오버 모달 표시
        const modal = document.getElementById('gameOverModal');
        const finalScoreDiv = document.getElementById('finalScore');
        const breakdownDiv = document.getElementById('streamBreakdown');

        if (this.numPlayers === 1) {
            finalScoreDiv.textContent = `${this.players[0].score}점`;
        } else {
            finalScoreDiv.textContent = winners.length > 1 ? '무승부!' : `${winners[0].name} 승리!`;
        }

        // 전체 결과 표시
        let breakdownHTML = '<h4>최종 결과:</h4>';

        // 점수 순으로 정렬
        const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);

        sortedPlayers.forEach((player, rank) => {
            const streams = this.analyzeStreams(player.id);
            const isWinner = player.score === maxScore;

            breakdownHTML += `
                <div style="margin: 15px 0; padding: 15px; background: ${isWinner ? '#fff3cd' : 'white'}; border-radius: 10px; border: 2px solid ${isWinner ? '#ffc107' : '#ddd'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 1.2em; color: ${player.color}">${rank + 1}. ${player.name}</strong>
                        ${isWinner ? '<span style="background: #ffd700; padding: 3px 10px; border-radius: 15px; font-size: 0.9em;">🏆 승자</span>' : ''}
                    </div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #764ba2; margin-bottom: 10px;">
                        총 점수: ${player.score}점
                    </div>
                    <div style="font-size: 0.9em;">
                        ${streams.map((stream, idx) => {
                            const score = this.calculateStreamScore(stream.length);
                            return `스트림 ${idx + 1}: ${stream.length}칸 (${score}점)`;
                        }).join(' | ')}
                    </div>
                </div>
            `;
        });

        breakdownDiv.innerHTML = breakdownHTML;
        modal.classList.add('show');

        // 버튼 비활성화
        document.getElementById('drawTileBtn').disabled = true;

        // 플레이어 보드 비활성화
        document.querySelectorAll('.player-board').forEach(board => {
            board.classList.remove('active');
            board.classList.add('completed');
        });

        // 승자 표시
        if (this.numPlayers > 1) {
            winners.forEach(winner => {
                const winnerBoard = document.getElementById(`player-${winner.id}`);
                const winnerName = winnerBoard.querySelector('.player-name');
                winnerName.innerHTML += ' <span class="winner-badge">🏆 승자</span>';
            });
        }
    }

    resetGame() {
        // 모달 닫기
        document.getElementById('gameOverModal').classList.remove('show');
        document.getElementById('setupModal').classList.add('show');

        // 상태 초기화
        this.numPlayers = 0;
        this.players = [];
        this.currentTile = null;
        this.tilesDrawn = 0;
        this.currentPlayerIndex = 0;
        this.isWaitingForPlacement = false;
        this.gameStarted = false;

        // UI 초기화
        document.getElementById('playersContainer').innerHTML = '';
        document.getElementById('currentTile').textContent = '-';
        document.getElementById('remainingTiles').textContent = '20';
        document.getElementById('currentTurnCard').style.display = 'none';
        document.getElementById('drawTileBtn').disabled = false;
    }
}

// 게임 시작
let game;

window.addEventListener('DOMContentLoaded', () => {
    game = new StreamsGame();
});
