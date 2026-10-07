import { Order } from '../types';

function formatPdfCurrency(amount: number | string | undefined | null, currency: string = 'NGN'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  if (currency === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  return `NGN ${Math.round(safeAmount).toLocaleString('en-US')}`;
}

export async function generateOrderReceiptPDF(order: Order): Promise<void> {
  if (typeof window === 'undefined') return;
  const { jsPDF } = await import('jspdf');

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

  const statusText = `STATUS: ${(order.status || 'PAID').replace(/_/g, ' ').toUpperCase()}`;
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, pageWidth - margin - doc.getTextWidth(statusText), 18);

  y = 34;

  // 2. Metadata Box
  const boxHeight = 34;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), boxHeight, 3, 3, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER', margin + 5, y + 8);
  doc.text('RESTAURANT', margin + 65, y + 8);
  doc.text('DELIVERY ADDRESS', margin + 125, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(order.customerName || 'Valued Customer', margin + 5, y + 15);
  doc.text(order.customerPhone || '+234 800 000 0000', margin + 5, y + 21);

  doc.text(order.restaurantName || 'Veyrang Partner Kitchen', margin + 65, y + 15);
  doc.text(`Payment: ${(order.paymentMethod || 'Wallet').toUpperCase()}`, margin + 65, y + 21);

  const splitAddress = doc.splitTextToSize(order.customerAddress || 'Lagos, Nigeria', 50);
  doc.text(splitAddress, margin + 125, y + 15);

  y += boxHeight + 8;

  // 3. Items Table Header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM DESCRIPTION & CUSTOMIZATIONS', margin + 4, y + 5.5);
  doc.text('QTY', pageWidth - margin - 45, y + 5.5, { align: 'center' });
  doc.text('PRICE', pageWidth - margin - 4, y + 5.5, { align: 'right' });

  y += 8;

  // 4. Items Rows
  doc.setFont('helvetica', 'normal');
  const items = Array.isArray(order.items) ? order.items : [];
  const curr = order.currency || 'NGN';

  items.forEach((item: any, idx: number) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(margin, y, pageWidth - (margin * 2), 12, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(item.name || item.menuItem?.name || 'Dish Item', margin + 4, y + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    
    let optStr = '';
    if (item.selectedOptions && Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
      optStr = item.selectedOptions.map((o: any) => o.name).join(', ');
    } else if (item.instructions) {
      optStr = `Note: ${item.instructions}`;
    }
    if (optStr) {
      doc.text(optStr, margin + 4, y + 9.5);
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(String(item.quantity || 1), pageWidth - margin - 45, y + 7, { align: 'center' });

    const itemTotal = (Number(item.price || 0) * Number(item.quantity || 1));
    doc.text(formatPdfCurrency(itemTotal, curr), pageWidth - margin - 4, y + 7, { align: 'right' });

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(margin, y + 12, pageWidth - margin, y + 12);

    y += 12;
  });

  y += 4;

  // 5. Summary / Totals
  const summaryX = pageWidth - margin - 70;
  const summaryWidth = 70;

  const addSummaryRow = (label: string, val: string, isBold: boolean = false, isGreen: boolean = false) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(label, summaryX, y);

    if (isGreen) {
      doc.setTextColor(5, 150, 105);
    } else {
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    }
    doc.text(val, pageWidth - margin - 4, y, { align: 'right' });
    y += 6;
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
    addSummaryRow(`Discount (${order.promoCode || 'Promo'}):`, `-${formatPdfCurrency(order.discountAmount, curr)}`, false, true);
  }
  if ((order.walletDeduction || 0) > 0) {
    addSummaryRow('Wallet Applied:', `-${formatPdfCurrency(order.walletDeduction, curr)}`, false, false);
  }

  y += 2;
  doc.setDrawColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y - 3, pageWidth - margin, y - 3);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Total Paid:', summaryX, y + 3);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(formatPdfCurrency(order.total, curr), pageWidth - margin - 4, y + 3, { align: 'right' });

  y += 16;

  // 6. Footer Note & Handover PIN Verification
  if (y > 255) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // amber-800
  doc.text(`Doorstep Handover Security PIN: ${order.handoverPin || '####'}`, margin + 4, y + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Share this 4-digit PIN with your delivery courier only upon receiving your sealed meal package.', margin + 4, y + 11.5);

  y += 24;

  doc.setFontSize(7.5);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  doc.text('Thank you for ordering with Veyrang Food Express! For support, email support@veyrang.com', pageWidth / 2, y, { align: 'center' });

  // Save PDF
  const filename = `Veyrang-Receipt-${order.shortId || order.id || 'order'}.pdf`;
  doc.save(filename);
}

export function printOrderReceiptWindow(order: Order): void {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Please allow popups to print your receipt.');
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const curr = order.currency || 'NGN';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Veyrang Receipt - ${order.shortId || order.id}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #fff; }
    .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px; }
    .logo { font-size: 20px; font-weight: 900; color: #ff5500; letter-spacing: -0.5px; }
    .subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .meta { text-align: right; font-size: 12px; color: #334155; }
    .meta-ref { font-weight: bold; color: #0f172a; font-family: monospace; }
    .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 12px; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .summary { width: 260px; margin-left: auto; font-size: 12px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; color: #64748b; }
    .summary-row.total { font-size: 14px; font-weight: bold; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 4px; }
    .pin-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #b45309; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div>
        <div class="logo">VEYRANG FOOD EXPRESS</div>
        <div class="subtitle">Official Payment & Delivery Receipt</div>
      </div>
      <div class="meta">
        <div class="meta-ref">${order.shortId || order.id}</div>
        <div>${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
        <div style="font-weight: bold; color: #ff5500; margin-top: 2px;">STATUS: ${(order.status || 'PAID').toUpperCase()}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Customer Details</div>
        <strong>${order.customerName || 'Valued Customer'}</strong><br/>
        <span style="color: #64748b;">${order.customerPhone || ''}</span>
      </div>
      <div>
        <div class="section-title">Restaurant & Payment</div>
        <strong>${order.restaurantName || 'Veyrang Partner'}</strong><br/>
        <span style="color: #64748b;">Method: ${(order.paymentMethod || 'Wallet').toUpperCase()}</span>
      </div>
    </div>

    <div class="pin-box">
      <strong>🔑 Doorstep Handover PIN: ${order.handoverPin || '####'}</strong>
      <div style="font-size: 11px; margin-top: 2px;">Show this secret code to your courier rider upon receiving your package.</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((i: any) => `
          <tr>
            <td>
              <strong>${i.name || i.menuItem?.name || 'Item'}</strong>
              ${i.selectedOptions?.length ? `<div style="font-size: 11px; color: #64748b;">${i.selectedOptions.map((o: any) => o.name).join(', ')}</div>` : ''}
            </td>
            <td style="text-align: center;">${i.quantity || 1}</td>
            <td style="text-align: right; font-family: monospace;">${formatPdfCurrency((Number(i.price || 0) * Number(i.quantity || 1)), curr)}</td>
          </tr>
        `).join('')}
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
