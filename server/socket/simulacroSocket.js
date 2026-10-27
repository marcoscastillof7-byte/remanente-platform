/**
 * WebSocket handler para el Módulo de Simulacro (Olimpiadas Bíblicas 2026)
 * Proporciona buzzer de latencia ultra baja (0ms lock), sincronización de cronómetros
 * y penalizaciones disciplinarias en tiempo real.
 */

const activeSimulacroRooms = new Map();

export function setupSimulacroSocket(io) {
    if (!io) return;

    io.on('connection', (socket) => {
        let currentRoom = null;

        // Unirse a una sala de simulacro
        socket.on('simulacro:join', ({ roomId, role, teamId }) => {
            currentRoom = roomId || 'default_simulacro';
            socket.join(`simulacro:${currentRoom}`);

            if (!activeSimulacroRooms.has(currentRoom)) {
                activeSimulacroRooms.set(currentRoom, {
                    buzzerLocked: false,
                    buzzerWinner: null,
                    buzzerTimestamp: null,
                    timer: null,
                    cards: new Map() // teamId -> count
                });
            }

            const roomState = activeSimulacroRooms.get(currentRoom);
            socket.emit('simulacro:init-state', {
                buzzerLocked: roomState.buzzerLocked,
                buzzerWinner: roomState.buzzerWinner
            });
        });

        // Evento de Pulsador / Buzzer (David vs Goliat)
        // Bloqueo estricto del primer milisegundo: el primer paquete en llegar gana
        socket.on('simulacro:buzz', ({ roomId, teamId, memberName, questionIndex }) => {
            const rId = roomId || currentRoom || 'default_simulacro';
            let roomState = activeSimulacroRooms.get(rId);
            if (!roomState) {
                roomState = { buzzerLocked: false, buzzerWinner: null, cards: new Map() };
                activeSimulacroRooms.set(rId, roomState);
            }

            // Si ya está bloqueado por otro jugador, ignorar
            if (roomState.buzzerLocked) return;

            roomState.buzzerLocked = true;
            roomState.buzzerWinner = {
                teamId,
                memberName: memberName || 'Participante',
                timestamp: Date.now(),
                questionIndex
            };

            // Notificar a todos inmediatamente (0 ms)
            io.to(`simulacro:${rId}`).emit('simulacro:buzzer-locked', roomState.buzzerWinner);
        });

        // Resetear pulsador para la siguiente pregunta
        socket.on('simulacro:reset-buzzer', ({ roomId }) => {
            const rId = roomId || currentRoom || 'default_simulacro';
            const roomState = activeSimulacroRooms.get(rId);
            if (roomState) {
                roomState.buzzerLocked = false;
                roomState.buzzerWinner = null;
            }
            io.to(`simulacro:${rId}`).emit('simulacro:buzzer-reset');
        });

        // Aplicar tarjeta disciplinaria (Jueces / Moderador)
        socket.on('simulacro:issue-card', ({ roomId, teamId, cardType, reason }) => {
            const rId = roomId || currentRoom || 'default_simulacro';
            io.to(`simulacro:${rId}`).emit('simulacro:card-issued', {
                teamId,
                cardType, // 'yellow' | 'red'
                reason: reason || 'Infracción al reglamento disciplinario',
                timestamp: Date.now()
            });
        });

        // Sincronizar actualización de puntos / penalizaciones
        socket.on('simulacro:update-score', ({ roomId, teamId, scoreDelta, reason }) => {
            const rId = roomId || currentRoom || 'default_simulacro';
            io.to(`simulacro:${rId}`).emit('simulacro:score-updated', {
                teamId,
                scoreDelta,
                reason,
                timestamp: Date.now()
            });
        });

        // Sincronizar fase o avance del torneo
        socket.on('simulacro:advance-phase', ({ roomId, phase, state }) => {
            const rId = roomId || currentRoom || 'default_simulacro';
            io.to(`simulacro:${rId}`).emit('simulacro:phase-changed', {
                phase,
                state,
                timestamp: Date.now()
            });
        });

        socket.on('disconnect', () => {
            // Limpieza básica si es necesario
        });
    });
}
