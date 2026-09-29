function actualizarDispositivo() {
    const body = document.body;
    const ancho = window.innerWidth;
    const alto = window.innerHeight;

    body.classList.remove(
        "pc",
        "tablet",
        "celular",
        "pantalla-pequena",
        "pantalla-grande",
        "horizontal",
        "vertical",
        "tactil"
    );

    if (ancho <= 600) {
        body.classList.add("celular");
    } else if (ancho <= 1024) {
        body.classList.add("tablet");
    } else {
        body.classList.add("pc");
    }

    if (ancho <= 1366) {
        body.classList.add("pantalla-pequena");
    } else {
        body.classList.add("pantalla-grande");
    }

    if (ancho > alto) {
        body.classList.add("horizontal");
    } else {
        body.classList.add("vertical");
    }

    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
        body.classList.add("tactil");
    }
}

actualizarDispositivo();

window.addEventListener("resize", actualizarDispositivo);
window.addEventListener("orientationchange", actualizarDispositivo);