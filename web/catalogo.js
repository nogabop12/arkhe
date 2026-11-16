(() => {
    const normalize = value => (value ?? "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    const matches = (text, query) => normalize(query).trim().split(/\s+/)
        .every(word => text.includes(word));
    const selectors = {
        dioses: ".categoria .dios",
        personajes: ".personajes > .personaje",
        seres: ".categoria .ser"
    };
    for (const controls of document.querySelectorAll("[data-catalog]")) {
        const type = controls.dataset.catalog;
        const selector = selectors[type];
        const query = controls.querySelector("[data-query]");
        const filter = controls.querySelector("[data-category]");
        const count = controls.querySelector("[data-count]");
        const empty = controls.querySelector("[data-empty]");
        if (!selector || !query || !count) continue;

        const cards = [...document.querySelectorAll(selector)].map(card => ({
            element: card,
            text: normalize(card.textContent),
            group: card.closest(".categoria"),
            category: type === "personajes"
                ? (card.matches("a") ? "publicadas" : "pendientes")
                : card.closest(".categoria")?.id
        }));
        const groups = [...new Set(cards.map(card => card.group).filter(Boolean))];
        const links = [...document.querySelectorAll(".categorias a, .jerarquia a")];

        const tools = document.createElement("div");
        tools.className = "catalogo-herramientas";
        const clear = document.createElement("button");
        clear.className = "catalogo-limpiar";
        clear.type = "button";
        clear.textContent = "Limpiar filtros";
        count.before(tools);
        tools.append(count, clear);
        controls.hidden = false;

        const apply = () => {
            const category = filter?.value || "todos";
            const visibleGroups = new Set();
            let shown = 0;
            for (const card of cards) {
                const visible = (category === "todos" || category === card.category) && matches(card.text, query.value);
                card.element.hidden = !visible;
                if (visible) {
                    shown++;
                    visibleGroups.add(card.group);
                }
            }
            for (const group of groups) {
                group.hidden = !visibleGroups.has(group);
                const jump = links.find(link => link.hash === `#${group.id}`);
                if (jump) jump.hidden = group.hidden;
            }
            count.textContent = `${shown} ${shown === 1 ? "resultado" : "resultados"}`;
            empty.hidden = shown > 0;
            clear.hidden = !query.value && category === "todos";
        };

        query.addEventListener("input", apply);
        filter?.addEventListener("change", apply);
        clear.addEventListener("click", () => {
            query.value = "";
            if (filter) filter.value = "todos";
            apply();
            query.focus();
        });
        apply();
    }

    const glossary = document.querySelector("[data-glossary-search]");
    if (!glossary) return;
    const input = glossary.querySelector("[data-query]");
    const count = glossary.querySelector("[data-count]");
    const empty = glossary.querySelector("[data-empty]");
    const entries = [...glossary.querySelectorAll("[data-glossary-entry]")];
    if (!input || !entries.length) return;
    glossary.querySelector(".glosa-controls").hidden = false;
    const updateGlossary = () => {
        let shown = 0;
        for (const entry of entries) {
            entry.hidden = !matches(normalize(entry.textContent), input.value);
            if (!entry.hidden) shown++;
        }
        count.textContent = `${shown} ${shown === 1 ? "término" : "términos"}`;
        empty.hidden = shown > 0;
    };
    input.addEventListener("input", updateGlossary);
    updateGlossary();
})();
