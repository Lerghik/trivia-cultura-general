/**
 * ====================================================================
 * CONFIGURACIÓN INICIAL Y VARIABLES GLOBALES
 * ====================================================================
 */

// Dirección web de tu proyecto en Supabase (servidor)
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; 

// Clave pública de acceso para que la web pueda comunicarse de forma segura con la base de datos
const SUPABASE_ANON_KEY = "sb_publishable_rKZ87GIXN8TtKlOsdeYN2g__gocmwd0"; // <--- RECUERDEN PEGAR ACÁ SU KEY REAL DE SUPABASE

// Inicializamos el cliente oficial de Supabase guardándolo en la variable 'miSupabase'
const miSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de estado global (guardan la información en la memoria de la página mientras se juega)
let bancoPreguntas = [];      // Array vacío donde descargaremos las preguntas de Supabase
let juego = {                 // Objeto para controlar el estado de la partida actual
    nick: "",                 // Nombre del jugador actual
    preguntaActual: 0,        // Índice de la pregunta por la que va (0 = primera pregunta)
    puntaje: 0                // Puntos acumulados (10 pts por respuesta correcta)
};
let listaRankingsGlobal = []; // Guarda la lista completa de puntajes bajada de internet
let yaTerminoElJuego = false; // Candado lógico (booleano) para evitar que jueguen dos veces seguidas

/**
 * ====================================================================
 * EVENTO PRINCIPAL: AL CARGAR LA PÁGINA (window.onload)
 * ====================================================================
 */
window.onload = async function() {
    
    // 1. CAPTURA DE ELEMENTOS DEL HTML (DOM)
    // Guardamos las secciones (pantallas) para poder ocultarlas o mostrarlas según el momento
    const pInicio = document.getElementById('pantalla-inicio');
    const pJuego = document.getElementById('pantalla-juego');
    const pRanking = document.getElementById('pantalla-ranking');
    const sTablaGlobal = document.getElementById('seccion-tabla-global'); // Sección de la tabla de posiciones
    
    // Guardamos los botones y campos de texto interactivos
    const btnComenzar = document.getElementById('btn-comenzar');
    const btnVerRankingInicio = document.getElementById('btn-ver-ranking-inicio');
    const inputNick = document.getElementById('input-nick');
    const logoTitulo = document.getElementById('logo-titulo'); // El título "Mentes Despiertas" de la cabecera

    // 2. CONEXIÓN A SUPABASE Y DESCARGA DE PREGUNTAS
    console.log("Intentando conectar a Supabase para traer preguntas...");

    // Hacemos una petición asíncrona (await) para consultar todo ('*') de la tabla 'preguntas'
    const { data: preguntasObtenidas, error: errorPreguntas } = await miSupabase
        .from('preguntas')
        .select('*');

    // Si todo salió bien y obtuvimos datos, los procesamos
    if (!errorPreguntas && preguntasObtenidas) {
        // Mapeamos (transformamos) el formato que viene de Postgres al formato que JavaScript entiende mejor
        bancoPreguntas = preguntasObtenidas.map(p => {
            let listaOpciones = p.opciones;
            
            // Si las opciones vienen en formato texto plano de base de datos "{opc1,opc2}", las limpiamos y convertimos en Array
            if (typeof p.opciones === 'string') {
                listaOpciones = p.opciones.replace(/{|}/g, '').split(',');
            }
            
            // Retornamos el objeto estructurado con nombres cortos de propiedades
            return { 
                q: p.pregunta,          // 'q' de Question (Pregunta)
                o: listaOpciones,       // 'o' de Options (Opciones disponibles)
                a: parseInt(p.correcta) // 'a' de Answer (Índice de la respuesta correcta: 0, 1, 2...)
            };
        });
        console.log("Preguntas cargadas con éxito desde la BD.");
    } else {
        console.error("Error crítico al conectar o descargar preguntas:", errorPreguntas);
    }

    /**
     * ====================================================================
     * CONTROLADORES DE EVENTOS (CLICS DE BOTONES)
     * ====================================================================
     */

    // Evento: Clic en el título principal "Mentes Despiertas" (Funciona como botón Home)
    logoTitulo.onclick = function() {
        pJuego.classList.add('oculto');      // Oculta pantalla de juego
        pRanking.classList.add('oculto');    // Oculta pantalla de resultados
        sTablaGlobal.classList.add('oculto'); // Oculta la tabla de posiciones
        pInicio.classList.remove('oculto');  // Muestra la pantalla de inicio limpia
    };

    // Evento: Clic en "Ver Posiciones" desde la pantalla de inicio
    btnVerRankingInicio.onclick = async function() {
        await actualizarDatosRanking();       // Llama a la función que va a Supabase a traer los puntajes frescos
        sTablaGlobal.classList.remove('oculto'); // Muestra la sección de la tabla abajo del todo
    };

    // Evento: Clic en el botón "Comenzar Desafío"
    btnComenzar.onclick = function() {
        // Validación 1: Si el candado está activo, frena al usuario y no lo deja avanzar
        if (yaTerminoElJuego) {
            alert("Ya completaste el desafío con éxito en esta sesión. ¡Gracias por participar!");
            return;
        }

        // Validación 2: Se asegura de que el usuario no haya dejado el recuadro del nombre vacío
        const nickInput = inputNick.value.trim(); // .trim() elimina espacios vacíos extras al principio y final
        if (nickInput === "") {
            alert("Por favor, ingresá un Nickname.");
            return;
        }
        
        // Guardamos el apodo válido en nuestro objeto global de juego
        juego.nick = nickInput;
        
        // Ponemos el nombre del usuario en la esquina superior de la cabecera (si existe el elemento)
        const userBadge = document.getElementById('usuario-activo');
        if (userBadge) userBadge.innerText = "👤 " + juego.nick;
        
        // Cambiamos de pantalla usando clases CSS
        pInicio.classList.add('oculto');
        sTablaGlobal.classList.add('oculto'); // Ocultamos la tabla de posiciones por si estaba abierta
        pJuego.classList.remove('oculto');   // Mostramos la interfaz de las preguntas
        
        cargarPregunta(); // Arrancamos la primera pregunta
    };

    /**
     * ====================================================================
     * FUNCIONES INTERNAS DE LA LOGICA DEL JUEGO
     * ====================================================================
     */

    // Función encargada de pintar la pregunta actual en la pantalla
    function cargarPregunta() {
        // Si el índice llegó al límite de preguntas que tenemos, significa que el juego terminó
        if(juego.preguntaActual >= bancoPreguntas.length) {
            finalizarJuego();
            return;
        }

        // Actualizamos el texto de la barra de progreso (Ej: "Pregunta 3 de 10")
        document.getElementById('texto-progreso').innerText = `Pregunta ${juego.preguntaActual + 1} de ${bancoPreguntas.length}`;
        
        // Calculamos el porcentaje matemático y estiramos la barra visualmente modificando su CSS width
        document.getElementById('llenado-progreso').style.width = `${(juego.preguntaActual / bancoPreguntas.length) * 100}%`;

        // Obtenemos los datos de la pregunta actual desde el banco de memoria
        const infoPregunta = bancoPreguntas[juego.preguntaActual];
        
        // Escribimos la pregunta en el HTML
        document.getElementById('texto-pregunta').innerText = infoPregunta.q;
        
        // Limpiamos los botones de opciones viejas que hayan quedado en el contenedor
        const contenedor = document.getElementById('contenedor-opciones');
        contenedor.innerHTML = "";

        // Recorremos el Array de opciones para crear dinámicamente un botón por cada una
        infoPregunta.o.forEach((opcion, index) => {
            const btn = document.createElement('button'); // Creamos la etiqueta <button> en memoria
            btn.className = "btn-opcion";                 // Le aplicamos los estilos CSS
            btn.innerText = opcion.replace(/"/g, '').trim(); // Limpiamos comillas raras del texto
            
            // Le asignamos un evento: cuando hagan clic en este botón, procesamos su respuesta pasando su índice
            btn.onclick = () => procesarRespuesta(index);
            
            contenedor.appendChild(btn); // Metemos el botón adentro del contenedor visible en la página
        });
    }

    // Función que evalúa si el usuario acertó o erró
    function procesarRespuesta(indiceSeleccionado) {
        // Comparamos el índice del botón apretado contra el índice guardado como correcto ('a')
        if(indiceSeleccionado === bancoPreguntas[juego.preguntaActual].a) {
            juego.puntaje += 10; // Si coincide, sumamos 10 puntos al acumulador
        }
        
        juego.preguntaActual++; // Pasamos al número de pregunta siguiente
        cargarPregunta();       // Volvemos a llamar a cargarPregunta para mostrar la nueva pregunta o terminar
    }

    // Función que se ejecuta cuando se responden todas las preguntas
    async function finalizarJuego() {
        yaTerminoElJuego = true; // Activamos el candado (en principio asumimos que la partida se guardará bien)
        
        pJuego.classList.add('oculto');      // Ocultamos las preguntas
        pRanking.classList.remove('oculto');  // Mostramos el cartel de fin de juego
        
        // Imprimimos el puntaje final obtenido en pantalla
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} puntos.`;

        // Intentamos enviar el nuevo récord a la tabla 'ranking' de Supabase
        const { error: errorInsert } = await miSupabase
            .from('ranking')
            .insert([{ nick: juego.nick, puntaje: juego.puntaje }]);

        // CONTROL DE ERRORES: Validamos si Supabase rechazó la inserción
        if (errorInsert) {
            console.error("Error al guardar en la base de datos:", errorInsert);
            
            // El código de error '23505' es el estándar de SQL para "Violación de Unicidad" (Nick duplicado)
            if (errorInsert.code === '23505') {
                alert(`⚠️ El nick "${juego.nick}" ya está registrado por otro jugador. Tu puntaje NO se guardó. Podés volver a intentar cambiando tu Nickname.`);
                
                yaTerminoElJuego = false; // APAGAMOS EL CANDADO para darle una segunda oportunidad de jugar
                inputNick.value = "";     // Vaciamos el recuadro para que escriba un nombre nuevo
                const userBadge = document.getElementById('usuario-activo');
                if (userBadge) userBadge.innerText = ""; // Limpiamos el nombre de la cabecera
            } else {
                alert("Hubo un problema al guardar tu puntaje en el servidor.");
            }
        }

        // Descargamos el ranking actualizado y mostramos la tabla global al final de la pantalla
        await actualizarDatosRanking();
        sTablaGlobal.classList.remove('oculto');
    }

    // Función encargada de descargar los puntajes de Supabase y configurar los botones de las pestañas
    async function actualizarDatosRanking() {
        // Pedimos todos los registros de 'ranking' ordenados de mayor a menor puntaje
        const { data: rankingsDelDia, error: errorRanking } = await miSupabase
            .from('ranking')
            .select('*')
            .order('puntaje', { ascending: false });

        if (errorRanking) return; // Si hay error de red, cortamos la función para que no rompa la página

        // Guardamos los datos de internet en nuestro Array global de rankings
        listaRankingsGlobal = rankingsDelDia;

        // Capturamos los dos botones de pestañas del HTML
        const btnTop3 = document.getElementById('btn-tab-top3');
        const btnGeneral = document.getElementById('btn-tab-general');

        if (btnTop3 && btnGeneral) {
            // Configuración Pestaña: TOP 3
            btnTop3.onclick = function() {
                btnTop3.style.backgroundColor = "#1A237E";    // Pintamos azul el botón activo
                btnGeneral.style.backgroundColor = "#757575"; // Pintamos gris el botón inactivo
                dibujarTabla(listaRankingsGlobal.slice(0, 3)); // .slice(0,3) corta el array y se queda solo con los primeros 3 puestos
            };

            // Configuración Pestaña: GENERAL (Ver todos)
            btnGeneral.onclick = function() {
                btnTop3.style.backgroundColor = "#757575";    // Pintamos gris el botón inactivo
                btnGeneral.style.backgroundColor = "#1A237E"; // Pintamos azul el botón activo
                dibujarTabla(listaRankingsGlobal);            // Mandamos la lista completa sin recortar
            };

            // Forzamos un clic automático en el Top 3 para que sea lo primero que se vea al cargar
            btnTop3.click();
        }
    }

    // Función que se encarga de transformar los objetos del Array en filas legibles de una tabla HTML
    function dibujarTabla(datosAFiltrar) {
        const tablaCuerpo = document.getElementById('tabla-cuerpo');
        if (!tablaCuerpo) return;
        
        tablaCuerpo.innerHTML = ""; // Vaciamos cualquier fila vieja que tuviera la tabla

        // Recorremos los datos filtrados (sean 3 registros o todos)
        datosAFiltrar.forEach((player) => {
            const fila = document.createElement('tr'); // Creamos una fila <tr>
            
            // Calculamos su puesto matemático real buscando su ID adentro de la lista global original
            let posicionReal = listaRankingsGlobal.findIndex(p => p.id === player.id) + 1;

            // Si la fila que estamos