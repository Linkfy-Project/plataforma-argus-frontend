/**
 * Geração de relatórios PDF enriquecidos para a Plataforma ARGUS.
 *
 * Usa jsPDF + jspdf-autotable para gerar PDFs branded com:
 * - Cabeçalho com logo/título ARGUS
 * - Resumo executivo expandido (8 KPIs)
 * - Análise de distribuição (status, município, faixa de valor)
 * - Top Construtoras
 * - Distribuição de risco (barras + tabela detalhada)
 * - Análise de alertas por severidade
 * - Fila de prioridade — obras críticas
 * - Tabela geral de obras
 * - Recomendações automáticas expandidas
 * - Rodapé com paginação
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHookData } from "jspdf-autotable";
import type { WorkRead, AlertRead } from "@/types";
import { getRiskLevel } from "@/lib/score";

/* ─── Cores da marca ─────────────────────────────────────────────────────── */
const BRAND_COLOR: [number, number, number] = [30, 58, 138]; // azul escuro
const ACCENT_COLOR: [number, number, number] = [59, 130, 246]; // azul primário
const DANGER_COLOR: [number, number, number] = [220, 38, 38]; // vermelho
const SUCCESS_COLOR: [number, number, number] = [34, 197, 94]; // verde
const WARNING_COLOR: [number, number, number] = [245, 158, 11]; // amarelo
const ORANGE_COLOR: [number, number, number] = [249, 115, 22]; // laranja
const TEXT_COLOR: [number, number, number] = [51, 65, 85]; // slate-700
const MUTED_COLOR: [number, number, number] = [100, 116, 139]; // slate-500

/* ─── Tipos locais ───────────────────────────────────────────────────────── */
interface ReportOptions {
  title: string;
  subtitle?: string;
  municipio?: string;
  works: WorkRead[];
  includeRecommendations?: boolean;
}

interface ContractorSummary {
  name: string;
  count: number;
  totalValue: number;
  avgScore: number;
}

interface MunicipalitySummary {
  name: string;
  count: number;
  totalValue: number;
  avgScore: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Formata valor monetário em R$ com separadores brasileiros. */
function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formata valor compacto (k / M). */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

/** Normaliza o status da obra para uma das categorias conhecidas. */
function normalizeStatus(work: WorkRead): string {
  const raw = (work.status ?? "").toLowerCase().trim();
  if (raw.includes("conclu") || raw.includes("finaliz")) return "Concluída";
  if (raw.includes("atras") || raw.includes("vencid")) return "Atrasada";
  if (raw.includes("paralis") || raw.includes("suspens")) return "Paralisada";
  if (raw.includes("planejad") || raw.includes("licitaç") || raw.includes("licita"))
    return "Planejada";
  if (raw.includes("andamento") || raw.includes("execuç") || raw.includes("execu"))
    return "Em andamento";
  // Fallback: se tem finished_at é concluída, senão em andamento
  if (work.finished_at) return "Concluída";
  return "Em andamento";
}

/** Verifica se a obra está atrasada (data vencida e não finalizada). */
function isDelayed(work: WorkRead): boolean {
  if (!work.due_at) return false;
  return new Date(work.due_at) < new Date() && !work.finished_at;
}

/** Cor do nível de risco. */
function getRiskColor(score: number | null | undefined): [number, number, number] {
  if (score == null) return [148, 163, 184];
  if (score >= 80) return SUCCESS_COLOR;
  if (score >= 60) return WARNING_COLOR;
  if (score >= 40) return ORANGE_COLOR;
  return DANGER_COLOR;
}

/** Cor da severidade do alerta. */
function getSeverityColor(severity: string): [number, number, number] {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical" || s === "danger" || s === "crítico") return DANGER_COLOR;
  if (s === "alert" || s === "high" || s === "alto") return ORANGE_COLOR;
  if (s === "warning" || s === "warn" || s === "atenção" || s === "medium") return WARNING_COLOR;
  return ACCENT_COLOR;
}

/** Label em português para severidade. */
function getSeverityLabel(severity: string): string {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical" || s === "danger" || s === "crítico") return "Crítico";
  if (s === "alert" || s === "high" || s === "alto") return "Alto";
  if (s === "warning" || s === "warn" || s === "atenção" || s === "medium") return "Médio";
  return "Baixo";
}

/** Verifica se precisa de nova página, adiciona se necessário e retorna Y. */
function ensurePageSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

/** Cria um título de seção padronizado. */
function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 15, y);
  // Linha decorativa abaixo
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...ACCENT_COLOR);
  doc.setLineWidth(0.5);
  doc.line(15, y + 2, pageWidth - 15, y + 2);
  return y + 10;
}

/* ─── SEÇÃO 1: Header ────────────────────────────────────────────────────── */

function addHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Barra superior azul
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Título ARGUS
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ARGUS", 15, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Plataforma de Monitoramento de Obras Públicas", 15, 28);

  // Título do relatório à direita
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, pageWidth - titleWidth - 15, 18);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subWidth = doc.getTextWidth(subtitle);
    doc.text(subtitle, pageWidth - subWidth - 15, 27);
  }

  // Data de geração
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  const dateStr = `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  doc.text(dateStr, pageWidth - doc.getTextWidth(dateStr) - 15, 35);

  return 50;
}

/* ─── SEÇÃO 2: Resumo Executivo (EXPANDIDO) ──────────────────────────────── */

function addSummarySection(doc: jsPDF, works: WorkRead[], y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  y = addSectionTitle(doc, "1. Resumo Executivo", y);

  const totalWorks = works.length;
  const avgScore = works.reduce((s, w) => s + (w.efficiency_score ?? 0), 0) / (totalWorks || 1);
  const critical = works.filter((w) => (w.efficiency_score ?? 100) < 40).length;
  const delayed = works.filter(isDelayed).length;
  const totalContractValue = works.reduce((s, w) => s + (w.contract_value ?? 0), 0);
  const totalPaidValue = works.reduce((s, w) => s + (w.paid_value ?? 0), 0);
  const avgExecPct =
    totalContractValue > 0 ? Math.round((totalPaidValue / totalContractValue) * 100) : 0;
  const totalAlerts = works.reduce((s, w) => s + (w.alerts?.length ?? 0), 0);

  // Cards de resumo — 2 linhas de 4
  const cardWidth = (pageWidth - 40) / 4;
  const cardHeight = 22;
  const gap = 3;

  const row1 = [
    { label: "Obras Monitoradas", value: String(totalWorks), color: BRAND_COLOR },
    {
      label: "Score Médio ARGUS",
      value: `${Math.round(avgScore)}/100`,
      color: getRiskColor(avgScore),
    },
    { label: "Obras Críticas", value: String(critical), color: DANGER_COLOR },
    { label: "Obras Atrasadas", value: String(delayed), color: WARNING_COLOR },
  ];

  const row2 = [
    {
      label: "Valor Total Contratado",
      value: formatCompact(totalContractValue),
      color: BRAND_COLOR,
    },
    {
      label: "Valor Total Pago/Executado",
      value: formatCompact(totalPaidValue),
      color: ACCENT_COLOR,
    },
    {
      label: "% Médio Execução Financeira",
      value: `${avgExecPct}%`,
      color: avgExecPct < 20 ? DANGER_COLOR : avgExecPct < 50 ? WARNING_COLOR : SUCCESS_COLOR,
    },
    {
      label: "Total de Alertas Ativos",
      value: String(totalAlerts),
      color: totalAlerts > 0 ? ORANGE_COLOR : SUCCESS_COLOR,
    },
  ];

  const drawCardRow = (cards: typeof row1, rowY: number) => {
    cards.forEach((card, i) => {
      const x = 15 + i * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, rowY, cardWidth, cardHeight, 2, 2, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, rowY, cardWidth, cardHeight, 2, 2, "S");

      doc.setTextColor(...MUTED_COLOR);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, x + 4, rowY + 7);

      doc.setTextColor(...card.color);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + 4, rowY + 17);
    });
  };

  drawCardRow(row1, y);
  y += cardHeight + gap;
  drawCardRow(row2, y);
  y += cardHeight + 6;

  // Texto narrativo do resumo
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const narrative = `Das ${totalWorks} obras monitoradas, ${critical} (${totalWorks ? Math.round((critical / totalWorks) * 100) : 0}%) encontram-se em estado crítico (score < 40) e requerem ação imediata. ${delayed} obra(s) apresentam atraso em relação ao prazo contratual. O valor total contratado é de ${formatCurrency(totalContractValue)}, com ${formatCurrency(totalPaidValue)} já executados (${avgExecPct}%).`;
  const lines = doc.splitTextToSize(narrative, pageWidth - 30);
  doc.text(lines, 15, y);

  return y + lines.length * 4 + 8;
}

/* ─── SEÇÃO 3: Análise de Distribuição (NOVO) ───────────────────────────── */

function addStatusDistribution(doc: jsPDF, works: WorkRead[], y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  y = addSectionTitle(doc, "2. Análise de Distribuição", y);

  // Sub-título: Distribuição por Status
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("2.1 Distribuição por Status", 15, y);
  y += 6;

  const statusMap = new Map<string, { count: number; totalValue: number }>();
  const statusOrder = ["Em andamento", "Concluída", "Atrasada", "Paralisada", "Planejada"];

  works.forEach((w) => {
    const status = normalizeStatus(w);
    const existing = statusMap.get(status) ?? { count: 0, totalValue: 0 };
    existing.count += 1;
    existing.totalValue += w.contract_value ?? 0;
    statusMap.set(status, existing);
  });

  const total = works.length || 1;
  const statusRows = statusOrder
    .filter((s) => statusMap.has(s))
    .map((s) => {
      const data = statusMap.get(s)!;
      return [
        s,
        String(data.count),
        `${Math.round((data.count / total) * 100)}%`,
        formatCompact(data.totalValue),
      ];
    });

  // Adicionar statuses não mapeados
  statusMap.forEach((data, s) => {
    if (!statusOrder.includes(s)) {
      statusRows.push([
        s,
        String(data.count),
        `${Math.round((data.count / total) * 100)}%`,
        formatCompact(data.totalValue),
      ]);
    }
  });

  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "Percentual", "Valor Total"]],
    body: statusRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Sub-título: Distribuição por Município (Top 10)
  y = ensurePageSpace(doc, y, 60);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("2.2 Distribuição por Município (Top 10)", 15, y);
  y += 6;

  const municipalityMap = new Map<string, MunicipalitySummary>();
  works.forEach((w) => {
    const mun = w.municipio || "Não informado";
    const existing = municipalityMap.get(mun) ?? {
      name: mun,
      count: 0,
      totalValue: 0,
      avgScore: 0,
    };
    existing.count += 1;
    existing.totalValue += w.contract_value ?? 0;
    existing.avgScore += w.efficiency_score ?? 0;
    municipalityMap.set(mun, existing);
  });

  const municipalityRows = Array.from(municipalityMap.values())
    .map((m) => ({
      ...m,
      avgScore: m.count > 0 ? Math.round(m.avgScore / m.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((m) => [
      m.name,
      String(m.count),
      `${Math.round((m.count / total) * 100)}%`,
      formatCompact(m.totalValue),
      `${m.avgScore}/100`,
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Município", "Obras", "% do Total", "Valor Total", "Score Médio"]],
    body: municipalityRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Sub-título: Distribuição por Faixa de Valor
  y = ensurePageSpace(doc, y, 60);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("2.3 Distribuição por Faixa de Valor", 15, y);
  y += 6;

  const valueBuckets = [
    { label: "Até R$500k", min: 0, max: 500_000 },
    { label: "R$500k – R$1M", min: 500_000, max: 1_000_000 },
    { label: "R$1M – R$5M", min: 1_000_000, max: 5_000_000 },
    { label: "R$5M – R$10M", min: 5_000_000, max: 10_000_000 },
    { label: "Acima de R$10M", min: 10_000_000, max: Infinity },
  ];

  const valueRows = valueBuckets
    .map((bucket) => {
      const bucketWorks = works.filter((w) => {
        const v = w.contract_value ?? 0;
        return v >= bucket.min && v < bucket.max;
      });
      return [
        bucket.label,
        String(bucketWorks.length),
        `${Math.round((bucketWorks.length / total) * 100)}%`,
        formatCompact(bucketWorks.reduce((s, w) => s + (w.contract_value ?? 0), 0)),
      ];
    })
    .filter((r) => r[1] !== "0");

  autoTable(doc, {
    startY: y,
    head: [["Faixa de Valor", "Quantidade", "Percentual", "Valor Total"]],
    body: valueRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 4: Top Construtoras (NOVO) ──────────────────────────────────── */

function addTopContractors(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 50);
  y = addSectionTitle(doc, "3. Top Construtoras", y);

  const contractorMap = new Map<string, ContractorSummary>();
  works.forEach((w) => {
    const name = w.contractor_name || "Não informada";
    const existing = contractorMap.get(name) ?? { name, count: 0, totalValue: 0, avgScore: 0 };
    existing.count += 1;
    existing.totalValue += w.contract_value ?? 0;
    existing.avgScore += w.efficiency_score ?? 0;
    contractorMap.set(name, existing);
  });

  const contractorRows = Array.from(contractorMap.values())
    .map((c) => ({
      ...c,
      avgScore: c.count > 0 ? Math.round(c.avgScore / c.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((c) => [
      c.name.length > 35 ? c.name.substring(0, 32) + "..." : c.name,
      String(c.count),
      formatCompact(c.totalValue),
      `${c.avgScore}/100`,
    ]);

  if (contractorRows.length === 0) {
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Nenhuma construtora identificada nos dados.", 15, y);
    return y + 10;
  }

  autoTable(doc, {
    startY: y,
    head: [["Construtora", "Qtd. Obras", "Valor Total Contratado", "Score Médio"]],
    body: contractorRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "center" },
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 5: Distribuição de Risco (MELHORADA) ────────────────────────── */

function addRiskDistribution(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 80);
  y = addSectionTitle(doc, "4. Distribuição de Risco", y);

  const labels: string[] = ["Baixo", "Atenção", "Alto", "Crítico"];
  const colors: [number, number, number][] = [
    SUCCESS_COLOR,
    WARNING_COLOR,
    ORANGE_COLOR,
    DANGER_COLOR,
  ];
  const counts = labels.map(
    (label) => works.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  );
  const total = works.length || 1;

  // Barras visuais
  const pageWidth = doc.internal.pageSize.getWidth();
  const barWidth = (pageWidth - 50) / 4;

  labels.forEach((label, i) => {
    const x = 15 + i * (barWidth + 3);
    const pct = Math.round((counts[i] / total) * 100);
    const barHeight = Math.max(4, (counts[i] / total) * 40);

    // Barra
    doc.setFillColor(...colors[i]);
    doc.roundedRect(x, y + 40 - barHeight, barWidth, barHeight, 1, 1, "F");

    // Label
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label, x + barWidth / 2, y + 46, { align: "center" });

    // Count + percentual
    doc.setTextColor(...colors[i]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${counts[i]} (${pct}%)`, x + barWidth / 2, y + 52, { align: "center" });
  });

  y += 60;

  // Tabela detalhada de risco com valores associados
  const riskDetailRows = labels.map((label, i) => {
    const riskWorks = works.filter((w) => getRiskLevel(w.efficiency_score) === label);
    const totalValue = riskWorks.reduce((s, w) => s + (w.contract_value ?? 0), 0);
    return [
      label,
      String(counts[i]),
      `${Math.round((counts[i] / total) * 100)}%`,
      formatCompact(totalValue),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Nível de Risco", "Obras", "Percentual", "Valor Total Associado"]],
    body: riskDetailRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.column.index === 0 && data.section === "body") {
        const risk = data.cell.raw as string;
        if (risk === "Crítico") data.cell.styles.textColor = DANGER_COLOR;
        else if (risk === "Alto") data.cell.styles.textColor = ORANGE_COLOR;
        else if (risk === "Atenção") data.cell.styles.textColor = WARNING_COLOR;
        else if (risk === "Baixo") data.cell.styles.textColor = SUCCESS_COLOR;
      }
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 6: Análise de Alertas (NOVO) ─────────────────────────────────── */

function addAlertAnalysis(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 50);
  y = addSectionTitle(doc, "5. Análise de Alertas", y);

  // Coletar todos os alertas
  const allAlerts: (AlertRead & { workDescription: string; workId: number })[] = [];
  works.forEach((w) => {
    (w.alerts ?? []).forEach((a) => {
      allAlerts.push({ ...a, workDescription: w.object_description, workId: w.id });
    });
  });

  // Contagem por severidade
  const severityOrder = ["Crítico", "Alto", "Médio", "Baixo"];
  const severityCounts = severityOrder.map((sev) => ({
    severity: sev,
    count: allAlerts.filter((a) => getSeverityLabel(a.severity) === sev).length,
  }));

  const totalAlerts = allAlerts.length;

  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total de alertas ativos: ${totalAlerts}`, 15, y);
  y += 8;

  // Tabela de severidade
  const sevRows = severityCounts
    .filter((s) => s.count > 0)
    .map((s) => [
      s.severity,
      String(s.count),
      `${Math.round((s.count / (totalAlerts || 1)) * 100)}%`,
    ]);

  if (sevRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Severidade", "Quantidade", "Percentual"]],
      body: sevRows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: {
        fillColor: BRAND_COLOR,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
      },
      didParseCell: (data: CellHookData) => {
        if (data.column.index === 0 && data.section === "body") {
          const sev = data.cell.raw as string;
          if (sev === "Crítico") data.cell.styles.textColor = DANGER_COLOR;
          else if (sev === "Alto") data.cell.styles.textColor = ORANGE_COLOR;
          else if (sev === "Médio") data.cell.styles.textColor = WARNING_COLOR;
          else data.cell.styles.textColor = ACCENT_COLOR;
        }
      },
      margin: { left: 15, right: 15 },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 5 alertas mais recentes
  y = ensurePageSpace(doc, y, 40);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Alertas Mais Recentes (Top 5)", 15, y);
  y += 6;

  const recentAlerts = [...allAlerts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  if (recentAlerts.length === 0) {
    doc.setTextColor(...MUTED_COLOR);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Nenhum alerta registrado.", 15, y);
    return y + 10;
  }

  const recentRows = recentAlerts.map((a) => [
    getSeverityLabel(a.severity),
    a.message.length > 50 ? a.message.substring(0, 47) + "..." : a.message,
    `#${a.workId} — ${a.workDescription.substring(0, 30)}`,
    new Date(a.created_at).toLocaleDateString("pt-BR"),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Severidade", "Mensagem", "Obra", "Data"]],
    body: recentRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.column.index === 0 && data.section === "body") {
        const sev = data.cell.raw as string;
        if (sev === "Crítico") data.cell.styles.textColor = DANGER_COLOR;
        else if (sev === "Alto") data.cell.styles.textColor = ORANGE_COLOR;
        else if (sev === "Médio") data.cell.styles.textColor = WARNING_COLOR;
        else data.cell.styles.textColor = ACCENT_COLOR;
      }
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 7: Obras Críticas — Fila de Prioridade (NOVO) ──────────────── */

function addCriticalWorksQueue(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 50);
  y = addSectionTitle(doc, "6. Obras Críticas — Fila de Prioridade", y);

  const criticalWorks = works
    .filter((w) => (w.efficiency_score ?? 100) < 40)
    .sort((a, b) => (a.efficiency_score ?? 0) - (b.efficiency_score ?? 0));

  if (criticalWorks.length === 0) {
    doc.setTextColor(...SUCCESS_COLOR);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nenhuma obra em estado crítico no momento.", 15, y);
    return y + 12;
  }

  doc.setTextColor(...DANGER_COLOR);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const criticalNarrative = `ATENÇÃO: ${criticalWorks.length} obra(s) com score inferior a 40 pontos, indicando situação crítica que requer intervenção imediata.`;
  const critLines = doc.splitTextToSize(criticalNarrative, doc.internal.pageSize.getWidth() - 30);
  doc.text(critLines, 15, y);
  y += critLines.length * 4 + 4;

  const criticalRows = criticalWorks.map((w) => [
    String(w.id),
    (w.object_description || "").substring(0, 35),
    w.municipio || "—",
    `${Math.round(w.efficiency_score ?? 0)}`,
    formatCompact(w.contract_value ?? 0),
    (w.contractor_name || "—").substring(0, 25),
    w.status || normalizeStatus(w),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["ID", "Obra", "Município", "Score", "Valor", "Contratada", "Status"]],
    body: criticalRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: DANGER_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    columnStyles: {
      0: { cellWidth: 12 },
      3: { halign: "center" },
      4: { halign: "right" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.column.index === 3 && data.section === "body") {
        data.cell.styles.textColor = DANGER_COLOR;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 8: Tabela Geral de Obras ────────────────────────────────────── */

function addWorksTable(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 40);
  y = addSectionTitle(doc, "7. Detalhamento Geral das Obras", y);

  const rows = works.map((w) => [
    String(w.id),
    (w.object_description || "").substring(0, 40),
    w.municipio || "—",
    normalizeStatus(w),
    formatCompact(w.contract_value ?? 0),
    Math.round(w.efficiency_score ?? 0).toString(),
    getRiskLevel(w.efficiency_score),
    w.risk_delay_probability != null ? `${Math.round(w.risk_delay_probability * 100)}%` : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["ID", "Obra", "Município", "Status", "Valor", "Score", "Risco", "Risco IA"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12 },
      4: { halign: "right" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.column.index === 6 && data.section === "body") {
        const risk = data.cell.raw as string;
        if (risk === "Crítico") data.cell.styles.textColor = DANGER_COLOR;
        else if (risk === "Alto") data.cell.styles.textColor = ORANGE_COLOR;
        else if (risk === "Atenção") data.cell.styles.textColor = WARNING_COLOR;
        else if (risk === "Baixo") data.cell.styles.textColor = SUCCESS_COLOR;
      }
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

/* ─── SEÇÃO 9: Recomendações (EXPANDIDAS) ────────────────────────────────── */

function addRecommendations(doc: jsPDF, works: WorkRead[], y: number): number {
  y = ensurePageSpace(doc, y, 40);
  y = addSectionTitle(doc, "8. Recomendações Automáticas", y);

  const totalWorks = works.length || 1;
  const recommendations: { text: string; level: "danger" | "warning" | "info" }[] = [];

  // 1. Obras críticas
  const critical = works.filter((w) => (w.efficiency_score ?? 100) < 40);
  if (critical.length > 0) {
    recommendations.push({
      text: `URGENTE: ${critical.length} obra(s) em estado crítico (score < 40). Recomenda-se auditoria técnica presencial imediata e revisão dos contratos vigentes.`,
      level: "danger",
    });
  }

  // 2. Alto risco de atraso
  const highDelayRisk = works.filter((w) => (w.risk_delay_probability ?? 0) >= 0.5);
  if (highDelayRisk.length > 0) {
    recommendations.push({
      text: `ALERTA: ${highDelayRisk.length} obra(s) com alto risco de atraso (≥50%). Revisar cronogramas, alocar recursos adicionais e convocar reunião com as contratadas.`,
      level: "danger",
    });
  }

  // 3. Alto risco de custo
  const highCostRisk = works.filter((w) => (w.risk_cost_probability ?? 0) >= 0.5);
  if (highCostRisk.length > 0) {
    recommendations.push({
      text: `FINANCEIRO: ${highCostRisk.length} obra(s) com alto risco de estouro de custo. Auditar aditivos contratuais e comparar com benchmarks SINAPI.`,
      level: "warning",
    });
  }

  // 4. Aditivos excessivos
  const highAdditives = works.filter((w) => {
    const cv = w.contract_value ?? 0;
    const av = w.additive_value ?? 0;
    return cv > 0 && av / cv > 0.2;
  });
  if (highAdditives.length > 0) {
    recommendations.push({
      text: `ADITIVOS: ${highAdditives.length} obra(s) com aditivos superiores a 20% do valor contratado. Investigar causas e avaliar viabilidade de renegociação.`,
      level: "warning",
    });
  }

  // 5. Concentração municipal (>50% das obras em 1 município)
  const municipalityMap = new Map<string, number>();
  works.forEach((w) => {
    const mun = w.municipio || "Não informado";
    municipalityMap.set(mun, (municipalityMap.get(mun) ?? 0) + 1);
  });
  const topMunicipality = Array.from(municipalityMap.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topMunicipality && topMunicipality[1] / totalWorks > 0.5) {
    const pct = Math.round((topMunicipality[1] / totalWorks) * 100);
    recommendations.push({
      text: `CONCENTRAÇÃO MUNICIPAL: ${pct}% das obras estão concentradas em ${topMunicipality[0]}. Recomenda-se diversificar a alocação de recursos e priorizar municípios com maior demanda reprimida.`,
      level: "warning",
    });
  }

  // 6. Execução financeira baixa (<20% para obras em andamento)
  const inProgressWorks = works.filter((w) => normalizeStatus(w) === "Em andamento");
  if (inProgressWorks.length > 0) {
    const totalContracted = inProgressWorks.reduce((s, w) => s + (w.contract_value ?? 0), 0);
    const totalPaid = inProgressWorks.reduce((s, w) => s + (w.paid_value ?? 0), 0);
    const execPct = totalContracted > 0 ? (totalPaid / totalContracted) * 100 : 0;
    if (execPct < 20) {
      recommendations.push({
        text: `EXECUÇÃO FINANCEIRA: Apenas ${Math.round(execPct)}% do valor contratado foi executado para obras em andamento. Verificar se há impedimentos burocráticos ou atrasos em medições.`,
        level: "warning",
      });
    }
  }

  // 7. Construtoras com múltiplas obras críticas
  const contractorCriticalMap = new Map<string, number>();
  critical.forEach((w) => {
    const name = w.contractor_name || "Não informada";
    contractorCriticalMap.set(name, (contractorCriticalMap.get(name) ?? 0) + 1);
  });
  const multiCriticalContractors = Array.from(contractorCriticalMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  if (multiCriticalContractors.length > 0) {
    const names = multiCriticalContractors.map(([name]) => name).join(", ");
    recommendations.push({
      text: `CONSTRUTORAS CRÍTICAS: As seguintes empresas possuem múltiplas obras em estado crítico: ${names}. Recomenda-se auditoria conjunta e avaliação de capacidade técnica.`,
      level: "warning",
    });
  }

  // Renderizar recomendações
  if (recommendations.length === 0) {
    recommendations.push({
      text: "Nenhuma ação urgente recomendada no momento. Manter monitoramento contínuo e revisões periódicas.",
      level: "info",
    });
  }

  const pageWidth = doc.internal.pageSize.getWidth();

  recommendations.forEach((rec, i) => {
    y = ensurePageSpace(doc, y, 16);

    if (rec.level === "danger") {
      doc.setFillColor(254, 242, 242);
      doc.setTextColor(...DANGER_COLOR);
    } else if (rec.level === "warning") {
      doc.setFillColor(255, 251, 235);
      doc.setTextColor(146, 64, 14);
    } else {
      doc.setFillColor(239, 246, 255);
      doc.setTextColor(...ACCENT_COLOR);
    }

    const lines = doc.splitTextToSize(rec.text, pageWidth - 55);
    const boxHeight = Math.max(12, lines.length * 5 + 6);

    doc.roundedRect(15, y - 4, pageWidth - 30, boxHeight, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${i + 1}.`, 19, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(lines, 28, y + 3);

    y += boxHeight + 2;
  });

  return y + 6;
}

/* ─── SEÇÃO 10: Rodapé ──────────────────────────────────────────────────── */

function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(...BRAND_COLOR);
    doc.rect(0, pageHeight - 15, pageWidth, 15, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("ARGUS — Plataforma de Monitoramento de Obras Públicas", 15, pageHeight - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 15, pageHeight - 5, {
      align: "right",
    });
  }
}

/* ─── Função principal de geração ────────────────────────────────────────── */

/**
 * Gera um PDF completo e enriquecido de relatório ARGUS.
 */
export function generateReport(options: ReportOptions): jsPDF {
  const { title, subtitle, works, includeRecommendations = true } = options;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // 1. Header
  let y = addHeader(doc, title, subtitle);

  // 2. Resumo Executivo (expandido)
  y = addSummarySection(doc, works, y);

  // 3. Análise de Distribuição (status, município, faixa de valor)
  y = addStatusDistribution(doc, works, y);

  // 4. Top Construtoras
  y = addTopContractors(doc, works, y);

  // 5. Distribuição de Risco (barras + tabela detalhada)
  y = addRiskDistribution(doc, works, y);

  // 6. Análise de Alertas
  y = addAlertAnalysis(doc, works, y);

  // 7. Obras Críticas — Fila de Prioridade
  y = addCriticalWorksQueue(doc, works, y);

  // 8. Tabela Geral de Obras
  y = addWorksTable(doc, works, y);

  // 9. Recomendações (expandidas)
  if (includeRecommendations) {
    addRecommendations(doc, works, y);
  }

  // 10. Rodapé
  addFooter(doc);

  return doc;
}

/**
 * Gera e faz download do PDF.
 */
export function downloadReport(options: ReportOptions): void {
  const doc = generateReport(options);
  const filename = `argus-relatorio-${(options.municipio || "geral").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
