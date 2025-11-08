const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

async function actualizarEstadoFacturacion(folio, nuevoEstado = "Facturado") {
  // Busca el recordId del folio
  const records = await base("Ventas")
    .select({ filterByFormula: `{Folio} = "${folio}"` })
    .firstPage();
  if (records.length === 0) return false;
  const recordId = records[0].id;
  await base("Ventas").update(recordId, {
    "Estado de Facturación": nuevoEstado,
  });
  return true;
}

module.exports = { actualizarEstadoFacturacion };
