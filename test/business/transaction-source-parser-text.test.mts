import assert from "node:assert/strict";
import test from "node:test";
import { cellDisplayValue } from "../../src/lib/business/transaction-source-parser.ts";
import { readTransactionValidationSource } from "../../src/lib/business/transaction-validation-source.ts";
import { asArrayBuffer, createZip } from "../helpers/zip-crc.ts";

function cdataAndCommentXlsx() {
  return createZip([
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets><sheet name="Payments" sheetId="1" r:id="rId1"/></sheets>
        </workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1"
            Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
            Target="worksheets/sheet1.xml"/>
        </Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
          <!-- <si><t>COMMENTED-FAKE-ENTRY</t></si> -->
          <si><t>Email</t></si>
          <si><t>Date</t></si>
          <si><t>Amount</t></si>
          <si><t><![CDATA[buyer&amp;raw@example.com]]></t></si>
          <si><t><![CDATA[2026-08-23]]></t></si>
          <si><t><![CDATA[1&amp;2]]></t></si>
        </sst>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="C1" t="s"><v>1</v></c>
            <c r="E1" t="s"><v>2</v></c>
          </row>
          <row r="2">
            <c r="A2" t="s"><v>3</v></c>
            <c r="C2" t="s"><v>4</v></c>
            <c r="E2" t="s"><v>5</v></c>
          </row>
        </sheetData></worksheet>`,
    },
  ]);
}

test("Task 19 preserves entity-looking text inside inline-string CDATA", () => {
  const value = cellDisplayValue(
    '<c t="inlineStr">',
    '<is><t><![CDATA[A&amp;B]]></t></is>',
    [],
    { dateStyleIndexes: new Set() },
    false,
  );

  assert.equal(value, "A&amp;B");
});

test("Task 19 ignores commented shared-string markup and preserves CDATA contents", async () => {
  const bytes = cdataAndCommentXlsx();
  const source = await readTransactionValidationSource({
    fileName: "cdata-comments.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 2, 4],
  });

  assert.deepEqual(source.rows[0], { rowNumber: 1, values: ["Email", "Date", "Amount"] });
  assert.deepEqual(source.rows[1], {
    rowNumber: 2,
    values: ["buyer&amp;raw@example.com", "2026-08-23", "1&amp;2"],
  });
});
