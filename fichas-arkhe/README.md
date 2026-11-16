# Arkhe — Envío y revisión de fichas

El catálogo de la web está en `web/`. Este servicio sirve la web en el mismo dominio, añade el formulario a Personajes y genera las fichas aprobadas desde SQLite. Sirve únicamente recursos web explícitos. El almacenamiento debe persistir entre despliegues y permanecer fuera de `web/`.

## Arrancar en local

1. Instalá Node.js 24 y ejecutá `npm install` en `fichas-arkhe/`.
2. Configurá las variables de entorno y ejecutá `npm start` en esa carpeta.
3. Abrí `http://127.0.0.1:8888/personajes.html`. Entrá a `/administracion` para revisar.

| Variable | Uso |
| --- | --- |
| `ARKHE_SITE_DIR` | Ruta absoluta a la carpeta `web` o a la copia de Arkhe del Escritorio. Debe contener `stellvt.html`. |
| `ARKHE_DATA_DIR` | Directorio absoluto y privado, fuera de la web. En producción, debe estar en un volumen persistente con copias de seguridad. |
| `ARKHE_ADMIN_PASSWORD` | Contraseña aleatoria de al menos 16 caracteres, guardada como secreto del alojamiento. |
| `PORT` | Puerto local. Predeterminado: 8888. |
| `ARKHE_BIND` | Dirección de escucha. Predeterminada: 127.0.0.1. |
| `ARKHE_ORIGIN` | Origen exacto en producción, con esquema HTTPS y sin ruta. En local se deduce de `PORT`. |

## Revisión

- El jugador guarda el enlace privado de recepción. Desde allí puede consultar el estado y corregir el envío cuando Administración lo habilita.
- Administración abre la ficha, selecciona qué publicar, guarda la selección y revisa la vista previa. La aprobación publica la misma selección y agrega una tarjeta única al catálogo.
- La autorización del jugador es necesaria para que aparezcan sus enlaces. La fecha de nacimiento del jugador, el usuario de Discord, el nickname de Minecraft y la skin nunca forman parte de la proyección pública.
- El catálogo y las fichas dependen de este servicio. Un alojamiento estático por sí solo, incluido GitHub Pages, no puede ejecutar el panel ni guardar envíos.
- En producción, usá HTTPS en el proxy, un volumen privado y una sola instancia que use esa base. La identidad de «arkheoficial» y su capacidad para ejecutar Node y montar un volumen deben confirmarse antes del despliegue.
- Las copias de respaldo deben incluir la base en forma consistente (por ejemplo, mediante la función de respaldo de SQLite). No exportes la base al sitio ni al repositorio.

Las instrucciones de los rasgos vienen del formulario existente. Los oficios se introducen como texto porque el original disponible contiene una pregunta abierta, sin catálogo de oficios.

