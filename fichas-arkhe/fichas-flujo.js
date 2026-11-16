(() => {
    const form = document.querySelector("[data-ficha-form]");
    if (!form) return;
    const steps = [...form.querySelectorAll("[data-ficha-paso]")];
    const progress = document.querySelector("#ficha-pasos");
    const label = document.querySelector("[data-paso]");
    const back = form.querySelector("[data-atras]");
    const next = form.querySelector("[data-continuar]");
    const send = form.querySelector("[data-enviar]");
    const error = form.querySelector("[data-ficha-error]");
    let index = 0;
    let busy = false;

    const conditional = () => {
        for (const field of form.querySelectorAll("[data-cond-key]")) {
            const active = form.elements.namedItem(field.dataset.condKey).value === field.dataset.condValue;
            field.hidden = !active;
            for (const input of field.querySelectorAll("input,select,textarea")) input.disabled = !active;
        }
    };
    const show = (step, focus = true) => {
        index = step;
        steps.forEach((node,i) => { node.hidden = i !== step; });
        progress.value = step + 1;
        const heading = steps[step].querySelector("h3");
        label.textContent = "Paso " + (step+1) + " de " + steps.length + " · " + heading.textContent;
        back.hidden = step === 0;
        next.hidden = step === steps.length - 1;
        send.hidden = !next.hidden;
        if (focus) heading.focus();
    };
    const validate = step => {
        const input = [...steps[step].querySelectorAll("input,select,textarea")]
            .find(field => !field.disabled && !field.checkValidity());
        if (!input) return true;
        show(step,false);
        input.reportValidity();
        return false;
    };

    form.noValidate = true;
    conditional();
    form.hidden = false;
    show(0,false);
    form.addEventListener("change",conditional);
    back.addEventListener("click",() => show(index-1));
    next.addEventListener("click",() => { if (validate(index)) show(index+1); });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        if (index < steps.length - 1) {
            if (validate(index)) show(index+1);
            return;
        }
        if (steps.some((_,i) => !validate(i))) return;
        busy = true;
        send.disabled = true;
        error.hidden = true;
        try {
            const result = await fetch(form.action,{method:"POST",body:new FormData(form)});
            const payload = await result.json();
            if (!result.ok) throw new Error(payload.message || "No se pudo guardar la ficha.");
            location.assign(payload.location);
        } catch (failure) {
            error.textContent = failure.message || "No se pudo conectar. Volvé a intentar.";
            error.hidden = false;
        } finally {
            busy = false;
            send.disabled = false;
        }
    });
})();

