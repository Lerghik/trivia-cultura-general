// CONFIGURACIÓN DE TU PROYECTO
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; // Poné acá tu link con comillas
const SUPABASE_ANON_KEY = "sb_publishable_rKZ87GIXN8TtKlOsdeYN2g__gocmwd0"; // Poné acá tu key con comillas

// CAMBIO AQUÍ: Usamos 'miSupabase' para evitar que choque con el nombre de la librería externa
const miSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bancoPreguntas = []; 
let juego = { nick: "", preguntaActual: 0, puntaje: 0 };

window.onload = async function() {
    const pInicio = document.getElementById('pantalla-inicio');
    const pJuego = document.getElementById('pantalla-juego');
    const pRanking = document.getElementById('pantalla-ranking');
    const btnComenzar = document.getElementById('btn-comenzar');
    const inputNick = document.getElementById('input-nick');

    console.log("Intentando conectar a Supabase para traer preguntas...");

    // CAMBIO AQUÍ: miSupabase en lugar de supabase
    const { data: preguntasObtenidas, error: errorPreguntas } = await miSupabase
        .from('preguntas')
        .select('*');

    if (errorPreguntas) {
        console.error("Error crítico al traer preguntas de Supabase:", errorPreguntas);
        alert("Error de conexión con la base de datos. Revisá las claves de Supabase.");
        return;
    }

    if (!preguntasObtenidas || preguntasObtenidas.length === 0) {
        console.error("La tabla 'preguntas' está vacía en Supabase.");
        alert("La base de datos está vacía. Asegurate de haber corrido el script SQL con éxito.");
        return;
    }

    console.log("Preguntas cargadas con éxito desde la BD:", preguntasObtenidas);

    // Mapeamos los datos asegurándonos de que 'opciones' sea tratado correctamente
    bancoPreguntas = preguntasObtenidas.map(p => {
        // Forzamos a que las opciones sean un array válido, por si viene como texto
        let listaOpciones = p.opciones;
        if (typeof p.opciones === 'string') {
            listaOpciones = p.opciones.replace(/{|}/g, '').split(',');
        }
        
        return {
            q: p.pregunta,
            o: listaOpciones, 
            a: parseInt(p.correcta)
        };
    });

    // Habilitamos el botón de comenzar una vez que las preguntas están listas en memoria
    btnComenzar.onclick = function() {
        const nickInput = inputNick.value.trim();
        if (nickInput === "") {
            alert("Por favor, ingresá un Nickname.");
            return;
        }
        juego.nick = nickInput;
        
        // Corrección de seguridad por si el elemento no existe en el HTML anterior
        const userBadge = document.getElementById('usuario-activo');
        if (userBadge) userBadge.innerText = "👤 " + juego.nick;
        
        pInicio.classList.add('oculto');
        pJuego.classList.remove('oculto');
        cargarPregunta();
    };

    function cargarPregunta() {
        if(juego.preguntaActual >= bancoPreguntas.length) {
            finalizarJuego();
            return;
        }

        document.getElementById('texto-progreso').innerText = `Pregunta ${juego.preguntaActual + 1} de ${bancoPreguntas.length}`;
        document.getElementById('llenado-progreso').style.width = `${(juego.preguntaActual / bancoPreguntas.length) * 100}%`;

        const infoPregunta = bancoPreguntas[juego.preguntaActual];
        document.getElementById('texto-pregunta').innerText = infoPregunta.q;
        
        const contenedor = document.getElementById('contenedor-opciones');
        contenedor.innerHTML = "";

        infoPregunta.o.forEach((opcion, index) => {
            const btn = document.createElement('button');
            btn.className = "btn-opcion";
            // Limpiamos posibles comillas rebeldes que arrastre Postgres
            btn.innerText = opcion.replace(/"/g, '').trim(); 
            btn.onclick = () => procesarRespuesta(index);
            contenedor.appendChild(btn);
        });
    }

    function procesarRespuesta(indiceSeleccionado) {
        if(indiceSeleccionado === bancoPreguntas[juego.preguntaActual].a) {
            juego.puntaje += 10; 
        }
        juego.preguntaActual++;
        cargarPregunta();
    }

    // NUEVA VARIABLE GLOBAL INTERNA (Solo para manejar las pestañas)
    let listaRankingsGlobal = []; 

    async function finalizarJuego() {
        pJuego.classList.add('oculto');
        pRanking.classList.remove('oculto');
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} puntos.`;

        // 2. ENVIAR EL RESULTADO DEL USUARIO A SUPABASE
        const { error: errorInsert } = await miSupabase
            .from('ranking')
            .insert([{ nick: juego.nick, puntaje: juego.puntaje }]);

        if (errorInsert) {
            console.error("Error al guardar puntaje en ranking:", errorInsert);
        }

        // 3. TRAER EL RANKING COMPLETO DESDE SUPABASE
        const { data: rankingsDelDia, error: errorRanking } = await miSupabase
            .from('ranking')
            .select('*')
            .order('puntaje', { ascending: false });

        if (errorRanking) {
            console.error("Error al obtener el ranking:", errorRanking);
            return;
        }

        // Guardamos los datos en nuestra variable para cambiar de pestaña sin volver a consultar a internet
        listaRankingsGlobal = rankingsDelDia;

        // Configuración de los botones de las pestañas
        const btnTop3 = document.getElementById('btn-tab-top3');
        const btnGeneral = document.getElementById('btn-tab-general');

        // Acción al hacer clic en Top 3
        btnTop3.onclick = function() {
            btnTop3.style.backgroundColor = "#1A237E"; // Azul activo
            btnGeneral.style.backgroundColor = "#757575"; // Gris inactivo
            dibujarTabla(listaRankingsGlobal.slice(0, 3)); // Cortamos la lista para mostrar solo los primeros 3
        };

        // Acción al hacer clic en General
        btnGeneral.onclick = function() {
            btnTop3.style.backgroundColor = "#757575"; // Gris inactivo
            btnGeneral.style.backgroundColor = "#1A237E"; // Azul activo
            dibujarTabla(listaRankingsGlobal); // Mostramos la lista completa
        };

        // Por defecto al terminar el juego, mostramos el Top 3 para arrancar con impacto visual
        btnTop3.click();
    }

    // NUEVA FUNCIÓN AUXILIAR: Se encarga de pintar las filas en la pantalla
    function dibujarTabla(datosAFiltrar) {
        const tablaCuerpo = document.getElementById('tabla-cuerpo');
        tablaCuerpo.innerHTML = "";

        datosAFiltrar.forEach((player, index) => {
            const fila = document.createElement('tr');
            
            // Buscamos la posición real del jugador en el ranking general original
            let posicionReal = listaRankingsGlobal.findIndex(p => p.id === player.id) + 1;

            if(player.nick === juego.nick && player.puntaje === juego.puntaje) {
                fila.className = "mi-puesto";
            }
            
            let medalla = posicionReal;
            if(posicionReal === 1) medalla = "🥇";
            if(posicionReal === 2) medalla = "🥈";
            if(posicionReal === 3) medalla = "🥉";

            fila.innerHTML = `<td>${medalla}</td><td>${player.nick}</td><td>${player.puntaje} pts</td>`;
            tablaCuerpo.appendChild(fila);
        });
    }