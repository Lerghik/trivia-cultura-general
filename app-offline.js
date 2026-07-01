/**
 * ====================================================================
 * CONFIGURACIÓN EN MODO OFFLINE (SIN CONEXIÓN A SUPABASE)
 * ====================================================================
 */

console.warn("⚠️ ALERTA: La aplicación está corriendo en MODO OFFLINE (Simulación local).");

// Variables de almacenamiento en memoria que controlarán el flujo dinámico de la partida
let bancoPreguntas = [
    {
        q: "¿Cuál es el río más largo del mundo?",
        o: ["Nilo", "Amazonas", "Misisipi", "Danubio"],
        a: 1
    },
    {
        q: "¿En qué año cayó el Muro de Berlín?",
        o: ["1985", "1989", "1991", "1993"],
        a: 1
    },
    {
        q: "¿Qué gas absorben las plantas para realizar la fotosíntesis?",
        o: ["Oxígeno", "Dióxido de Carbono", "Nitrógeno", "Hidrógeno"],
        a: 1
    },
    {
        q: "¿Quién escribió 'Cien años de soledad'?",
        o: ["Jorge Luis Borges", "Julio Cortázar", "Gabriel García Márquez", "Mario Vargas Llosa"],
        a: 2
    },
    {
        q: "¿Cuál es el planeta más grande del sistema solar?",
        o: ["Saturno", "Tierra", "Júpiter", "Neptuno"],
        a: 2
    },
    {
        q: "¿Qué país regaló la Estatua de la Libertad a Estados Unidos?",
        o: ["Francia", "Reino Unido", "Alemania", "España"],
        a: 0
    },
    {
        q: "¿Cuál es el órgano más grande del cuerpo humano?",
        o: ["El hígado", "El corazón", "La piel", "Los pulmones"],
        a: 2
    },
    {
        q: "¿Qué elemento de la tabla periódica tiene el símbolo 'Au'?",
        o: ["Plata", "Oro", "Cobre", "Aluminio"],
        a: 1
    },
    {
        q: "¿En qué continente se encuentra el Desierto del Sahara?",
        o: ["Asia", "América", "África", "Oceanía"],
        a: 2
    },
    {
        q: "¿Cuál es la capital de Japón?",
        o: ["Kioto", "Osaka", "Seúl", "Tokio"],
        a: 3
    }
];

let juego = {                 // Objeto central para registrar el progreso del usuario activo
    nick: "",                 // Guardará el apodo escrito por el jugador
    preguntaActual: 0,        // Índice numérico del vector de preguntas (0 es la primera pregunta)
    puntaje: 0                // Sumador de puntos acumulados (10 unidades por acierto)
};
let listaRankingsGlobal = []; // Array que contendrá el historial de puntajes simulado localmente
let yaTerminoElJuego = false; // Candado lógico para bloquear intentos extras de volver a registrar puntos

/**
 * ====================================================================
 * EVENTO DE INICIALIZACIÓN: AL CARGAR LA PÁGINA (window.onload)
 * ====================================================================
 */
window.onload = function() {
    
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

    // Carga inicial del ranking simulado desde el LocalStorage del navegador
    cargarRankingDesdeLocalStorage();

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
    btnVerRankingInicio.onclick = function() {
        actualizarDatosRanking();             // Lee y ordena los datos guardados en la computadora
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

        // Itera (recorre) el sub-array de opciones para crear los botones de respuestas en tiempo real
        infoPregunta.o.forEach((opcion, index) => {
            const btn = document.createElement('button'); // Instancia un nodo <button> en la memoria
            btn.className = "btn-opcion";                 // Le inyecta la clase estilizada de tu CSS
            btn.innerText = opcion.replace(/"/g, '').trim(); // Elimina comillas redundantes y recorta textos limpios
            
            // Le asigna un evento inline: al presionarse ejecutará la validación pasándole su posición
            btn.onclick = () => procesarRespuesta(index);
            
            contenedor.appendChild(btn); // Inserta físicamente el botón dentro del contenedor visible de la grilla
        });
    }

    // Encargada de auditar si la opción elegida por el jugador es la acertada
    // Encargada de auditar si la opción elegida por el jugador es la acertada con feedback visual
    function procesarRespuesta(indiceSeleccionado) {
        // 1. Capturamos todos los botones que están dentro del contenedor de opciones en este instante
        const contenedor = document.getElementById('contenedor-opciones');
        const botones = contenedor.querySelectorAll('.btn-opcion');
        
        // 2. Bloqueamos todos los botones inmediatamente para evitar múltiples clics accidentales
        botones.forEach(btn => btn.classList.add('deshabilitado'));

        // Obtener el índice de la respuesta correcta de la pregunta actual
        const indiceCorrecto = bancoPreguntas[juego.preguntaActual].a;

        // 3. Evaluamos si el usuario acertó o se equivocó
        if (indiceSeleccionado === indiceCorrecto) {
            // Si acertó: sumamos puntos y pintamos de verde el botón que el usuario cliqueó
            juego.puntaje += 10;
            botones[indiceSeleccionado].classList.add('correcta');
        } else {
            // Si falló: pintamos de rojo el botón equivocado que tocó
            botones[indiceSeleccionado].classList.add('incorrecta');
            // Y pintamos de verde el botón que contenía la respuesta correcta real
            botones[indiceCorrecto].classList.add('correcta');
        }

        // 4. Ponemos un temporizador de 1500 milisegundos (1.5 segundos) antes de pasar al siguiente paso
        setTimeout(() => {
            juego.preguntaActual++; // Avanza el contador de posición de preguntas
            cargarPregunta();       // Recarga la interfaz con la nueva pregunta limpiando los estilos
        }, 1500);
    }

    // Encargada de procesar el cierre del juego y resguardar el récord localmente
    function finalizarJuego() {
        yaTerminoElJuego = true; // Cierra temporalmente el acceso lógico por precaución
        
        pJuego.classList.add('oculto');         // Oculta la grilla de juego activa
        pRanking.classList.remove('oculto');     // Presenta el panel con el cartel de finalización
        
        // Escribe las felicitaciones junto al total de puntos acumulados
        document.getElementById('resultado-usuario').innerText = `¡Buen trabajo! Sumaste ${juego.puntaje} puntos.`;

        // MODO OFFLINE: Simulación del control de nick único usando LocalStorage
        const nickDuplicado = listaRankingsGlobal.some(p => p.nick.toLowerCase() === juego.nick.toLowerCase());

        if (nickDuplicado) {
            alert(`⚠️ El nick "${juego.nick}" ya está registrado localmente por otro jugador. Tu puntaje NO se guardó. Podés volver a intentar cambiando tu Nickname.`);
            yaTerminoElJuego = false; // Devuelve la habilitación para reiniciar el juego
            inputNick.value = "";     // Vacía el casillero de escritura
            const userBadge = document.getElementById('usuario-activo');
            if (userBadge) userBadge.innerText = "";
        } else {
            // Si el nick está libre, fabricamos un objeto simulando la base de datos (con un ID aleatorio)
            const nuevoRegistro = {
                id: Math.floor(Math.random() * 1000000),
                nick: juego.nick,
                puntaje: juego.puntaje
            };
            
            listaRankingsGlobal.push(nuevoRegistro); // Lo metemos en nuestra lista de memoria
            
            // Guardamos la lista actualizada transformándola en texto JSON dentro del LocalStorage
            localStorage.setItem('ranking_offline', JSON.stringify(listaRankingsGlobal));
        }

        // Refresca la tabla visual
        actualizarDatosRanking();
        sTablaGlobal.classList.remove('oculto'); // Muestra los resultados en el cuadro global inferior
    }

    // Encargada de leer el historial guardado en el navegador de la máquina
    function cargarRankingDesdeLocalStorage() {
        const datosLocales = localStorage.getItem('ranking_offline');
        if (datosLocales) {
            // Si ya existen partidas viejas guardadas en esta PC, las decodificamos de JSON a Array
            listaRankingsGlobal = JSON.parse(datosLocales);
        } else {
            listaRankingsGlobal = []; // Si está vacío, iniciamos de cero
        }
    }

    // Encargada de ordenar el historial de marcas locales y enlazar las pestañas
    function actualizarDatosRanking() {
        // Cargamos los datos más frescos que estén guardados en la PC
        cargarRankingDesdeLocalStorage();

        // Ordenamos el array local de mayor a menor puntaje (.sort)
        listaRankingsGlobal.sort((a, b) => b.puntaje - a.puntaje);

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

    // Encargada de renderizar las filas tr y td correspondientes a los registros locales
    function dibujarTabla(datosAFiltrar) {
        const tablaCuerpo = document.getElementById('tabla-cuerpo');
        if (!tablaCuerpo) return; // Frena la ejecución si la tabla no está estructurada en el HTML
        
        tablaCuerpo.innerHTML = ""; // Despeja las filas antiguas inyectadas previamente

        // Recorre los elementos filtrados para armar sus respectivas celdas
        datosAFiltrar.forEach((player) => {
            const fila = document.createElement('tr'); // Crea dinámicamente un contenedor de fila
            
            // Calcula matemáticamente la posición real buscando el índice en el array general ordenado
            let posicionReal = listaRankingsGlobal.findIndex(p => p.id === player.id) + 1;

            // Condición estética: Si los datos de esta fila corresponden a la puntuación de esta partida
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
}; // Cierre formal de la inicialización window.onload en modo offline.