(() => {
    const nav = document.querySelector('nav[aria-label="Navegación principal"]');
    const menu = nav?.querySelector(".menu, .nav-links");
    if (!menu) return;

    let button = nav.querySelector(".menu-boton");
    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "menu-boton";
        button.textContent = "Menú";
        menu.before(button);
    }
    menu.id ||= "menu-principal";
    button.setAttribute("aria-controls", menu.id);
    const mobile = matchMedia("(max-width: 650px)");
    const setOpen = (open) => {
        menu.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
    };
    const sync = () => {
        button.hidden = !mobile.matches;
        if (mobile.matches && menu.contains(document.activeElement)) button.focus();
        setOpen(false);
    };

    sync();
    document.body.classList.add("nav-ready");
    mobile.addEventListener("change", sync);
    button.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && menu.classList.contains("is-open")) {
            setOpen(false);
            button.focus();
        }
    });
})();
