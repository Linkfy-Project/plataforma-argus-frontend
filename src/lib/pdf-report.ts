/**
 * Geração de relatórios PDF para a Plataforma ARGUS.
 *
 * Usa jsPDF + jspdf-autotable para gerar PDFs branded com:
 * - Cabeçalho com logo/título ARGUS
 * - Resumo estatístico do município
 * - Tabela de obras com scores e riscos
 * - Distribuição de risco
 * - Recomendações automáticas
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { WorkRead } from "@/types";
import { getRiskLevel } from "@/lib/score";

const BRAND_COLOR: [number, number, number] = [30, 58, 138]; // azul escuro
const ACCENT_COLOR: [number, number, number] = [59, 130, 246]; // azul primário
const DANGER_COLOR: [number, number, number] = [220, 38, 38]; // vermelho
const SUCCESS_COLOR: [number, number, number] = [34, 197, 94]; // verde
const WARNING_COLOR: [number, number, number] = [245, 158, 11]; // amarelo

interface ReportOptions {
  title: string;
  subtitle?: string;
  municipio?: string;
  works: WorkRead[];
  includeRecommendations?: boolean;
}

function getRiskColor(score: number | null | undefined): [number, number, number] {
  if (score == null) return [148, 163, 184];
  if (score >= 80) return SUCCESS_COLOR;
  if (score >= 60) return WARNING_COLOR;
  if (score >= 40) return [249, 115, 22]; // laranja
  return DANGER_COLOR;
}

function addHeader(doc: jsPDF, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Barra superior azul
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Título
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

  return 50; // retorna Y position após o header
}

function addSummarySection(doc: jsPDF, works: WorkRead[], y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalWorks = works.length;
  const avgScore = works.reduce((s, w) => s + (w.efficiency_score ?? 0), 0) / (totalWorks || 1);
  const critical = works.filter((w) => (w.efficiency_score ?? 100) < 40).length;
  const delayed = works.filter((w) => {
    if (!w.due_at) return false;
    return new Date(w.due_at) < new Date() && !w.finished_at;
  }).length;
  const totalValue = works.reduce((s, w) => s + (w.contract_value ?? 0), 0);

  // Título da seção
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", 15, y);
  y += 8;

  // Cards de resumo
  const cardWidth = (pageWidth - 40) / 4;
  const cards = [
    { label: "Obras Monitoradas", value: String(totalWorks), color: BRAND_COLOR },
    { label: "Score Médio ARGUS", value: `${Math.round(avgScore)}/100`, color: getRiskColor(avgScore) },
    { label: "Obras Críticas", value: String(critical), color: DANGER_COLOR },
    { label: "Obras Atrasadas", value: String(delayed), color: WARNING_COLOR },
  ];

  cards.forEach((card, i) => {
    const x = 15 + i * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, 22, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, 22, 2, 2, "S");

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(card.label, x + 4, y + 7);

    doc.setTextColor(...card.color);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(card.value, x + 4, y + 17);
  });

  y += 30;

  // Valor total
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Valor contratado total: R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 15, y);

  return y + 12;
}

function addRiskDistribution(doc: jsPDF, works: WorkRead[], y: number): number {
  const labels = ["Baixo", "Atenção", "Alto", "Crítico"];
  const counts = labels.map(
    (label) => works.filter((w) => getRiskLevel(w.efficiency_score) === label).length,
  );
  const total = works.length || 1;

  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Distribuição de Risco", 15, y);
  y += 8;

  const colors: [number, number, number][] = [SUCCESS_COLOR, WARNING_COLOR, [249, 115, 22], DANGER_COLOR];
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

    // Count
    doc.setTextColor(...colors[i]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${counts[i]} (${pct}%)`, x + barWidth / 2, y + 52, { align: "center" });
  });

  return y + 60;
}

function addWorksTable(doc: jsPDF, works: WorkRead[], y: number): number {
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhamento das Obras", 15, y);
  y += 4;

  const rows = works.map((w) => [
    String(w.id),
    (w.object_description || "").substring(0, 40),
    w.municipio || "—",
    w.status || (w.finished_at ? "Concluída" : "Em andamento"),
    `R$ ${((w.contract_value ?? 0) / 1000).toFixed(0)}k`,
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
    didParseCell: (data: any) => {
      if (data.column.index === 6 && data.section === "body") {
        const risk = data.cell.raw as string;
        if (risk === "Crítico") data.cell.styles.textColor = DANGER_COLOR;
        else if (risk === "Alto") data.cell.styles.textColor = [249, 115, 22];
        else if (risk === "Atenção") data.cell.styles.textColor = WARNING_COLOR;
        else if (risk === "Baixo") data.cell.styles.textColor = SUCCESS_COLOR;
      }
    },
    margin: { left: 15, right: 15 },
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}

function addRecommendations(doc: jsPDF, works: WorkRead[], y: number): number {
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Recomendações Automáticas", 15, y);
  y += 8;

  const recommendations: string[] = [];

  const critical = works.filter((w) => (w.efficiency_score ?? 100) < 40);
  if (critical.length > 0) {
    recommendations.push(
      `URGENTE: ${critical.length} obra(s) em estado crítico (score < 40). Recomenda-se auditoria técnica presencial imediata.`,
    );
  }

  const highDelayRisk = works.filter((w) => (w.risk_delay_probability ?? 0) >= 0.5);
  if (highDelayRisk.length > 0) {
    recommendations.push(
      `ALERTA: ${highDelayRisk.length} obra(s) com alto risco de atraso (≥50%). Revisar cronogramas e alocar recursos adicionais.`,
    );
  }

  const highCostRisk = works.filter((w) => (w.risk_cost_probability ?? 0) >= 0.5);
  if (highCostRisk.length > 0) {
    recommendations.push(
      `FINANCEIRO: ${highCostRisk.length} obra(s) com alto risco de estouro de custo. Auditar aditivos contratuais.`,
    );
  }

  const highAdditives = works.filter((w) => {
    const cv = w.contract_value ?? 0;
    const av = w.additive_value ?? 0;
    return cv > 0 && av / cv > 0.2;
  });
  if (highAdditives.length > 0) {
    recommendations.push(
      `ADITIVOS: ${highAdditives.length} obra(s) com aditivos superiores a 20% do valor contratado.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Nenhuma ação urgente recomendada no momento. Manter monitoramento contínuo.");
  }

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  recommendations.forEach((rec, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const isUrgent = rec.startsWith("URGENTE") || rec.startsWith("ALERTA");
    if (isUrgent) {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(15, y - 4, doc.internal.pageSize.getWidth() - 30, 12, 1, 1, "F");
      doc.setTextColor(...DANGER_COLOR);
    } else {
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(15, y - 4, doc.internal.pageSize.getWidth() - 30, 12, 1, 1, "F");
      doc.setTextColor(146, 64, 14);
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, 19, y + 3);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(rec, doc.internal.pageSize.getWidth() - 50);
    doc.text(lines, 25, y + 3);
    y += Math.max(14, lines.length * 5 + 6);
  });

  return y + 8;
}

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
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 15, pageHeight - 5, { align: "right" });
  }
}

/**
 * Gera um PDF completo de relatório ARGUS.
 */
export function generateReport(options: ReportOptions): jsPDF {
  const { title, subtitle, works, includeRecommendations = true } = options;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Header
  let y = addHeader(doc, title, subtitle);

  // Summary
  y = addSummarySection(doc, works, y);

  // Risk distribution
  if (y > 200) {
    doc.addPage();
    y = 20;
  }
  y = addRiskDistribution(doc, works, y);

  // Works table
  if (y > 180) {
    doc.addPage();
    y = 20;
  }
  y = addWorksTable(doc, works, y);

  // Recommendations
  if (includeRecommendations) {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    addRecommendations(doc, works, y);
  }

  // Footer
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
