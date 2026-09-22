import { StatutoryDocument } from "../types";

/**
 * Initiates print / PDF generation for a statutory document (Annual Report or Audited Statement).
 */
export function printStatutoryDocument(
  doc: StatutoryDocument,
  type: "Annual Report" | "Audited Statement",
  yearLabel: string
): void {
  // If file_data contains real PDF data, print via iframe
  if (doc.file_data && doc.file_data.length > 50) {
    const pdfSrc = doc.file_data.startsWith("data:")
      ? doc.file_data
      : `data:application/pdf;base64,${doc.file_data}`;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.src = pdfSrc;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          const w = window.open(pdfSrc, "_blank");
          if (w) {
            w.focus();
            w.print();
          }
        }
      }, 400);
    };
    return;
  }

  // Fallback: Generate an official Printable Verification Sheet
  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    window.print();
    return;
  }

  const uploadDate = new Date(doc.uploaded_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>ERBSG - ${type} - ${doc.file_name}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            line-height: 1.5;
            margin: 0;
            padding: 24px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .header h1 {
            color: #1e3a8a;
            font-size: 18pt;
            margin: 0 0 4px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header h2 {
            color: #334155;
            font-size: 13pt;
            margin: 0 0 4px 0;
            font-weight: 600;
          }
          .header p {
            color: #64748b;
            font-size: 9pt;
            margin: 0;
          }
          .badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 10pt;
            font-weight: bold;
            margin-top: 8px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .meta-table th, .meta-table td {
            padding: 10px 14px;
            font-size: 10pt;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
          }
          .meta-table th {
            background-color: #f8fafc;
            color: #475569;
            width: 35%;
            font-weight: 600;
          }
          .meta-table td {
            color: #0f172a;
            font-weight: 500;
          }
          .stamp-box {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .sig-line {
            width: 220px;
            border-top: 1px dashed #64748b;
            text-align: center;
            padding-top: 8px;
            font-size: 9pt;
            color: #475569;
          }
          .footer {
            margin-top: 60px;
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
            text-align: center;
            font-size: 8pt;
            color: #94a3b8;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Eastern Railway Bharat Scouts and Guides</h1>
          <h2>Official Statutory Document Verification • ${type}</h2>
          <p>State Headquarters: Fairlie Place, 17 Netaji Subhas Road, Kolkata - 700001</p>
          <div class="badge">${yearLabel} Academic Session</div>
        </div>

        <table class="meta-table">
          <tr>
            <th>Document Classification</th>
            <td><strong>${type}</strong> (Official Statutory Filing)</td>
          </tr>
          <tr>
            <th>File Name</th>
            <td>${doc.file_name}</td>
          </tr>
          <tr>
            <th>District</th>
            <td>${doc.district_name || doc.district_id || "Eastern Railway State"}</td>
          </tr>
          <tr>
            <th>Academic Session</th>
            <td>${yearLabel}</td>
          </tr>
          <tr>
            <th>Version</th>
            <td>v${doc.version || 1} (Official Approved Copy)</td>
          </tr>
          <tr>
            <th>Filing Officer</th>
            <td>${doc.uploaded_by}</td>
          </tr>
          <tr>
            <th>Filing Timestamp</th>
            <td>${uploadDate}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td><strong style="color: #059669;">✓ Verified & Filed in State Records</strong></td>
          </tr>
        </table>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-top: 20px; font-size: 9pt; color: #475569;">
          <strong>Statutory Compliance Confirmation:</strong><br />
          This document represents the authenticated statutory submission deposited under the rules and regulations of Eastern Railway Bharat Scouts and Guides for the academic session ${yearLabel}.
        </div>

        <div class="stamp-box">
          <div class="sig-line">
            District Secretary / Leader<br/>
            ${doc.district_name || "District Headquarters"}
          </div>
          <div class="sig-line">
            State Administrator / Secretary<br/>
            ERBSG State Headquarters, Kolkata
          </div>
        </div>

        <div class="footer">
          Generated via ERBSG Official Data Control Portal on ${new Date().toLocaleString("en-IN")} • Document ID: ${doc.id}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Generates and prints a full tabular statutory report for all filtered reports/statements.
 */
export function printStatutorySummaryTable(
  documents: StatutoryDocument[],
  type: "Annual Report" | "Audited Statement",
  yearLabel: string,
  isStateAdmin: boolean
): void {
  const printWindow = window.open("", "_blank", "width=900,height=950");
  if (!printWindow) {
    window.print();
    return;
  }

  const rowsHtml = documents
    .map(
      (doc, index) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${doc.file_name} (v${doc.version || 1})</td>
        ${isStateAdmin ? `<td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${doc.district_name || doc.district_id}</td>` : ""}
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${doc.year_id}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${doc.uploaded_by}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${new Date(doc.uploaded_at).toLocaleDateString()}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #059669; font-weight: bold;">Verified</td>
      </tr>
    `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>ERBSG - ${type} Submission Register</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            line-height: 1.4;
            padding: 16px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header h1 {
            color: #1e3a8a;
            font-size: 16pt;
            margin: 0;
            text-transform: uppercase;
          }
          .header h2 {
            color: #334155;
            font-size: 12pt;
            margin: 4px 0 0 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-top: 14px;
          }
          th {
            background-color: #1e3a8a;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
          }
          th.center, td.center { text-align: center; }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
            font-size: 8pt;
            color: #64748b;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Eastern Railway Bharat Scouts and Guides</h1>
          <h2>Official ${type} Statutory Submission Register • Academic Session ${yearLabel}</h2>
        </div>

        <table>
          <thead>
            <tr>
              <th class="center" style="width: 45px;">SL</th>
              <th>Document Name</th>
              ${isStateAdmin ? "<th>District</th>" : ""}
              <th class="center">Year</th>
              <th>Filed By</th>
              <th class="center">Date</th>
              <th class="center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <span>Official Eastern Railway Bharat Scouts & Guides Portal</span>
          <span>Printed on ${new Date().toLocaleString("en-IN")} • Total Filings: ${documents.length}</span>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
