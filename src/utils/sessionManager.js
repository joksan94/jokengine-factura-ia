const sessions = {};

const getSession = (phone) => {
  if (!sessions[phone]) {
    sessions[phone] = {
      estado: "MENU_INICIAL",
      datosFactura: {},
    };
  }
  return sessions[phone];
};

const deleteSession = (phone) => {
  delete sessions[phone];
};

module.exports = {
  getSession,
  deleteSession,
};
