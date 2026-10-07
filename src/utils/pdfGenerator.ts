import { jsPDF } from 'jspdf';
import { Order } from '../types';

function formatPdfCurrency(amount: number | string | undefined | null, currency: string = 'NGN'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  if (currency === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  return `NGN ${Math.round(safeAmount).toLocaleString('en-US')}`;
}

export function generateOrderReceiptPDF(order: Order): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  const primaryColor = [255, 85, 0]; // #FF5500
  const darkColor = [15, 23, 42]; // slate-900
  const grayColor = [100, 116, 139]; // slate-500
  const lightBg = [248, 250, 252]; // slate-50
  const borderColor = [226, 232, 240]; // slate-200

  // 1. Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VEYRANG FOOD EXPRESS', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text('OFFICIAL ITEMIZED PAYMENT RECEIPT', margin, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 120, 50);
  const refText = `Ref: ${order.transactionRef || order.shortId || order.id}`;
  doc.text(refText, pageWidth - margin - doc.getTextWidth(refText), 12);

  const statusText = `STATUS: ${(order.status || 'PAID').toUpperCase()}`;
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pageWidth - margin - doc.getTextWidth(statusText), 18);

  y = 34;

  // 2. Metadata Box
  const boxHeight = 34;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 3, 3, 'FD');

  const halfWidth = (pageWidth - margin * 2) / 2;

  // Merchant Info
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESTAURANT MERCHANT', margin + 5, y + 6);

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(10);
  doc.text(order.restaurantName || 'Veyrang Partner Kitchen', margin + 5, y + 11);

  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(8);
  doc.text('ORDER DATE & TIME', margin + 5, y + 18);

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(9);
  const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();
  doc.text(formattedDate, margin + 5, y + 23);

  // Customer Info
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER & DESTINATION', margin + halfWidth + 5, y + 6);

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(9);
  doc.text(`${order.customerName} (${order.customerPhone})`, margin + halfWidth + 5, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const addrStr = `${order.customerAddress || 'Customer Address'}${order.customerApartment ? ` (${order.customerApartment})` : ''}`;
  const splitAddr = doc.splitTextToSize(addrStr, halfWidth - 10);
  doc.text(splitAddr, margin + halfWidth + 5, y + 16);

  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text(`Payment Method: ${order.paymentMethod || 'Wallet'} (${order.paymentStatus || 'paid'})`, margin + halfWidth + 5, y + 28);

  y += boxHeight + 8;

  // 3. Items Table Header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('ITEM DESCRIPTION', margin + 4, y + 5);
  doc.text('QTY', margin + 115, y + 5);
  doc.text('AMOUNT', pageWidth - margin - 4, y + 5, { align: 'right' });

  y += 7;

  // 4. Items List
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  const curr = order.currency || 'NGN';

  (order.items || []).forEach((item, i) => {
    const itemName = item?.menuItem?.name || (item as any)?.name || 'Dish Item';
    const itemTotal = item.itemTotal || (item.menuItem?.price || 0) * (item.quantity || 1);
    const optionsText = item.selectedOptions && item.selectedOptions.length > 0
      ? `+ ${item.selectedOptions.map((o) => o.optionName).join(', ')}`
      : '';

    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - margin * 2, optionsText ? 11 : 7, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.text(itemName, margin + 4, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.text(String(item.quantity || 1), margin + 115, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(formatPdfCurrency(itemTotal, curr), pageWidth - margin - 4, y + 4.5, { align: 'right' });

    if (optionsText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(optionsText, margin + 4, y + 8.5);
      doc.setFontSize(9);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      y += 11;
    } else {
      y += 7;
    }
  });

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 6;

  // 5. Financial Summary Breakdown
  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;
  const valX = pageWidth - margin - 4;

  const addSummaryRow = (label: string, valStr: string, isBold = false, isHighlight = false) => {
    if (isHighlight) {
      doc.setFillColor(255, 241, 235);
      doc.rect(summaryX, y - 1, summaryWidth, 7.5, 'F');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    } else {
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    }

    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.text(label, summaryX + 2, y + 4);
    doc.text(valStr, valX, y + 4, { align: 'right' });
    y += 6.5;
  };

  addSummaryRow('Subtotal:', formatPdfCurrency(order.subtotal, curr));
  addSummaryRow('Delivery Fee:', formatPdfCurrency(order.deliveryFee, curr));

  if ((order.serviceFee || 0) > 0) {
    addSummaryRow('Service & Tech Fee:', formatPdfCurrency(order.serviceFee, curr));
  }
  if ((order.tip || 0) > 0) {
    addSummaryRow('Driver Tip:', formatPdfCurrency(order.tip, curr));
  }
  if ((order.discountAmount || 0) > 0) {
    addSummaryRow(`Discount (${order.promoCode || 'Promo'}):`, `- ${formatPdfCurrency(order.discountAmount, curr)}`);
  }
  if ((order.walletDeduction || 0) > 0) {
    addSummaryRow('Wallet Balance Applied:', `- ${formatPdfCurrency(order.walletDeduction, curr)}`);
  }

  y += 2;
  addSummaryRow('TOTAL AMOUNT PAID:', formatPdfCurrency(order.total, curr), true, true);

  // 6. Footer
  y = Math.max(y + 12, 265);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.line(margin, y, pageWidth - margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Thank you for ordering with Veyrang Food Express!', pageWidth / 2, y + 5, { align: 'center' });
  doc.text('For support or feedback, please contact support@veyrang.com', pageWidth / 2, y + 9, { align: 'center' });

  // Download PDF file
  const filename = `Veyrang-Receipt-${order.transactionRef || order.shortId || order.id}.pdf`;
  doc.save(filename);
}

export function printOrderReceiptWindow(order: Order): void {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    // Fallback if popups blocked
    window.print();
    return;
  }

  const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();
  const curr = order.currency || 'NGN';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${order.transactionRef || order.shortId || order.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
    .receipt-container { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff5500; padding-bottom: 16px; margin-bottom: 20px; }
    .brand { font-size: 20px; font-weight: 800; color: #ff5500; text-transform: uppercase; letter-spacing: 0.5px; }
    .subhead { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .ref { font-family: monospace; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 12px; }
    .section-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .val { font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #0f172a; color: white; text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    th:last-child { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    td:last-child { text-align: right; font-family: monospace; font-weight: 700; }
    .summary { width: 260px; margin-left: auto; font-size: 12px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569; }
    .summary-row.total { font-size: 14px; font-weight: 800; color: #ff5500; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; }
    @media print {
      body { padding: 0; }
      .receipt-container { border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div>
        <div class="brand">VEYRANG FOOD EXPRESS</div>
        <div class="subhead">Official Payment Receipt & Invoice</div>
      </div>
      <div class="ref">
        Ref: ${order.transactionRef || order.shortId || order.id}<br/>
        <span style="font-size: 11px; color: #ff5500;">STATUS: ${(order.status || 'PAID').toUpperCase()}</span>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Merchant / Restaurant</div>
        <div class="val">${order.restaurantName || 'Veyrang Partner Kitchen'}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${order.restaurantAddress || ''}</div>
        <div class="section-title" style="margin-top: 8px;">Date & Time</div>
        <div class="val">${formattedDate}</div>
      </div>
      <div>
        <div class="section-title">Delivery Customer</div>
        <div class="val">${order.customerName} (${order.customerPhone})</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          ${order.customerAddress || ''} ${order.customerApartment ? `(${order.customerApartment})` : ''}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
          Paid via <strong>${order.paymentMethod || 'Wallet'}</strong> (${order.paymentStatus || 'paid'})
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align: center;">Qty</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(order.items || []).map((item) => {
          const itemName = item?.menuItem?.name || (item as any)?.name || 'Dish Item';
          const itemTotal = item.itemTotal || (item.menuItem?.price || 0) * (item.quantity || 1);
          const optionsText = item.selectedOptions && item.selectedOptions.length > 0
            ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">+ ${item.selectedOptions.map((o) => o.optionName).join(', ')}</div>`
            : '';
          return `
            <tr>
              <td>
                <div style="font-weight: 700;">${itemName}</div>
                ${optionsText}
              </td>
              <td style="text-align: center; font-weight: 600;">${item.quantity || 1}</td>
              <td>${formatPdfCurrency(itemTotal, curr)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row">
        <span>Items Subtotal:</span>
        <span style="font-family: monospace;">${formatPdfCurrency(order.subtotal, curr)}</span>
      </div>
      <div class="summary-row">
        <span>Delivery Fee:</span>
        <span style="font-family: monospace;">${formatPdfCurrency(order.deliveryFee, curr)}</span>
      </div>
      ${(order.serviceFee || 0) > 0 ? `
        <div class="summary-row">
          <span>Service & Tech Fee:</span>
          <span style="font-family: monospace;">${formatPdfCurrency(order.serviceFee, curr)}</span>
        </div>
      ` : ''}
      ${(order.tip || 0) > 0 ? `
        <div class="summary-row">
          <span>Driver Tip:</span>
          <span style="font-family: monospace;">${formatPdfCurrency(order.tip, curr)}</span>
        </div>
      ` : ''}
      ${(order.discountAmount || 0) > 0 ? `
        <div class="summary-row" style="color: #059669;">
          <span>Discount (${order.promoCode || 'Promo'}):</span>
          <span style="font-family: monospace;">-${formatPdfCurrency(order.discountAmount, curr)}</span>
        </div>
      ` : ''}
      ${(order.walletDeduction || 0) > 0 ? `
        <div class="summary-row" style="color: #c2410c;">
          <span>Wallet Applied:</span>
          <span style="font-family: monospace;">-${formatPdfCurrency(order.walletDeduction, curr)}</span>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total Amount Paid:</span>
        <span style="font-family: monospace;">${formatPdfCurrency(order.total, curr)}</span>
      </div>
    </div>

    <div class="footer">
      Thank you for ordering with Veyrang Food Express!<br/>
      Need help? Contact support@veyrang.com
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
