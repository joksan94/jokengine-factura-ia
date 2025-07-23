const regimenesFiscales = {
  personaFisica: {
    605: "Sueldos y Salarios e Ingresos Asimilados a Salarios",
    606: "Arrendamiento",
    608: "Demás ingresos",
    611: "Ingresos por Dividendos (socios y accionistas)",
    612: "Personas Físicas con Actividades Empresariales y Profesionales",
    614: "Ingresos por intereses",
    615: "Obtención de premios",
    616: "Sin obligaciones fiscales",
    621: "Incorporación Fiscal",
    622: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
    625: "Plataformas Tecnológicas",
    626: "Régimen Simplificado de Confianza",
  },
  personaMoral: {
    601: "General de Ley Personas Morales",
    603: "Personas Morales con Fines no Lucrativos",
    609: "Consolidación",
    610: "Residentes en el Extranjero",
    620: "Sociedades Cooperativas",
    623: "Grupos de Sociedades",
    624: "Coordinados",
  },
};

const usosCfdi = {
  S01: "Sin efectos fiscales",
  G01: "Adquisición de mercancías",
  G02: "Devoluciones o descuentos",
  G03: "Gastos en general",
  I01: "Construcciones",
  I02: "Equipo oficina",
  I03: "Transporte",
  I04: "Computadoras",
  D01: "Honorarios médicos",
  D02: "Incapacidad",
  D03: "Gastos funerarios",
  D04: "Donativos",
  P01: "Por definir",
};

const popularesPersonaFisica = [
  "605",
  "606",
  "612",
  "621",
  "626",
  "608",
  "614",
  "615",
  "616",
  "625",
];

const popularesPersonaMoral = ["601", "603", "610", "620", "624", "609", "623"];

module.exports = {
  regimenesFiscales,
  usosCfdi,
  popularesPersonaFisica,
  popularesPersonaMoral,
};
