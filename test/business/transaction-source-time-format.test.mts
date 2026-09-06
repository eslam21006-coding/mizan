import assert from "node:assert/strict";
import test from "node:test";
import { readTransactionValidationSource } from "../../src/lib/business/transaction-validation-source.ts";
import { asArrayBuffer, createZip } from "../helpers/zip-crc.ts";

function xlsxTimeFormatCases() {
  return createZip([
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <workbookPr date1904="0"/>
          <sheets><sheet name="Payments" sheetId="1" r:id="rId1"/></sheets>
        </workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
        </Relationships>`,
    },
    {
      name: "xl/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <numFmts count="1">
            <numFmt numFmtId="164" formatCode="0\\h"/>
          </numFmts>
          <cellXfs count="3">
            <xf numFmtId="0"/>
            <xf numFmtId="20"/>
            <xf numFmtId="164"/>
          </cellXfs>
        </styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1">
            <c r="A1" t="inlineStr"><is><t>builtin-time</t></is></c>
            <c r="C1" s="1"><v>0.5</v></c>
          </row>
          <row r="2">
            <c r="A2" t="inlineStr"><is><t>escaped-literal</t></is></c>
            <c r="C2" s="2"><v>0.5</v></c>
          </row>
        </sheetData></worksheet>`,
    },
  ]);
}

test("XLSX time styles decode clock serials while escaped format literals remain numeric", async () => {
  const bytes = xlsxTimeFormatCases();
  const source = await readTransactionValidationSource({
    fileName: "time-format-cases.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 2],
  });

  assert.deepEqual(source.rows[0]?.values, ["builtin-time", "12:00:00"]);
  assert.deepEqual(source.rows[1]?.values, ["escaped-literal", "0.5"]);
});
