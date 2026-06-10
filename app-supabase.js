// CONFIGURACIÓN DE TU PROYECTO
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_rKZ87GIXN8TtKlOsdeYN2g__gocmwd0"; // <-- PONÉ ACÁ TU KEY REAL ENTRE COMILLAS

// Inicializamos la conexión usando 'miSupabase' para evitar choques globales
const miSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bancoPreguntas = []; 
let juego = { nick: "", preguntaActual: 0, puntaje: 0 };
let listaRankingsGlobal = []; // Guarda los puntajes para alternar pestañas al instante

window.onload = async function() {
    const pInicio = document.getElementById('pantalla-inicio');
    const pJuego = document.getElementById('pantalla-juego');
    const pRanking = document.getElementById('pantalla-ranking');
    const btnComenzar = document.getElementById('btn-comenzar');
    const inputNick = document.getElementById('input-nick');

    console.log("Intentando conectar a Supabase para traer preguntas...");

    // 1. TRAEMOS LAS PREGUNTAS DESDE SUPABASE
    const { data: preguntasObtenidas, error: errorPreguntas } = await miSupabase
        .from('preguntas')
        .select('*');

    if (errorPreguntas) {
        console.error("Error crítico al traer preguntas de Supabase:", errorPreguntas);
        alert("Error de conexión con la base de datos. Revisá las claves de Supabase.");
        return;
    }

    if (!preguntasObtenidas || preguntasObtenidas.length === 0) {
        console.error("La tabla 'preguntas' está vacía.");
        alert("La base de datos está vacía.");
        return;
    }

    console.log("Preguntas cargadas con éxito:", preguntasObtenidas);

    // Mapeamos el array nativo de Postgres adaptándolo a JavaScript
    bancoPreguntas = preguntasObtenidas.map(p => {
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

    // Acción del botón comenzar juego
    btnComenzar.onclick = function() {
        const nickInput = inputNick.value.trim();
        if (nickInput === "") {
            alert("Por favor, ingresá un Nickname.");
            return;
        }
        juego.nick = nickInput;
        
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

        listaRankingsGlobal = rankingsDelDia;

        // Configuración de controles para las pestañas de la tabla
        const btnTop3 = document.getElementById('btn-tab-top3');
        const btnGeneral = document.getElementById('btn-tab-general');

        if (btnTop3 && btnGeneral) {
            btnTop3.onclick = function() {
                btnTop3.style.backgroundColor = "#1A237E"; 
                btnGeneral.style.backgroundColor = "#757575"; 
                dibujarTabla(listaRankingsGlobal.slice(0, 3)); 
            };

            btnGeneral.onclick = function() {
                btnTop3.style.backgroundColor = "#757575"; 
                btnGeneral.style.backgroundColor = "#1A237E"; 
                dibujarTabla(listaRankingsGlobal); 
            };

            // Activamos la pestaña Top 3 por defecto al entrar
            btnTop3.click();
        } else {
            // Si por alguna razón no encuentra las pestañas, dibuja el ranking completo directo
            dibujarTabla(listaRankingsGlobal);
        }
    }

    function dibujarTabla(datosAFiltrar) {
        const tablaCuerpo = document.getElementById('tabla-cuerpo');
        if (!tablaCuerpo) return;
        
        tablaCuerpo.innerHTML = "";

        datosAFiltrar.forEach((player) => {
            const fila = document.createElement('tr');
            
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

    document.getElementById('btn-reiniciar').onclick = function() {
        juego.preguntaActual = 0;
        juego.puntaje = 0;
        pRanking.classList.add('oculto');
        pInicio.classList.remove('oculto');
        const userBadge = document.getElementById('usuario-activo');
        if (userBadge) userBadge.innerText = "";
        inputNick.value = "";
    };
};
