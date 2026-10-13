import type { DeliveryOrder } from './types';
import { formatCurrency, formatDateTime } from './format';

const statusLabels: Record<string, string> = {
  aguardando: 'Aguardando',
  saiu_entrega: 'Saiu para Entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export function generatePrintHTML(order: DeliveryOrder): string {
  const itemsHTML = (order.items ?? [])
    .map(
      (item) => `
${item.quantidade}x ${item.produto_nome}
${item.descricao ? `Descrição:\n${item.descricao}\n` : ''}Valor: ${formatCurrency(Number(item.subtotal))}
`
    )
    .join('\n--------------------------------\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha de Entrega #${order.numero_pedido}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.6;
  }
  h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 14px; text-align: center; font-weight: normal; color: #64748b; margin-bottom: 12px; }
  .divider { border-top: 1px dashed #94a3b8; margin: 12px 0; }
  .section-title { font-weight: bold; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; }
  .field-value { margin-bottom: 8px; }
  .total { font-size: 18px; font-weight: bold; text-align: center; margin: 8px 0; }
  .signature { margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 4px; text-align: center; font-size: 11px; color: #64748b; }
  .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #64748b; }
  .item-block { margin: 8px 0; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
  <h1>PIZZASTOCKAI - FICHA DE ENTREGA</h1>
  <h2>Controle Inteligente de Vendas e Entregas</h2>

  <div class="divider"></div>

  <p><strong>Pedido Nº:</strong> ${order.numero_pedido}</p>
  <p><strong>Data:</strong> ${formatDateTime(order.data_pedido)}</p>

  <div class="divider"></div>

  <div class="section-title">CLIENTE:</div>
  <div class="field-value">${order.cliente_nome}</div>

  <div class="section-title">TELEFONE:</div>
  <div class="field-value">${order.cliente_telefone}</div>

  <div class="section-title">ENDEREÇO:</div>
  <div class="field-value">${order.cliente_endereco}${order.complemento ? '<br>' + order.complemento : ''}${order.bairro ? '<br>' + order.bairro : ''}</div>

  ${order.observacao ? `<div class="section-title">OBSERVAÇÃO:</div><div class="field-value">${order.observacao}</div>` : ''}

  <div class="divider"></div>

  <div class="section-title">PRODUTOS</div>
  ${(order.items ?? [])
    .map(
      (item) => `
    <div class="item-block">
      <strong>${item.quantidade}x ${item.produto_nome}</strong>
      ${item.descricao ? `<br>Descrição:<br>${item.descricao}` : ''}
      <br>Valor: ${formatCurrency(Number(item.subtotal))}
    </div>
  `
    )
    .join('<div class="divider"></div>')}

  <div class="divider"></div>

  <p><strong>Taxa de Entrega:</strong> ${formatCurrency(Number(order.taxa_entrega))}</p>

  <div class="section-title">MOTOBOY:</div>
  <div class="field-value">${order.motoboy ?? '—'}</div>

  <div class="section-title">STATUS:</div>
  <div class="field-value">${statusLabels[order.status_entrega] ?? order.status_entrega}</div>

  <div class="divider"></div>

  <div class="total">TOTAL: ${formatCurrency(Number(order.valor_total))}</div>

  <div class="divider"></div>

  <div class="section-title">Assinatura Cliente:</div>
  <div class="signature">____________________________</div>

  <div class="divider"></div>

  <div class="footer">
    PIZZASTOCKAI<br>
    Controle Inteligente de Vendas e Entregas
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}

export function printOrder(order: DeliveryOrder) {
  const html = generatePrintHTML(order);
  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (!printWindow) {
    alert('Permita popups para imprimir a ficha de entrega.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}

export function exportPDF(order: DeliveryOrder) {
  const html = generatePrintHTML(order);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ficha-entrega-${order.numero_pedido}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(orders: DeliveryOrder[]) {
  const headers = [
    'Número Pedido',
    'Data',
    'Cliente',
    'Telefone',
    'Endereço',
    'Produto',
    'Descrição',
    'Quantidade',
    'Valor Unitário',
    'Valor Total',
    'Motoboy',
    'Status da Entrega',
  ];

  const rows: string[] = [headers.join(';')];

  orders.forEach((order) => {
    const items = order.items ?? [];
    if (items.length === 0) {
      rows.push(
        [
          order.numero_pedido,
          formatDateTime(order.data_pedido),
          order.cliente_nome,
          order.cliente_telefone,
          order.cliente_endereco,
          '',
          '',
          '',
          '',
          formatCurrency(Number(order.valor_total)).replace(/[^\d.,]/g, ''),
          order.motoboy ?? '',
          statusLabels[order.status_entrega] ?? order.status_entrega,
        ]
          .map((v) => String(v).replace(/;/g, ','))
          .join(';')
      );
    } else {
      items.forEach((item) => {
        rows.push(
          [
            order.numero_pedido,
            formatDateTime(order.data_pedido),
            order.cliente_nome,
            order.cliente_telefone,
            order.cliente_endereco,
            item.produto_nome,
            item.descricao ?? '',
            item.quantidade,
            Number(item.valor_unitario).toFixed(2),
            Number(item.subtotal).toFixed(2),
            order.motoboy ?? '',
            statusLabels[order.status_entrega] ?? order.status_entrega,
          ]
            .map((v) => String(v).replace(/;/g, ','))
            .join(';')
        );
      });
    }
  });

  const csv = '\uFEFF' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `entregas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
