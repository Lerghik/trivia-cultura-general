// CONFIGURACIÓN DE TU PROYECTO
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; 
const SUPABASE_ANON_KEY = "TU_API_KEY_ANONIMA_LARGA..."; // <--- PONÉ ACÁ TU KEY REAL EN GITHUB

const miSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bancoPreguntas = []; 
let juego = { nick: "", preguntaActual: 0, puntaje: 0 };
let listaRankingsGlobal = []; 
let yaTerminoElJuego = false; // Candado de seguridad para bloquear el juego

window.onload = async function() {
    const pInicio = document.getElementById('pantalla-inicio');
    const pJuego = document.getElementById('pantalla-juego');
    const pRanking = document.getElementById('pantalla-ranking');
    const sTablaGlobal = document.getElementById('seccion-tabla-global');
    
    const btnComenzar = document.getElementById('btn-comenzar');
    const btnVerRankingInicio = document.getElementById('btn-ver-ranking-inicio');
    const inputNick = document.getElementById('input-nick');
    const logoTitulo = document.getElementById('logo-titulo');

    // 1. CARGA INICIAL DE PREGUNTAS
    const { data: preguntasObtenidas, error: errorPreguntas } = await miSupabase
        .from('preguntas')
        .select('*');

    if (!errorPreguntas && preguntasObtenidas) {
        bancoPreguntas = preguntasObtenidas.map(p => {
            let listaOpciones = p.opciones;
            if (typeof p.opciones === 'string') {
                listaOpciones = p.opciones.replace(/{|}/g, '').split(',');
            }
            return { q: p.pregunta, o: listaOpciones, a: parseInt(p.correcta) };
        });
    }

    // OYENTE: Click en el título principal "Mentes Despiertas"
    logoTitulo.onclick = function() {
        pJuego.classList.add('oculto');
        pRanking.classList.add('oculto');
        sTablaGlobal.classList.add('oculto');
        pInicio.classList.remove('oculto');
    };

    // OYENTE: Botón "Ver Posiciones" desde la pantalla de inicio
    btnVerRankingInicio.onclick = async function() {
        await actualizarDatosRanking();
        sTablaGlobal.classList.remove('oculto');
    };

    // OYENTE: Botón Comenzar Desafío
    btnComenzar.onclick = function() {
        if (yaTerminoElJuego) {
            alert("Ya completaste el desafío en esta sesión. ¡Gracias por participar!");
            return;
        }

        const nickInput = inputNick.value.trim();
        if (nickInput === "") {
            alert("Por favor, ingresá un Nickname.");
            return;
        }
        juego.nick = nickInput;
        
        const userBadge = document.getElementById('usuario-activo');
        if (userBadge) userBadge.innerText = "👤 " + juego.nick;
        
        pInicio.classList.add('oculto');
        sTablaGlobal.classList.add('oculto'); // Ocultamos la tabla si estaba abierta
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
        yaTerminoElJuego = true; // ACTIVAMOS EL BLOQUEO
        pJuego.classList.add('oculto');
        pRanking.classList.remove('oculto');
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} puntos.`;

        // Registrar puntaje en Supabase
        await miSupabase.from('ranking').insert([{ nick: juego.nick, puntaje: juego.puntaje }]);

        // Traer y mostrar tabla actualizada automáticamente al final
        await actualizarDatosRanking();
        sTablaGlobal.classList.remove('oculto');
    }

    // FUNCIÓN CORE: Trae la info de Supabase y configura los clics de las pestañas
    async function actualizarDatosRanking() {
        const { data: rankingsDelDia, error: errorRanking } = await miSupabase
            .from('ranking')
            .select('*')
            .order('puntaje', { ascending: false });

        if (errorRanking) return;

        listaRankingsGlobal = rankingsDelDia;

        const btnTop3 = document.getElementById('btn-tab-top3');
        const btnGeneral = document.getElementById('btn-tab-general');

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

        // Forzamos la vista del Top 3 inicialmente
        btnTop3.click();
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

    // Acción del botón Volver a intentar (solo limpia interfaz, el candado sigue activo)
    document.getElementById('btn-reiniciar').onclick = function() {
        pRanking.classList.add('oculto');
        sTablaGlobal.classList.add('oculto');
        pInicio.classList.remove('oculto');
    };
};
