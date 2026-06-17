# Task Hub

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

Task Hub es un plugin de Obsidian solo para escritorio. Reúne tareas Markdown del vault, Apple Reminders, eventos de Apple Calendar, calendarios ICS públicos y tareas de Dida/TickTick en un único espacio de trabajo.

Está pensado para quienes escriben compromisos en notas diarias, actas de reuniones, notas de proyecto o documentos de referencia, pero quieren un lugar tranquilo para revisar, filtrar, reprogramar y actualizar tareas con seguridad.

![Task Hub calendar overview](assets/task-hub-calendar-overview.png)

## ¿Por qué Task Hub?

Task Hub mantiene tus tareas Markdown dentro de sus notas originales y les añade un centro de control dedicado. No necesitas mover todas tus tareas a otra aplicación para ver qué vence, de dónde viene o a qué etiqueta de proyecto pertenece.

Úsalo para:

- Reunir tareas `- [ ]` y `- [x]` de todo tu vault.
- Abrir la nota fuente desde una tarea y saltar cerca de la línea original.
- Revisar tareas por lista, calendario o etiqueta.
- Ver tareas con fecha junto a fuentes compatibles de calendarios y recordatorios.
- Mantener cualquier escritura hacia fuentes externas como una opción explícita.

## Funciones destacadas

- Indexa tareas Markdown escritas como `- [ ]` y `- [x]`.
- Detecta fechas `📅 YYYY-MM-DD`, `due:: YYYY-MM-DD` o `YYYY-MM-DD` suelto.
- Filtra por estado, fuente, etiqueta, grupo de fecha, texto y condiciones AND/OR personalizadas.
- Completa tareas del vault solo después de verificar que la línea fuente todavía coincide.
- Crea y edita tareas recurrentes comunes: diarias, semanales, mensuales y anuales.
- Muestra tareas con fecha y eventos en vistas de mes, semana y día.
- Reprograma arrastrando tareas Markdown que ya contienen un marcador de fecha compatible.
- Añade calendarios ICS públicos de solo lectura.
- Lee Apple Reminders y Apple Calendar en macOS mediante el helper local.
- Sincroniza tareas Dida/TickTick mediante la Open API cuando está configurado.
- Crea notas Markdown locales enlazadas a tareas y eventos.
- Permite cambiar la interfaz del plugin entre inglés, chino, japonés, coreano y francés.

## Fuentes compatibles

| Fuente | Lectura | Escritura opcional | Notas |
| --- | --- | --- | --- |
| Tareas Markdown del vault | Sí | Completar, editar, eliminar, recurrencia y reprogramación por arrastre para líneas compatibles | Se comprueba la línea fuente antes de escribir en Markdown. |
| Calendarios ICS públicos | Sí | No | Los eventos ICS son de solo lectura. |
| Apple Reminders | Solo macOS | Completar, reabrir, editar, crear desde Markdown y reprogramar cuando esté activado | Usa el helper local de Apple y permisos de macOS. |
| Apple Calendar | Solo macOS | Crear, editar y reprogramar eventos cuando esté activado | Se respetan los calendarios editables; los de solo lectura siguen siendo solo lectura. |
| Dida / TickTick | Sí, mediante Open API | Crear, editar, completar, eliminar, sincronizar etiquetas y reprogramar cuando esté activado | Requiere tu token API y ajustes configurados. |

Las funciones de escritura se separan en los ajustes. Que una fuente pueda leerse no significa que Task Hub vaya a modificarla automáticamente.

## Compatibilidad

- **Obsidian:** `manifest.json` declara actualmente `minAppVersion` `1.7.2`. Usa Obsidian desktop 1.7.2 o posterior.
- **Móvil:** Obsidian mobile no está soportado.
- **Integración Apple en macOS:** Apple Reminders y Apple Calendar solo están disponibles en macOS. La matriz probada actualmente es macOS 14 Sonoma o posterior.
- **Otros sistemas de escritorio:** Las funciones principales de tareas del vault, etiquetas, calendario, ICS público y Dida/TickTick están diseñadas para Obsidian desktop. Apple Reminders y Apple Calendar no están disponibles fuera de macOS.

## Instalación

Cuando Task Hub esté disponible en el directorio de plugins comunitarios de Obsidian, instálalo desde **Settings -> Community plugins -> Browse**.

Para instalación manual desde una GitHub Release:

1. Descarga `manifest.json`, `main.js` y `styles.css` desde la release.
2. Crea esta carpeta en tu vault: `.obsidian/plugins/task-hub/`.
3. Copia los archivos descargados en esa carpeta.
4. Reinicia Obsidian o recarga los plugins comunitarios y activa **Task Hub**.

La compatibilidad local con Apple Reminders y Apple Calendar depende del binario `taskhub-apple-helper` dentro del paquete del plugin o de la ruta de compilación desde código fuente. Los assets estándar de una release comunitaria siguen siendo los archivos que Obsidian soporta: `manifest.json`, `main.js` y `styles.css`.

## Uso diario

Abre Task Hub desde el icono de la cinta lateral o con el comando **Open Task Hub**.

La vista de tareas reúne tareas del vault y fuentes externas compatibles en una sola lista. Usa la barra lateral para filtrar por fuente o etiqueta, y la barra superior para mostrar tareas completadas, aplicar filtros condicionales, buscar texto o volver a escanear el vault.

La vista de calendario combina tareas Markdown con fecha, eventos ICS públicos, eventos de Apple Calendar, Apple Reminders y tareas Dida/TickTick disponibles. Las vistas de mes, semana y día permiten cambiar el horizonte de planificación. La reprogramación por arrastre solo está disponible para fuentes y ajustes que admiten escritura.

La vista de etiquetas agrupa tareas por etiquetas de estilo Obsidian para revisar proyectos, contextos o listas de espera sin crear primero otro sistema.

Las notas de tarea son archivos Markdown locales opcionales enlazados a tareas o eventos de Task Hub. Usan YAML frontmatter para mantener la relación visible y portable.

## Privacidad y permisos

Task Hub indexa archivos Markdown dentro de tu vault local y guarda los ajustes del plugin en los datos de plugin de Obsidian dentro de ese vault.

Las fuentes ICS públicas solo se descargan desde las URL que configures. La integración Dida/TickTick envía solicitudes HTTPS autenticadas únicamente a la base API configurada cuando la activas.

La integración local de Apple funciona solo en Obsidian desktop para macOS y pide a macOS acceso a Reminders o Calendar antes de leer datos locales. Task Hub no pide tu contraseña de Apple ID ni se conecta directamente a servidores de iCloud; la sincronización de iCloud sigue gestionada por macOS.

Obsidian puede mostrar avisos de capacidades. Task Hub las usa con fines limitados:

- **Enumeración del vault:** escanear archivos Markdown para encontrar líneas de tarea y fechas.
- **Lectura/escritura del vault:** leer notas para indexar y escribir solo cuando completas, editas, eliminas o reprogramas una tarea compatible.
- **Acceso al sistema de archivos:** comprobar y usar el helper local opcional de Apple dentro de la ruta del plugin.
- **Ejecución shell:** iniciar únicamente `taskhub-apple-helper`, incluido o compilado localmente, para la integración Apple.
- **Solicitudes de red:** descargar URL ICS configuradas y acceder a la API Dida/TickTick configurada si está activada.

Task Hub no envía tareas del vault a un servicio remoto salvo que crees o sincronices explícitamente una tarea externa mediante una integración configurada.

## Límites actuales

Task Hub mantiene un alcance conservador:

- Obsidian mobile no está soportado.
- No se implementa la gramática completa del plugin Obsidian Tasks.
- No se implementa sintaxis de tareas Markdown con hora de inicio/fin.
- Google Calendar OAuth y Microsoft Calendar OAuth no están incluidos.
- Los eventos ICS públicos son de solo lectura.
- Las funciones de escritura de Apple Reminders, Apple Calendar y Dida/TickTick deben activarse explícitamente.
- El helper de Apple se proporciona mediante el paquete del plugin o la ruta de compilación desde fuente; no asumas que una release comunitaria estándar instala automáticamente un asset helper adicional.

## Desarrollo

Consulta el README en inglés para los detalles de desarrollo y release: [Development](README.md#development).

## Assets de release

Para una release de plugin comunitario de Obsidian, el tag de GitHub debe coincidir exactamente con la `version` de `manifest.json` e incluir estos archivos adjuntos:

- `main.js`
- `manifest.json`
- `styles.css`

La raíz del repositorio también conserva los archivos esperados por el flujo de envío de Obsidian:

- `README.md`
- `LICENSE`
- `manifest.json`
- `versions.json`

No adjuntes archivos adicionales como `taskhub-apple-helper` a las GitHub Releases del plugin comunitario. Obsidian solo descarga `main.js`, `manifest.json` y `styles.css` desde los release assets.
