const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

async function buscarTicketPorFolio(folio) {
  const records = await base("Ventas")
    .select({
      filterByFormula: `{Folio} = "${folio}"`,
    })
    .firstPage();

  if (records.length === 0) return null;

  return records[0].fields;
}

module.exports = { buscarTicketPorFolio };
