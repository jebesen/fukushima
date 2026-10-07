/* Configuración del curso: todo lo que puedes cambiar sin tocar el resto del código.
   Deja un valor en blanco ('') para desactivar esa función. Instrucciones paso a paso en README.md. */
export const CONFIG = {
  /* Fecha que aparece en la esquina de la portada («Actualizado en ...»). Cámbiala cuando revises los datos. */
  updated: 'septiembre de 2026',

  /* CONTADOR DE VISITAS (GoatCounter, sin cookies).
     Código de tu cuenta: si tu panel es https://jebesen.goatcounter.com, el código es 'jebesen'. */
  goatcounter: 'jebesen',
  /* Mostrar el contador público en el pie de página. Requiere activar «Allow adding visitor counts on your website»
     en Settings de GoatCounter (si no está activado, el contador simplemente no se muestra). */
  publicCounter: true,

  /* FORMULARIO DE COMENTARIOS (envía a un Google Forms → hoja de cálculo de tu Drive).
     action: dirección del formulario terminada en /formResponse
     fields: identificador «entry.NNNNNNNNN» de cada pregunta del formulario (valoración 1-10, comentario y correo).
             'page' es opcional: si lo dejas en blanco, la página desde la que se escribe se añade al final del comentario.
     Mientras falten el 'action' o los identificadores de la valoración y el comentario, los botones de comentarios no se muestran. */
  feedback: {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSdLz8vD3OxKo91zf4RSsDWe4DMm5p4LW_-17Y5DH54wrck2LQ/formResponse',
    fields: { rating: 'entry.17893343', comment: 'entry.335782922', email: 'entry.1034712708', page: '' },
  },
};
