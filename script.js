// script.js

// Selección de elementos del DOM
const zonaDeChat = document.getElementById('zona-de-chat');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Variables para control de estado
let isWaiting = false;
const TIMEOUT_MS = 15000; // Tiempo límite de espera: 15 segundos
const COOLDOWN_MS = 2000; // Temporizador entre envíos: 2 segundos

// Inicialización de eventos al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  chatForm.addEventListener('submit', manejarEnvioMensaje);
  
  // Enviar mensaje al presionar 'Enter' (sin presionar Shift)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});

/**
 * Maneja la lógica principal de envío de mensajes y respuesta asíncrona.
 */
async function manejarEnvioMensaje(e) {
  e.preventDefault();

  const mensajeTexto = userInput.value.trim();
  if (!mensajeTexto || isWaiting) return;

  // 1. Agregar mensaje del usuario en la zona de chat
  agregarMensajeAlChat('usuario', mensajeTexto, '👤');
  userInput.value = '';

  // 2. Bloquear controles para evitar envíos múltiples
  bloquearControles(true);

  // 3. Crear mensaje de "cargando"
  const idCargando = agregarMensajeAlChat('sistema', 'El agente está consultando...', '⏳');

  // Configurar AbortController para cancelar peticiones largas
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 4. Petición fetch asíncrona
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: mensajeTexto }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    removerMensaje(idCargando);

    if (!response.ok) {
      throw new Error(`Error en el servidor (${response.status})`);
    }

    const data = await response.json();
    const respuestaAgente = data.respuesta || "He recibido tu consulta. En breve procesaremos los trámites solicitados.";

    // 5. Mostrar respuesta exitosa
    agregarMensajeAlChat('agente', respuestaAgente, '🩺');

  } catch (error) {
    clearTimeout(timeoutId);
    removerMensaje(idCargando);

    let mensajeError = "Ocurrió un error al procesar tu consulta. Intentalo de nuevo.";
    if (error.name === 'AbortError') {
      mensajeError = "La consulta tardó demasiado tiempo en responder. Intentá nuevamente.";
    }

    // 6. Mostrar mensaje de error visual
    agregarMensajeAlChat('error', mensajeError, '⚠️');
  } finally {
    // 7. Desbloqueo progresivo (cooldown entre envíos)
    setTimeout(() => {
      bloquearControles(false);
    }, COOLDOWN_MS);
  }
}

/**
 * Agrega una nueva burbuja de mensaje a la zona de chat.
 */
function agregarMensajeAlChat(tipo, texto, icono) {
  const mensajeDiv = document.createElement('div');
  const mensajeId = 'msg-' + Date.now();
  mensajeDiv.id = mensajeId;
  mensajeDiv.classList.add('mensaje', tipo);

  mensajeDiv.innerHTML = `
    <div class="avatar">${icono}</div>
    <div class="burbuja">${escaparHTML(texto)}</div>
  `;

  zonaDeChat.appendChild(mensajeDiv);
  hacerScrollAlFinal();
  return mensajeId;
}

/**
 * Elimina un mensaje específico del DOM (utilizado para quitar el loader).
 */
function removerMensaje(id) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.remove();
  }
}

/**
 * Deshabilita/Habilita el botón e input durante el estado de espera.
 */
function bloquearControles(bloquear) {
  isWaiting = bloquear;
  sendButton.disabled = bloquear;
  userInput.disabled = bloquear;

  if (!bloquear) {
    userInput.focus();
  }
}

/**
 * Desplaza la vista del chat automáticamente hacia el último mensaje.
 */
function hacerScrollAlFinal() {
  zonaDeChat.scrollTop = zonaDeChat.scrollHeight;
}

/**
 * Previene la inyección de código mediante el escape de caracteres especiales.
 */
function escaparHTML(texto) {
  const div = document.createElement('div');
  div.innerText = texto;
  return div.innerHTML.replace(/\n/g, '<br>');
}
