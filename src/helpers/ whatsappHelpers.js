function obtenerIdDeRespuesta(buttonReply, listReply, msgText) {
  if (buttonReply?.id) return buttonReply.id.toLowerCase();
  if (listReply?.id) return listReply.id.toLowerCase();

  if (msgText) {
    const texto = msgText.toLowerCase();

    if (
      texto.includes("no sé") ||
      texto.includes("no se") ||
      texto.includes("ayuda")
    ) {
      return "regimen_ayuda";
    }

    const matchRegimen = texto.match(/reg[ií]men\s*(\d{3})/i);
    if (matchRegimen) {
      return "regimen_" + matchRegimen[1];
    }

    if (
      texto.includes("uso ayuda") ||
      texto.includes("uso cfdi ayuda") ||
      texto.includes("uso no sé") ||
      texto.includes("uso")
    ) {
      if (
        texto.includes("ayuda") ||
        texto.includes("no sé") ||
        texto.includes("no se") ||
        texto.includes("pdf")
      ) {
        return "uso_ayuda";
      }

      const matchUso = texto.match(/uso\s*([a-z0-9]{3})/i);
      if (matchUso) {
        return "uso_" + matchUso[1].toUpperCase();
      }
    }
  }

  return (buttonReply?.id || listReply?.id || msgText || "").toLowerCase();
}

function esRespuestaPositiva(texto) {
  const t = texto.toLowerCase();
  return (
    t.includes("mostrar") ||
    t.includes("lista") ||
    t.includes("volver") ||
    t.includes("reintentar") ||
    t.includes("sí") ||
    t.includes("si") ||
    t.includes("ok") ||
    t.includes("dale")
  );
}

function esRespuestaCancelar(texto) {
  const t = texto.toLowerCase();
  return (
    t.includes("cancelar") ||
    t.includes("no") ||
    t.includes("salir") ||
    t.includes("terminar")
  );
}

module.exports = {
  obtenerIdDeRespuesta,
  esRespuestaPositiva,
  esRespuestaCancelar,
};
