(() => {
    const panel = document.querySelector("[data-agenda]");
    const instant = new Date(panel.querySelector("time[datetime]").dateTime);
    const notice = panel.querySelector(".agenda-aviso");
    const grid = panel.querySelector(".agenda-grilla");
    const heading = panel.querySelector(".agenda-mes");
    const empty = panel.querySelector("[data-sin-eventos]");
    const today = new Date();
    let month = new Date(today.getFullYear(), today.getMonth(), 1);

    const dateLabel = new Intl.DateTimeFormat("es", { dateStyle: "full" });
    const hourLabel = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const monthLabel = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
    notice.querySelector("time").textContent = `${dateLabel.format(instant)}, ${hourLabel.format(instant)} (hora de tu dispositivo)`;
    const sameMonth = (date) => date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();

    const render = () => {
        heading.textContent = monthLabel.format(month).replace(/^./, letter => letter.toUpperCase());
        grid.querySelectorAll("[data-celda]").forEach(cell => cell.remove());
        const leading = (month.getDay() + 6) % 7;
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        for (let i = 0; i < leading + days; i++) {
            const cell = document.createElement("span");
            cell.dataset.celda = "";
            const day = i - leading + 1;
            if (day < 1) {
                cell.setAttribute("aria-hidden", "true");
            } else {
                const date = new Date(month.getFullYear(), month.getMonth(), day);
                cell.className = "agenda-dia";
                cell.textContent = day;
                cell.setAttribute("aria-label", dateLabel.format(date));
                if (sameMonth(today) && day === today.getDate()) cell.setAttribute("aria-current", "date");
                if (sameMonth(instant) && day === instant.getDate()) {
                    cell.classList.add("agenda-dia-evento");
                    cell.setAttribute("aria-label", `${dateLabel.format(date)}: reunión informativa`);
                }
            }
            grid.append(cell);
        }
        notice.hidden = !sameMonth(instant);
        empty.hidden = sameMonth(instant);
    };

    panel.querySelectorAll("[data-mover-mes]").forEach(button => button.addEventListener("click", () => {
        month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.moverMes), 1);
        render();
    }));
    panel.querySelector("[data-ver-aviso]").addEventListener("click", () => {
        month = new Date(instant.getFullYear(), instant.getMonth(), 1);
        render();
    });
    render();
    panel.querySelector("[data-agenda-interactiva]").hidden = false;
})();
