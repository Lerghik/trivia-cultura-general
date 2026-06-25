/**
 * ====================================================================
 * CONFIGURACIÓN INICIAL Y VARIABLES GLOBALES
 * ====================================================================
 */

// Dirección web del servidor de tu proyecto en la plataforma Supabase
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; 

// Clave pública obligatoria para que el navegador se comunique de forma segura con la base de datos
const SUPABASE_ANON_KEY = "sb_publishable_rKZ87GIXN8TtKlOsdeYN2g__gocmwd0"; // <--- TU KEY PÚBLICA ANÓNIMA REAL

// Inicializa el cliente oficial de Supabase conectando la URL externa con la clave de acceso
const miSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de almacenamiento en memoria que controlarán el flujo dinámico de la partida
let bancoPreguntas = [];      // Lista ordenada (Array) donde se guardarán las preguntas bajadas de internet
let juego = {                 // Objeto central para registrar el progreso del usuario activo
    nick: "",                 // Guardará el apodo escrito por el jugador
    preguntaActual: 0,        // Índice numérico del vector de preguntas (0 es la primera pregunta)
    puntaje: 0                // Sumador de puntos acumulados (10 unidades por acierto)
};
let listaRankingsGlobal = []; // Array que contendrá todo el historial de puntajes de la base de datos
let yaTerminoElJuego = false; // Candado lógico para bloquear intentos extras de volver a registrar puntos

/**
 * ====================================================================
 * EVENTO DE INICIALIZACIÓN: AL CARGAR LA PÁGINA (window.onload)
 * ====================================================================
 */
window.onload = async function() {
    
    // 1. CAPTURA Y ASIGNACIÓN DE ELEMENTOS DE LA INTERFAZ (DOM)
    // Se seleccionan las distintas "pantallas" del juego para modular la visualización
    const pInicio = document.getElementById('pantalla-inicio');
    const pJuego = document.getElementById('pantalla-juego');
    const pRanking = document.getElementById('pantalla-ranking');
    const sTablaGlobal = document.getElementById('seccion-tabla-global');
    
    // Se seleccionan los elementos del formulario inicial y el logo de la cabecera
    const btnComenzar = document.getElementById('btn-comenzar');
    const btnVerRankingInicio = document.getElementById('btn-ver-ranking-inicio');
    const inputNick = document.getElementById('input-nick');
    const logoTitulo = document.getElementById('logo-titulo');

    // 2. CONEXIÓN ASÍNCRONA A SUPABASE PARA DESCARGAR EL CUESTIONARIO
    // Se efectúa una consulta selectiva para bajar todas las columnas (*) de tu tabla 'preguntas'
    const { data: preguntasObtenidas, error: errorPreguntas } = await miSupabase
        .from('preguntas')
        .select('*');

    // Validación: Si no hubo fallos en la red y la base de datos devolvió registros
    if (!errorPreguntas && preguntasObtenidas) {
        // Se formatea el array original convirtiendo los datos al estándar requerido por tu lógica
        bancoPreguntas = preguntasObtenidas.map(p => {
            let listaOpciones = p.opciones;
            
            // Corrección técnica: Si las opciones vienen empaquetadas como texto plano Postgres "{a,b,c}"
            if (typeof p.opciones === 'string') {
                // Se limpian las llaves con una expresión regular y se separa el texto por cada coma
                listaOpciones = p.opciones.replace(/{|}/g, '').split(',');
            }
            // Retorna el objeto unificado con propiedades cortas independientes (q: pregunta, o: opciones, a: respuesta correcta)
            return { q: p.pregunta, o: listaOpciones, a: parseInt(p.correcta) };
        });
    }

    /**
     * ====================================================================
     * CONTROLADORES DE EVENTOS (OYENTES O CLICK LISTENERS)
     * ====================================================================
     */

    // Evento: Al presionar el logo principal actúa como un botón "Home" reseteando la visual
    logoTitulo.onclick = function() {
        pJuego.classList.add('oculto');      // Oculta la pantalla de juego en curso
        pRanking.classList.add('oculto');    // Oculta la pantalla del puntaje final
        sTablaGlobal.classList.add('oculto'); // Oculta el módulo del ranking global
        pInicio.classList.remove('oculto');  // Trae de vuelta el panel de bienvenida
    };

    // Evento: Al hacer click en "Ver posiciones" desde el panel principal
    btnVerRankingInicio.onclick = async function() {
        await actualizarDatosRanking();       // Llama a la función asíncrona para consultar el servidor de base de datos
        sTablaGlobal.classList.remove('oculto'); // Vuelve visible el cuadro de la tabla al pie de la página
    };

    // Evento: Al presionar el botón azul para iniciar el desafío
    btnComenzar.onclick = function() {
        // Control de bloqueo: Si el candado de fin de juego está activo, frena al usuario
        if (yaTerminoElJuego) {
            alert("Ya completaste el desafío con éxito en esta sesión. ¡Gracias por participar!");
            return; // Detiene la ejecución de la función de manera inmediata
        }

        // Validación del campo de texto: .trim() quita espacios vacíos accidentales al inicio/fin
        const nickInput = inputNick.value.trim();
        if (nickInput === "") {
            alert("Por favor, ingresá un Nickname.");
            return; // Aborta la función si no hay un texto válido
        }
        
        // Almacena el apodo verificado en la estructura del juego
        juego.nick = nickInput;
        
        // Busca la etiqueta superior de la cabecera para pintar la identidad del jugador activo
        const userBadge = document.getElementById('usuario-activo');
        if (userBadge) userBadge.innerText = "👤 " + juego.nick;
        
        // Transición de pantallas agregando y quitando clases CSS de visibilidad (.oculto)
        pInicio.classList.add('oculto');
        sTablaGlobal.classList.add('oculto'); 
        pJuego.classList.remove('oculto');
        
        // Llama al proceso que dibuja la primera tanda de preguntas en la pantalla
        cargarPregunta();
    };

    /**
     * ====================================================================
     * FUNCIONES COMPARTIDAS DE LA TRIVIA
     * ====================================================================
     */

    // Encargada de renderizar la pregunta actual y confeccionar los botones interactivos
    function cargarPregunta() {
        // Control de fin de carrera: Si el contador superó o igualó al total del banco de preguntas
        if(juego.preguntaActual >= bancoPreguntas.length) {
            finalizarJuego(); // Deriva el flujo al cierre de sesión
            return;
        }

        // Modifica el texto informativo superior (Ej: "Pregunta 4 de 10")
        document.getElementById('texto-progreso').innerText = `Pregunta ${juego.preguntaActual + 1} de ${bancoPreguntas.length}`;
        
        // Estira el relleno azul de la barra aplicando el porcentaje matemático a su propiedad CSS width
        document.getElementById('llenado-progreso').style.width = `${(juego.preguntaActual / bancoPreguntas.length) * 100}%`;

        // Extrae el objeto específico de la pregunta correspondiente al índice actual
        const infoPregunta = bancoPreguntas[juego.preguntaActual];
        
        // Inyecta el enunciado en el nodo H3 del HTML
        document.getElementById('texto-pregunta').innerText = infoPregunta.q;
        
        // Vacía por completo el contenedor de opciones para eliminar los botones de la pregunta anterior
        const contenedor = document.getElementById('contenedor-opciones');
        contenedor.innerHTML = "";

        // Itera (recorre) el sub-array de opciones para crear los cuatro botones de respuestas en tiempo real
        infoPregunta.o.forEach((opcion, index) => {
            const btn = document.createElement('button'); // Instancia un nodo <button> en la memoria del navegador
            btn.className = "btn-opcion";                 // Le inyecta la clase estilizada de tu CSS
            btn.innerText = opcion.replace(/"/g, '').trim(); // Elimina comillas redundantes y recorta textos limpios
            
            // Le asigna un evento inline: al presionarse ejecutará la validación pasándole su posición (0, 1, 2...)
            btn.onclick = () => procesarRespuesta(index);
            
            contenedor.appendChild(btn); // Inserta físicamente el botón dentro del contenedor visible de la grilla
        });
    }

    // Encargada de auditar si la opción elegida por el jugador es la acertada
    function procesarRespuesta(indiceSeleccionado) {
        // Evalúa si el número del botón cliqueado es idéntico al índice guardado como correcto (.a)
        if(indiceSeleccionado === bancoPreguntas[juego.preguntaActual].a) {
            juego.puntaje += 10; // Incrementa el acumulador de puntos en 10 unidades
        }
        juego.preguntaActual++; // Avanza el contador de posición de preguntas para la siguiente iteración
        cargarPregunta();       // Recarga la interfaz de usuario con el nuevo estado
    }

    // Encargada de procesar el cierre del juego y resguardar el récord en la nube de Supabase
    async function finalizarJuego() {
        yaTerminoElJuego = true; // Cierra temporalmente el acceso lógico por precaución
        
        pJuego.classList.add('oculto');         // Oculta la grilla de juego activa
        pRanking.classList.remove('oculto');     // Presenta el panel con el cartel de finalización
        
        // Escribe las felicitaciones junto al total de puntos acumulados
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} puntos.`;

        // Ejecuta una petición asíncrona de inserción (.insert) para cargar un registro en tu tabla de Base de Datos 'ranking'
        const { error: errorInsert } = await miSupabase
            .from('ranking')
            .insert([{ nick: juego.nick, puntaje: juego.puntaje }]);

        // Auditoría de fallos: Analiza si la base de datos rebotó los datos del jugador
        if (errorInsert) {
            console.error("Error al guardar en ranking:", errorInsert);
            
            // Regla de unicidad integrada: Si el servidor devuelve código '23505' (Violación de restricción única)
            if (errorInsert.code === '23505') {
                // Informa al jugador del conflicto mediante un modal nativo
                alert(`⚠️ El nick "${juego.nick}" ya está registrado por otro jugador. Tu puntaje NO se guardó. Podés volver a intentar cambiando tu Nickname.`);
                
                yaTerminoElJuego = false; // Devuelve la habilitación para reiniciar el juego legítimamente
                inputNick.value = "";     // Vacta el casillero de escritura para facilitarle el cambio de nombre
                const userBadge = document.getElementById('usuario-activo');
                if (userBadge) userBadge.innerText = ""; // Borra la identidad del badge del header superior
            } else {
                // Alerta estándar ante cortes de internet u otras caídas del servicio
                alert("Hubo un problema al guardar tu puntaje en el servidor.");
            }
        }

        // Descarga los puntajes actualizados incluyendo el último récord (si es que se guardó correctamente)
        await actualizarDatosRanking();
        sTablaGlobal.classList.remove('oculto'); // Muestra los resultados en el cuadro global inferior
    }

    // Encargada de solicitar el historial de marcas al servidor y enlazar los filtros
    async function actualizarDatosRanking() {
        // Petición asíncrona que solicita todos los registros (*) ordenando de forma descendente (Mayor a menor)
        const { data: rankingsDelDia, error: errorRanking } = await miSupabase
            .from('ranking')
            .select('*')
            .order('puntaje', { ascending: false });

        if (errorRanking) return; // Rompe la función si no hay internet para evitar errores de ejecución en cascada

        listaRankingsGlobal = rankingsDelDia; // Enlaza los datos recibidos a la memoria global local

        // Captura los botones de selección que actúan como pestañas
        const btnTop3 = document.getElementById('btn-tab-top3');
        const btnGeneral = document.getElementById('btn-tab-general');

        // Configuración de interactividad de las pestañas internas si se encuentran presentes en el HTML
        if (btnTop3 && btnGeneral) {
            // Acción: Al presionar "Top 3"
            btnTop3.onclick = function() {
                btnTop3.style.backgroundColor = "#1A237E";    // Aplica color azul al elemento seleccionado
                btnGeneral.style.backgroundColor = "#757575"; // Pinta de gris inactivo el botón adyacente
                dibujarTabla(listaRankingsGlobal.slice(0, 3)); // Recorta los primeros tres puestos del vector
            };

            // Acción: Al presionar la pestaña "General"
            btnGeneral.onclick = function() {
                btnTop3.style.backgroundColor = "#757575";    // Pinta de gris el botón inactivo
                btnGeneral.style.backgroundColor = "#1A237E"; // Pinta de azul la pestaña de control activa
                dibujarTabla(listaRankingsGlobal);            // Pasa el listado completo sin ningún tipo de recorte
            };

            // Ejecuta un click simulado automático inicial para arrancar mostrando el Top 3 por defecto
            btnTop3.click();
        }
    }

    // Encargada de renderizar las filas tr y td correspondientes a los registros de la clasificación
    function dibujarTabla(datosAFiltrar) {
        const tablaCuerpo = document.getElementById('tabla-cuerpo');
        if (!tablaCuerpo) return; // Frena la ejecución si la tabla no está estructurada en el HTML
        
        tablaCuerpo.innerHTML = ""; // Despeja las filas antiguas inyectadas previamente

        // Recorre los elementos filtrados para armar sus respectivas celdas
        datosAFiltrar.forEach((player) => {
            const fila = document.createElement('tr'); // Crea dinámicamente un contenedor de fila
            
            // Calcula matemáticamente la posición real comparando el ID contra el vector completo guardado
            let posicionReal = listaRankingsGlobal.findIndex(p => p.id === player.id) + 1;

            // Condición estética: Si los datos de esta fila corresponden a la puntuación actual de este jugador
            if(player.nick === juego.nick && player.puntaje === juego.puntaje) {
                fila.className = "mi-puesto"; // Le agrega una clase CSS diferenciada (Fondo verde de resalte)
            }
            
            // Clasificación de los primeros puestos asignándoles emojis en vez del número liso
            let medalla = posicionReal;
            if(posicionReal === 1) medalla = "🥇";
            if(posicionReal === 2) medalla = "🥈";
            if(posicionReal === 3) medalla = "🥉";

            // Estructura el formato interno de texto inyectando las propiedades en cada td
            fila.innerHTML = `<td>${medalla}</td><td>${player.nick}</td><td>${player.puntaje} pts</td>`;
            tablaCuerpo.appendChild(fila); // Indexa la fila lista al cuerpo general de la tabla visible
        });
    }

    // Evento: Control de reinicio del botón inferior de la pantalla final de la partida
    document.getElementById('btn-reiniciar').onclick = function() {
        // Resetea los parámetros internos a cero absoluto para habilitar una partida limpia en el futuro
        juego.preguntaActual = 0;
        juego.puntaje = 0;
        
        // Efectúa el cambio visual de los paneles ocultando los rankings y devolviendo la vista de Inicio
        pRanking.classList.add('oculto');
        sTablaGlobal.classList.add('oculto');
        pInicio.classList.remove('oculto');
    };
}; // Cierre formal de la inicialización window.onload. ¡Todo cerrado perfectamente!