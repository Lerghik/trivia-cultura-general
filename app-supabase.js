// CONFIGURACIÓN DE TU PROYECTO
const SUPABASE_URL = "https://ebglmoumxipvrtpsgkrw.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_rKZ87GIXN8TtKlOsdeYN2g__gocmwd0"; // <--- PONÉ ACÁ TU KEY REAL EN GITHUB

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
        yaTerminoElJuego = true; // Bloqueamos la sesión actual
        pJuego.classList.add('oculto');
        
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} points.`;

        // 2. ENVIAR EL RESULTADO A SUPABASE (Y capturar si hay error de duplicado)
        const { error: errorInsert } = await miSupabase
            .from('ranking')
            .insert([{ nick: juego.nick, puntaje: juego.puntaje }]);

        // NUEVO: Validamos si la base de datos rechazó el Nickname por estar repetido
        if (errorInsert) {
            console.error("Error al guardar en ranking:", errorInsert);
            
            // El código de error '23505' en Postgres significa "Violación de unicidad" (Duplicado)
            if (errorInsert.code === '23505') {
                alert(`⚠️ El nick "${juego.nick}" ya está registrado por otro jugador. Tus puntos se mostrarán temporalmente pero no se guardarán con este nombre. ¡Probá con otro apodo la próxima!`);
            } else {
                alert("Hubo un problema al guardar tu puntaje en el servidor.");
            }
        }

        // 3. TRAER Y MOSTRAR TABLA ACTUALIZADA
        await actualizarDatosRanking();
        pRanking.classList.remove('oculto');
        sTablaGlobal.classList.remove('oculto');
    }
