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

    const matchUso = texto.match(/uso\s*([a-z0-9]{3})/i);
    if (matchUso) {
      return "uso_" + matchUso[1].toUpperCase();
    }
  }

  return (buttonReply?.id || listReply?.id || msgText || "").toLowerCase();
}

module.exports = { obtenerIdDeRespuesta };
