// Estado del juego centralizado en un solo objeto
const gameState = {
    playerHP: 200,
    enemyHP: 200,
    maxHP: 200,

    questionsByDifficulty: { easy: [], medium: [], hard: [] },
    usedQuestionIds: new Set(),

    isPlayerTurn: true,
    isActionInProgress: false,

    moves: {
        attackEasy: { name: 'Ataque Básico', level: 1, damage: 15, uses: 15, maxUses: 15 },
        attackMedium: { name: 'Ataque Fuerte', level: 2, damage: 25, uses: 10, maxUses: 10 },
        attackHard: { name: 'Ataque Épico', level: 3, damage: 40, uses: 5, maxUses: 5 },
        heal: { name: 'Curación', heal: 30, uses: 5, maxUses: 5 }
    },

    bossHealTimer: 300,
    bossHealMaxTime: 300,
    bossHealPercentage: 15,
    timerInterval: null,

    studentName: "",
    startTime: null,
    webAppUrl: "https://script.google.com/macros/s/AKfycbxIVHCQhqSnZz_NpjCq0X0HaQ9UZgPvDzaiPoDF6mQacd8cOrO7i01JCe5yMybprVe-gQ/exec",
    movesUsed: { easy: 0, medium: 0, hard: 0, heal: 0 }
};

// Referencias directas a gameState
// Objetos y arrays son seguros como alias (se comparten por referencia).
// Primitivos (HP, flags, timer) se leen y escriben siempre via gameState.X
const maxHP               = gameState.maxHP;
const questionsByDifficulty = gameState.questionsByDifficulty;
const usedQuestionIds     = gameState.usedQuestionIds;
const moves               = gameState.moves;
const movesUsed           = gameState.movesUsed;

// Elementos del DOM
const messageBox = document.getElementById('message-box');
const playerHPBar = document.getElementById('player-hp');
const enemyHPBar = document.getElementById('enemy-hp');
const playerHPText = document.getElementById('player-hp-text');
const enemyHPText = document.getElementById('enemy-hp-text');
const actionButtons = document.querySelectorAll('.action-btn');
const healBtn = document.getElementById('heal-btn');
const questionModal = document.getElementById('question-modal');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

// Cargar preguntas desde JSON
async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        const questions = await response.json();
        // Clasificar por dificultad
        questions.forEach(q => {
            if (q.difficulty === 'easy') questionsByDifficulty.easy.push(q);
            else if (q.difficulty === 'medium') questionsByDifficulty.medium.push(q);
            else if (q.difficulty === 'hard') questionsByDifficulty.hard.push(q);
        });
        // Verificar que haya preguntas de cada dificultad
        console.log('Preguntas cargadas:', questionsByDifficulty);
    } catch (error) {
        console.error('Error cargando preguntas:', error);
        messageBox.innerHTML += '<p>Error al cargar preguntas. Recarga la página.</p>';
    }
}

// Mostrar mensaje con efecto máquina de escribir
async function addMessageWithTyping(text) {
    return new Promise((resolve) => {
        
        // Limpiar si hay demasiados mensajes (mantener máximo 4)
        const lines = messageBox.querySelectorAll('.message-line');
        if (lines.length >= 4) {
            // Eliminar el mensaje más antiguo
            lines[0].remove();
        }
        
        // Crear contenedor para el nuevo mensaje
        const messageLine = document.createElement('div');
        messageLine.className = 'message-line';
        messageBox.appendChild(messageLine);
        
        // Añadir cursor parpadeante
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        
        let i = 0;
        function typeNextChar() {
            if (i < text.length) {
                // Añadir siguiente carácter
                messageLine.textContent = text.substring(0, i + 1);
                messageLine.appendChild(cursor);
                i++;
                setTimeout(typeNextChar, 30); // Velocidad de tipeo
            } else {
                // Terminó de escribir, quitar cursor
                cursor.remove();
                // Hacer scroll al fondo
                messageBox.scrollTop = messageBox.scrollHeight;
                resolve();
            }
        }
        
        typeNextChar();
    });
}

// Versión rápida sin efecto (para mensajes que no necesitan animación)
function addMessageFast(text) {
    
    // Limpiar si hay demasiados mensajes
    const lines = messageBox.querySelectorAll('.message-line');
    if (lines.length >= 4) {
        lines[0].remove();
    }
    
    const messageLine = document.createElement('div');
    messageLine.className = 'message-line';
    messageLine.textContent = text;
    messageBox.appendChild(messageLine);
    messageBox.scrollTop = messageBox.scrollHeight;
}

// Limpiar todos los mensajes (útil para comenzar nuevo combate)
function clearMessages() {
    const messageBox = document.getElementById('message-box');
    messageBox.innerHTML = '';
}

function disablePlayerButtons() {
    document.getElementById('attack-easy').disabled = true;
    document.getElementById('attack-medium').disabled = true;
    document.getElementById('attack-hard').disabled = true;
    document.getElementById('heal-btn').disabled = true;
}

function enablePlayerButtons() {
    // Solo habilitar si es turno del jugador y no hay acción en progreso
    if (gameState.isPlayerTurn && !gameState.isActionInProgress) {
        document.getElementById('attack-easy').disabled = moves.attackEasy.uses <= 0;
        document.getElementById('attack-medium').disabled = moves.attackMedium.uses <= 0;
        document.getElementById('attack-hard').disabled = moves.attackHard.uses <= 0;
        document.getElementById('heal-btn').disabled = moves.heal.uses <= 0;
    }
}

function startBossHealTimer() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    
    gameState.timerInterval = setInterval(() => {
        // Solo funciona si el juego no ha terminado
        if (gameState.playerHP <= 0 || gameState.enemyHP <= 0) return;
        
        gameState.bossHealTimer--;
        updateTimerDisplay();
        
        if (gameState.bossHealTimer <= 0) {
            // El jefe se cura
            gameState.bossHealTimer = gameState.bossHealMaxTime; // reiniciar contador
            const healAmount = Math.floor((maxHP * gameState.bossHealPercentage) / 100);
            const newHP = Math.min(maxHP, gameState.enemyHP + healAmount);
            const actualHeal = newHP - gameState.enemyHP;
            if (actualHeal > 0) {
                gameState.enemyHP = newHP;
                updateHPBars();
                addMessageWithTyping(`⚠️ ¡El enemigo se ha curado ${actualHeal} HP! ⚠️`);
                // Animación de curación en el sprite del enemigo
                const enemySprite = document.querySelector('.enemy-sprite');
                enemySprite.style.filter = 'drop-shadow(0 0 10px #4caf50)';
                setTimeout(() => {
                    enemySprite.style.filter = 'none';
                }, 500);
            }
            // Asegurar que el timer se reinicie visualmente
            updateTimerDisplay();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerBar = document.getElementById('boss-timer-bar');
    const timerText = document.getElementById('boss-timer-text');
    if (timerBar) {
        const percent = (gameState.bossHealTimer / gameState.bossHealMaxTime) * 100;
        timerBar.style.width = `${percent}%`;
        // Cambiar color según el tiempo restante
        if (percent <= 25) {
            timerBar.style.background = '#f44336'; // rojo: peligro
        } else if (percent <= 50) {
            timerBar.style.background = '#ff9800'; // naranja: advertencia
        } else {
            timerBar.style.background = '#4caf50'; // verde: tiempo suficiente
        }
    }
    if (timerText) {
        timerText.textContent = `${gameState.bossHealTimer}s`;
    }
}

// Actualizar barras de HP
function updateHPBars() {
    playerHPBar.style.width = `${(gameState.playerHP / maxHP) * 100}%`;
    enemyHPBar.style.width = `${(gameState.enemyHP / maxHP) * 100}%`;
    playerHPText.textContent = `${gameState.playerHP}/${maxHP}`;
    enemyHPText.textContent = `${gameState.enemyHP}/${maxHP}`;
}

function updateMoveButtons() {
    document.getElementById('attack-easy').textContent = `${moves.attackEasy.name} (${moves.attackEasy.uses}/${moves.attackEasy.maxUses})`;
    document.getElementById('attack-medium').textContent = `${moves.attackMedium.name} (${moves.attackMedium.uses}/${moves.attackMedium.maxUses})`;
    document.getElementById('attack-hard').textContent = `${moves.attackHard.name} (${moves.attackHard.uses}/${moves.attackHard.maxUses})`;
    document.getElementById('heal-btn').textContent = `${moves.heal.name} (${moves.heal.uses}/${moves.heal.maxUses})`;
    
    // Deshabilitar si no hay usos
    document.getElementById('attack-easy').disabled = moves.attackEasy.uses <= 0;
    document.getElementById('attack-medium').disabled = moves.attackMedium.uses <= 0;
    document.getElementById('attack-hard').disabled = moves.attackHard.uses <= 0;
    document.getElementById('heal-btn').disabled = moves.heal.uses <= 0;
}

function disableAllButtons() {
    actionButtons.forEach(btn => btn.disabled = true);
    healBtn.disabled = true;
}

// Obtener una pregunta aleatoria de una dificultad dada (o de cualquier dificultad si no se especifica)
function getRandomQuestion(difficulty = null) {
    let pool;
    if (difficulty) {
        pool = questionsByDifficulty[difficulty];
    } else {
        // Combinar todas las dificultades
        pool = [...questionsByDifficulty.easy, ...questionsByDifficulty.medium, ...questionsByDifficulty.hard];
    }
    // Filtrar las no usadas
    const available = pool.filter(q => !usedQuestionIds.has(q.id));
    if (available.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
}

function askQuestion(question, headerInfo, callback) {
    const headerDiv = document.getElementById('question-header');
    if (headerInfo) {
        let headerText = '';
        if (headerInfo.atacante) {
            headerText += `${headerInfo.atacante} usa ${headerInfo.movimiento}`;
            if (headerInfo.nivel) headerText += ` [NIVEL ${headerInfo.nivel}]`;
            if (headerInfo.daño) headerText += ` • Daño: ${headerInfo.daño}`;
            if (headerInfo.curación) headerText += ` • Cura: ${headerInfo.curación}`;
        }
        headerDiv.textContent = headerText;
        headerDiv.classList.remove('hidden');
    } else {
        headerDiv.classList.add('hidden');
    }

    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';
    question.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
            usedQuestionIds.add(question.id);
            const isCorrect = (index === question.correctIndex);
            questionModal.classList.add('hidden');
            callback(isCorrect);
        });
        optionsContainer.appendChild(btn);
    });
    questionModal.classList.remove('hidden');
}

async function playerAttack(moveKey) {
    // Verificar que sea turno del jugador y no haya otra acción
    if (!gameState.isPlayerTurn || gameState.isActionInProgress) return;
    
    gameState.isActionInProgress = true;
    disablePlayerButtons(); // Deshabilitar mientras se ejecuta la acción
    
    if (gameState.playerHP <= 0 || gameState.enemyHP <= 0) {
        resetAction();
        return;
    }

    const move = moves[moveKey];
    if (!move || move.uses <= 0) {
        await addMessageWithTyping('No quedan usos de ese movimiento.');
        resetAction();
        return;
    }

    move.uses--;
    if (moveKey === 'attackEasy') movesUsed.easy++;
    else if (moveKey === 'attackMedium') movesUsed.medium++;
    else if (moveKey === 'attackHard') movesUsed.hard++;
    updateMoveButtons();

    let difficulty;
    switch (move.level) {
        case 1: difficulty = 'easy'; break;
        case 2: difficulty = 'medium'; break;
        case 3: difficulty = 'hard'; break;
    }

    const question = getRandomQuestion(difficulty);
    if (!question) {
        await addMessageWithTyping(`❌ No quedan preguntas de nivel ${difficulty}!`);
        move.uses++;
        updateMoveButtons();
        resetAction();
        setTimeout(() => enemyTurn(), 1500);
        return;
    }

    // Secuencia de ataque
    await addMessageWithTyping(`⚔️ ¡${move.name}! ⚔️`);
    await waitWithMessage('Preparando pregunta', 1.5);
    await addMessageWithTyping('Responde correctamente para causar daño:');

    const headerInfo = {
        atacante: 'JUGADOR',
        movimiento: move.name,
        nivel: move.level,
        daño: move.damage
    };

    setTimeout(() => {
        askQuestion(question, headerInfo, async (correct) => {
            if (correct) {
                await addMessageWithTyping(`✨ ¡GOLPE CRÍTICO! ${move.damage} de daño.`);
                gameState.enemyHP = Math.max(0, gameState.enemyHP - move.damage);
                updateHPBars();
                
                document.querySelector('.enemy-sprite').style.transform = 'scale(0.8)';
                document.querySelector('.enemy-sprite').style.filter = 'brightness(1.5)';
                setTimeout(() => {
                    document.querySelector('.enemy-sprite').style.transform = 'scale(1)';
                    document.querySelector('.enemy-sprite').style.filter = 'none';
                }, 300);
            } else {
                await addMessageWithTyping('💔 ¡Fallaste! El ataque no hizo efecto.');
            }
            
            if (!checkGameOver()) {
                await waitWithMessage('Turno del enemigo', 1.5);
                startEnemyTurn(); // Inicia el turno del enemigo
            } else {
                resetAction(); // Si el juego terminó, no hacer nada más
            }
        });
    }, 2000);
}

async function playerHeal() {
    if (!gameState.isPlayerTurn || gameState.isActionInProgress) return;
    
    gameState.isActionInProgress = true;
    disablePlayerButtons();
    
    if (gameState.playerHP <= 0 || gameState.enemyHP <= 0) {
        resetAction();
        return;
    }

    const move = moves.heal;
    if (move.uses <= 0) {
        await addMessageWithTyping('No quedan usos de curación.');
        resetAction();
        return;
    }

    if (gameState.playerHP >= maxHP) {
        await addMessageWithTyping('💚 Ya tienes la vida al máximo!');
        resetAction();
        return;
    }

    move.uses--;
    movesUsed.heal++;
    updateMoveButtons();

    const question = getRandomQuestion();
    if (!question) {
        await addMessageWithTyping('❌ No quedan preguntas para curarte!');
        move.uses++;
        updateMoveButtons();
        resetAction();
        setTimeout(() => startEnemyTurn(), 1500);
        return;
    }

    await addMessageWithTyping('💚 ¡INTENTAS CURARTE! 💚');
    await waitWithMessage('Buscando energía', 1.5);
    await addMessageWithTyping('Responde correctamente para recuperar vida:');

    const headerInfo = {
        atacante: 'JUGADOR',
        movimiento: move.name,
        curación: move.heal
    };

    setTimeout(() => {
        askQuestion(question, headerInfo, async (correct) => {
            if (correct) {
                gameState.playerHP = Math.min(maxHP, gameState.playerHP + move.heal);
                await addMessageWithTyping(`✨ ¡Recuperaste ${move.heal} HP!`);
                updateHPBars();
                
                document.querySelector('.player-sprite').style.filter = 'drop-shadow(0 0 15px #4caf50)';
                document.querySelector('.player-sprite').style.transform = 'scale(1.1)';
                setTimeout(() => {
                    document.querySelector('.player-sprite').style.filter = 'drop-shadow(4px 4px 0 #000)';
                    document.querySelector('.player-sprite').style.transform = 'scale(1)';
                }, 500);
            } else {
                await addMessageWithTyping('💔 ¡Fallaste! No recuperaste vida.');
            }
            
            if (!checkGameOver()) {
                await waitWithMessage('Turno del enemigo', 1.5);
                startEnemyTurn();
            } else {
                resetAction();
            }
        });
    }, 2000);
}

function startEnemyTurn() {
    if (checkGameOver()) return;
    gameState.isPlayerTurn = false;
    gameState.isActionInProgress = true; // Bloquear acciones del jugador
    disablePlayerButtons();
    enemyTurn();
}

async function enemyTurn() {
    if (gameState.playerHP <= 0 || gameState.enemyHP <= 0) {
        resetAction();
        return;
    }

    // Animación de ataque
    document.querySelector('.enemy-sprite').style.transform = 'translateX(-10px)';
    setTimeout(() => {
        document.querySelector('.enemy-sprite').style.transform = 'translateX(0)';
    }, 300);

    const level = Math.floor(Math.random() * 3) + 1;
    let difficulty, baseDamage, nombreAtaque;
    switch (level) {
        case 1: difficulty = 'easy'; baseDamage = 15; nombreAtaque = 'DÉBIL'; break;
        case 2: difficulty = 'medium'; baseDamage = 25; nombreAtaque = 'NORMAL'; break;
        case 3: difficulty = 'hard'; baseDamage = 40; nombreAtaque = 'PODEROSO'; break;
    }

    const question = getRandomQuestion(difficulty);
    if (!question) {
        await addMessageWithTyping(`El enemigo busca un ataque ${nombreAtaque} pero no encuentra...`);
        // Turno del jugador después de un fallo
        resetAction();
        enablePlayerTurnAfterDelay();
        return;
    }

    await addMessageWithTyping(`👾 ¡ENEMIGO ataca con poder ${nombreAtaque}! 👾`);
    await waitWithMessage('Prepárate para defender', 1.5);
    await addMessageWithTyping('¡DEFIÉNDETE respondiendo!');

    const headerInfo = {
        atacante: 'ENEMIGO',
        movimiento: `Ataque ${nombreAtaque}`,
        nivel: level,
        daño: baseDamage
    };

    setTimeout(() => {
        askQuestion(question, headerInfo, async (correct) => {
            let damage;
            if (correct) {
                damage = Math.floor(baseDamage * 0.5);
                await addMessageWithTyping(`🛡️ ¡Gran defensa! Recibes solo ${damage} de daño.`);
                document.querySelector('.player-sprite').style.transform = 'scale(1.1)';
                setTimeout(() => {
                    document.querySelector('.player-sprite').style.transform = 'scale(1)';
                }, 200);
            } else {
                damage = baseDamage;
                await addMessageWithTyping(`💥 ¡Golpe directo! Recibes ${damage} de daño.`);
                document.querySelector('.player-sprite').style.filter = 'brightness(1.5)';
                document.querySelector('.player-sprite').style.transform = 'translateX(5px)';
                setTimeout(() => {
                    document.querySelector('.player-sprite').style.filter = 'none';
                    document.querySelector('.player-sprite').style.transform = 'translateX(0)';
                }, 300);
            }

            gameState.playerHP = Math.max(0, gameState.playerHP - damage);
            updateHPBars();

            if (!checkGameOver()) {
                // Turno del jugador después de un breve retraso
                setTimeout(() => {
                    resetAction(); // Limpia el estado de acción
                    gameState.isPlayerTurn = true;
                    enablePlayerButtons();
                    addMessageWithTyping('🎮 Tu turno...');
                }, 1500);
            } else {
                resetAction(); // Juego terminado, no activar turno
            }
        });
    }, 2000);
}

// enablePlayerTurn fue consolidada en enablePlayerButtons() arriba

function resetAction() {
    gameState.isActionInProgress = false;
    // Si es turno del jugador, habilitar botones; si no, dejarlos deshabilitados
    if (gameState.isPlayerTurn && !checkGameOver()) {
        enablePlayerButtons();
    } else if (!gameState.isPlayerTurn && !checkGameOver()) {
        disablePlayerButtons();
    }
}

function enablePlayerTurnAfterDelay() {
    setTimeout(() => {
        gameState.isPlayerTurn = true;
        resetAction(); // Esto habilitará los botones si es turno del jugador
    }, 1000);
}

// ===== NUEVA FUNCIÓN: Pausa con mensaje dinámico =====
async function waitWithMessage(mensaje, segundos = 3) {
    return new Promise((resolve) => {
        let tiempoRestante = segundos;
        
        // Mostrar mensaje de espera
        addMessageFast(`⏳ ${mensaje} ${tiempoRestante}...`);
        
        // Actualizar cada segundo
        const intervalo = setInterval(() => {
            tiempoRestante--;
            if (tiempoRestante > 0) {
                // Actualizar el último mensaje con el tiempo restante
                const lastMessage = messageBox.lastElementChild;
                if (lastMessage) {
                    lastMessage.textContent = `⏳ ${mensaje} ${tiempoRestante}...`;
                }
            }
        }, 1000);
        
        // Resolver después de los segundos
        setTimeout(() => {
            clearInterval(intervalo);
            resolve();
        }, segundos * 1000);
    });
}

function checkGameOver() {
    /*if (gameState.playerHP <= 0) {
        addMessageWithTyping('¡El JUGADOR ha sido derrotado... Fin del examen!');
        disablePlayerButtons();
        gameState.isPlayerTurn = false;
        gameState.isActionInProgress = false;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        sendGameData("derrota", gameState.playerHP, gameState.enemyHP);
        return true;
    }*/
    if (gameState.playerHP <= 0) {
        disablePlayerButtons();
        gameState.isPlayerTurn = false;
        gameState.isActionInProgress = false;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);

        // Animación de apagado de TV
        const playerSprite = document.querySelector('.player-sprite');
        playerSprite.classList.add('dying');

        setTimeout(() => {
            addMessageWithTyping('¡El JUGADOR ha sido derrotado... Fin del examen!');
            sendGameData("derrota", gameState.playerHP, gameState.enemyHP);
        }, 1000); // espera a que termine el apagado

        return true;
    }
    /*if (gameState.enemyHP <= 0) {
        addMessageWithTyping('¡ENEMIGO derrotado! ¡Has aprobado el examen con honores!');
        disablePlayerButtons();
        gameState.isPlayerTurn = false;
        gameState.isActionInProgress = false;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        sendGameData("victoria", gameState.playerHP, gameState.enemyHP);
        return true;
    }*/
    if (gameState.enemyHP <= 0) {
        disablePlayerButtons();
        gameState.isPlayerTurn = false;
        gameState.isActionInProgress = false;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);

        // Animación de muerte antes de mostrar resultado
        const enemySprite = document.querySelector('.enemy-sprite');
        enemySprite.classList.add('dying');

        setTimeout(() => {
            addMessageWithTyping('¡ENEMIGO derrotado! ¡Has aprobado el examen con honores!');
            sendGameData("victoria", gameState.playerHP, gameState.enemyHP);
        }, 1200); // espera a que termine la espiral

        return true;
    }
    return false;
}

function playEnemyDeathAnimation(callback) {
    const sprite = document.querySelector('.enemy-sprite');
    sprite.classList.add('dying');
    setTimeout(callback, 1200); // espera a que termine la animación
}

async function sendGameData(status, finalPlayerHP, finalEnemyHP) {
    if (!gameState.studentName) return;
    const payload = {
        nombre: gameState.studentName,
        inicio: gameState.startTime ? gameState.startTime.toISOString() : "",
        fin: new Date().toISOString(),
        vida_jugador: finalPlayerHP,
        vida_jefe: finalEnemyHP,
        estado: status, // "victoria" o "derrota"
        ataques_usados: `${movesUsed.easy},${movesUsed.medium},${movesUsed.hard}`,
        curas_usadas: movesUsed.heal
    };
    try {
        await fetch(gameState.webAppUrl, {
            method: "POST",
            mode: "no-cors", // necesario para dominios cruzados con Apps Script
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        console.log("Datos enviados correctamente");
    } catch (error) {
        console.error("Error al enviar datos:", error);
    }
}

function initButtons() {
    // Ataque básico
    document.getElementById('attack-easy').addEventListener('click', () => {
        if (gameState.isPlayerTurn && !gameState.isActionInProgress) {
            playerAttack('attackEasy');
        }
    });
    
    // Ataque fuerte
    document.getElementById('attack-medium').addEventListener('click', () => {
        if (gameState.isPlayerTurn && !gameState.isActionInProgress) {
            playerAttack('attackMedium');
        }
    });
    
    // Ataque épico
    document.getElementById('attack-hard').addEventListener('click', () => {
        if (gameState.isPlayerTurn && !gameState.isActionInProgress) {
            playerAttack('attackHard');
        }
    });
    
    // Curarse
    document.getElementById('heal-btn').addEventListener('click', () => {
        if (gameState.isPlayerTurn && !gameState.isActionInProgress) {
            playerHeal();
        }
    });
}

async function initGame() {
    clearMessages();
    await loadQuestions();
    updateMoveButtons();
    updateHPBars();
    gameState.isPlayerTurn = true;
    gameState.isActionInProgress = false;
    
    // Reiniciar temporizador
    gameState.bossHealTimer = gameState.bossHealMaxTime;
    updateTimerDisplay();
    startBossHealTimer();  // <-- NUEVO
    
    await addMessageWithTyping('¡La batalla comienza! Elige una acción.');
    initButtons();
    enablePlayerButtons();
}

// Configurar el modal de registro
document.addEventListener('DOMContentLoaded', () => {
    const registerModal = document.getElementById('register-modal');
    const registerBtn = document.getElementById('register-btn');
    const studentNameInput = document.getElementById('student-name');
    const registerError = document.getElementById('register-error');

    if (!registerBtn) {
        console.error("No se encontró el botón 'register-btn'");
        return;
    }

    registerBtn.addEventListener('click', () => {
        const name = studentNameInput.value.trim();
        if (name === "") {
            registerError.style.display = 'block';
            return;
        }
        gameState.studentName = name;
        gameState.startTime = new Date();
        registerModal.classList.add('hidden'); // oculta el modal
        initGame(); // inicia el juego
    });
});