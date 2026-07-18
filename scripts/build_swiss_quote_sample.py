from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SOURCE = REPO / "examples" / "swiss-hvac-sample-quote.json"
DEFAULT_OUTPUT = REPO / "examples" / "swiss-hvac-sample-quote.pdf"


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("QuoteSans", str(regular)))
        pdfmetrics.registerFont(TTFont("QuoteSansBold", str(bold)))
        return "QuoteSans", "QuoteSansBold"
    return "Helvetica", "Helvetica-Bold"


def money(value: float) -> str:
    return f"{float(value):,.2f}"


def build(output_path: Path) -> None:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    quote = payload["quote"]
    pricing = quote["pricing"]
    regular, bold = register_fonts()

    navy = colors.HexColor("#172033")
    blue = colors.HexColor("#155DC5")
    slate = colors.HexColor("#617086")
    line = colors.HexColor("#D9E2EC")
    pale_blue = colors.HexColor("#EAF2FF")
    pale_red = colors.HexColor("#FFF0ED")
    red = colors.HexColor("#A33B2F")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=13 * mm,
        title="Swiss HVAC synthetic exact-match sample quote",
        author="Prototype evidence",
        subject="Synthetic sample - not a supplier quote",
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName=regular,
        fontSize=8.4,
        leading=11.2,
        textColor=navy,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=7.2,
        leading=9.4,
        textColor=slate,
    )
    label = ParagraphStyle(
        "Label",
        parent=body,
        fontName=bold,
        fontSize=7.2,
        leading=9,
        textColor=slate,
        spaceAfter=2,
    )
    title = ParagraphStyle(
        "QuoteTitle",
        parent=body,
        fontName=bold,
        fontSize=21,
        leading=24,
        textColor=navy,
    )
    section = ParagraphStyle(
        "Section",
        parent=body,
        fontName=bold,
        fontSize=10,
        leading=12,
        textColor=navy,
        spaceBefore=7,
        spaceAfter=5,
    )
    right = ParagraphStyle("Right", parent=body, alignment=TA_RIGHT)
    right_bold = ParagraphStyle("RightBold", parent=right, fontName=bold, fontSize=10)
    total_label = ParagraphStyle(
        "TotalLabel",
        parent=right_bold,
        textColor=colors.white,
    )
    total_value = ParagraphStyle(
        "TotalValue",
        parent=right_bold,
        textColor=colors.white,
    )

    def p(text: str, style: ParagraphStyle = body) -> Paragraph:
        return Paragraph(text, style)

    header = Table(
        [
            [
                p("<font color='#155DC5'><b>PROTOTYPE SYNTHETIQUE</b></font>", label),
                p("DEVIS No PROTO-2026-0719", right),
            ],
            [p("Devis plomberie / CVC", title), p("19 juillet 2026", right)],
        ],
        colWidths=[120 * mm, 58 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))

    notice = Table(
        [[p("<b>DONNEES FICTIVES UNIQUEMENT.</b> Les references et prix ci-dessous ne proviennent pas des fournisseurs cites. Ce document demontre la logique de correspondance exacte et ne constitue pas une offre commerciale.", small)]],
        colWidths=[178 * mm],
    )
    notice.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), pale_blue),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#B9D2FF")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    overview = Table(
        [
            [p("CLIENT", label), p("STATUT", label), p("MODE CATALOGUE", label)],
            [
                p("Demonstration - donnees fictives"),
                p("<font color='#A33B2F'><b>VERIFICATION REQUISE</b></font>"),
                p("Correspondance exacte uniquement"),
            ],
        ],
        colWidths=[63 * mm, 52 * mm, 63 * mm],
    )
    overview.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F8FB")),
                ("BOX", (0, 0), (-1, -1), 0.5, line),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    matched_rows = [[p("FOURNISSEUR", label), p("REFERENCE", label), p("DESIGNATION", label), p("QTE", label), p("UNIT. CHF", label), p("BASE CHF", label)]]
    for row in quote["matched"]:
        matched_rows.append(
            [
                p(row["supplier"], small),
                p(row["sku"], small),
                p(row["catalogDescription"], small),
                p(str(row["quantity"]), right),
                p(money(row["unitPriceChf"]), right),
                p(money(row["materialBaseChf"]), right),
            ]
        )
    matched_table = Table(matched_rows, colWidths=[35 * mm, 29 * mm, 50 * mm, 13 * mm, 24 * mm, 27 * mm], repeatRows=1)
    matched_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("BOX", (0, 0), (-1, -1), 0.5, line),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, line),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    exception_rows = [[p("DEMANDE", label), p("DECISION", label)]]
    for row in quote["exceptions"]:
        exception_rows.append(
            [
                p(row["requested"]),
                p("<font color='#A33B2F'><b>AUCUNE CORRESPONDANCE EXACTE - NON CHIFFRE</b></font>"),
            ]
        )
    exceptions = Table(exception_rows, colWidths=[79 * mm, 99 * mm])
    exceptions.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), pale_red),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#E9B8B0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E9B8B0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    totals_data = [
        [p("Materiel - base"), p(money(pricing["materialBaseChf"]), right)],
        [p("Marge materiel 15%"), p(money(pricing["materialMarginChf"]), right)],
        [p("Materiel avec marge"), p(money(pricing["materialsWithMarginChf"]), right)],
        [p(f"Main-d'oeuvre: {pricing['laborHours']} h x CHF {money(pricing['laborRateChf'])}"), p(money(pricing["laborChf"]), right)],
        [p("Deplacement"), p(money(pricing["travelChf"]), right)],
        [p("Sous-total"), p(money(pricing["subtotalChf"]), right)],
        [p("TVA 8.1%"), p(money(pricing["vatChf"]), right)],
        [p("TOTAL CHF", total_label), p(money(pricing["totalChf"]), total_value)],
    ]
    totals = Table(totals_data, colWidths=[67 * mm, 27 * mm], hAlign="RIGHT")
    totals.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, -3), (-1, -3), 0.5, line),
                ("BACKGROUND", (0, -1), (-1, -1), navy),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    footer = KeepTogether(
        [
            Spacer(1, 7 * mm),
            Table([["", ""]], colWidths=[178 * mm, 0], style=[("LINEABOVE", (0, 0), (0, 0), 0.6, line)]),
            Spacer(1, 2 * mm),
            p("<b>Regle fail-closed:</b> aucune approximation de reference ou de prix. Toute ligne inconnue reste non chiffree jusqu'a validation humaine contre une source fournisseur autorisee.", small),
            Spacer(1, 1.5 * mm),
            p("Moteur et tests publics: <link href='https://parkkiyun.github.io/consent-aware-voice-lead-pilot/swiss-hvac-quote.html' color='#155DC5'>demonstration interactive</link> | <link href='https://github.com/parkkiyun/consent-aware-voice-lead-pilot/actions/workflows/test.yml' color='#155DC5'>tests CI</link>", small),
        ]
    )

    story = [
        header,
        Spacer(1, 5 * mm),
        notice,
        Spacer(1, 5 * mm),
        overview,
        p("Correspondances exactes", section),
        matched_table,
        p("Exceptions non chiffrees", section),
        exceptions,
        Spacer(1, 5 * mm),
        totals,
        footer,
    ]
    doc.build(story)


if __name__ == "__main__":
    destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    build(destination)
    print(destination)
