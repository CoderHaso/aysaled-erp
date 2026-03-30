import soap from 'soap';

async function testConstruct() {
  const url = 'https://edonusumapi.uyum.com.tr/Services/Integration?wsdl';
  const client = await soap.createClientAsync(url);
  
  const ublXml = `
    <Invoice xmlns="http://tempuri.org/"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
      <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
      <cac:AccountingSupplierParty>
        <cac:Party>
          <cac:PartyIdentification><cbc:ID schemeID="VKN">1231009459</cbc:ID></cac:PartyIdentification>
        </cac:Party>
      </cac:AccountingSupplierParty>
    </Invoice>
  `;

  // Prevent actually triggering by just doing what node-soap does behind the scenes, or cause validation error safely
  client.on('request', (xml) => {
    import('fs').then(fs => fs.writeFileSync('last_request_xml.xml', xml));
  });

  try {
    const wsSecurity = new soap.WSSecurity('', '', { hasTimeStamp: false, hasTokenCreated: false });
    client.setSecurity(wsSecurity);
    await client.SaveAsDraftAsync({
      invoices: {
        InvoiceInfo: [{
          $xml: ublXml,
          attributes: { LocalDocumentId: 'MNL-2026-003' }
        }]
      }
    });
  } catch(e) {}
}

testConstruct();
