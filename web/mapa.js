(() => {
  const details = {
    isla: ["Isla de Arkhe", "La isla está en el océano Atlántico, lejos de tierra continental. La historia no fija distancias ni orientación de sus lugares."],
    arbol: ["Árbol divino", "El árbol ya estaba en la isla cuando llegó el Rey X. Los Verdania eran sus habitantes; no se especifica su posición relativa a otros lugares."],
    reino: ["Reino de Arkhe", "El Rey X instauró el reino en 1527. La ubicación exacta del pueblo y sus límites no están especificados."],
    biblioteca: ["Biblioteca real", "Allí permanece oculto el manuscrito que conserva el testimonio del juicio de la Trinidad. Su ubicación precisa dentro del reino no está especificada."]
  };
  const output = document.querySelector("[data-map-detail]");
  const buttons = [...document.querySelectorAll("[data-map-place]")];
  if (!output || buttons.length === 0) return;

  buttons.forEach((button) => button.addEventListener("click", () => {
    const item = details[button.dataset.mapPlace];
    if (!item) return;
    buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));

    const heading = document.createElement("h3");
    heading.textContent = item[0];
    const description = document.createElement("p");
    description.textContent = item[1];
    output.replaceChildren(heading, description);
  }));
})();
