from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from datetime import datetime
import os
import io

class InvoicePDFGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()
    
    def setup_custom_styles(self):
        """Setup custom paragraph styles for the invoice"""
        # Company header style
        self.company_header_style = ParagraphStyle(
            'CompanyHeader',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f2937'),
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName='Helvetica-Bold'
        )
        
        # Invoice title style
        self.invoice_title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=self.styles['Heading2'],
            fontSize=18,
            textColor=colors.HexColor('#374151'),
            alignment=TA_CENTER,
            spaceAfter=30,
            fontName='Helvetica-Bold'
        )
        
        # Section header style
        self.section_header_style = ParagraphStyle(
            'SectionHeader',
            parent=self.styles['Heading3'],
            fontSize=14,
            textColor=colors.HexColor('#4b5563'),
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        # Normal text style
        self.normal_style = ParagraphStyle(
            'Normal',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#374151'),
            fontName='Helvetica'
        )
        
        # Label style
        self.label_style = ParagraphStyle(
            'Label',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#6b7280'),
            fontName='Helvetica'
        )
        
        # Value style
        self.value_style = ParagraphStyle(
            'Value',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#111827'),
            fontName='Helvetica-Bold'
        )
    
    def create_invoice_pdf(self, request_data, supplier_data, fulfillment_data, invoice_number=None, shipping_info=None):
        """Create a comprehensive invoice PDF"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
        
        story = []
        
        # Add company header
        story.extend(self.create_company_header())
        
        # Add invoice title and number
        story.extend(self.create_invoice_header(invoice_number, fulfillment_data))
        
        # Add request and supplier information
        story.extend(self.create_request_info(request_data, supplier_data))
        
        # Add fulfillment timeline
        story.extend(self.create_fulfillment_timeline(fulfillment_data))
        
        # Add shipping information if available
        if shipping_info:
            story.extend(self.create_shipping_info(shipping_info))
        
        # Add tax information if available
        if shipping_info and shipping_info.get('tax_breakdown'):
            story.extend(self.create_tax_info(shipping_info['tax_breakdown']))
        
        # Add items table
        story.extend(self.create_items_table(request_data))
        
        # Add price breakdown with shipping info
        story.extend(self.create_price_breakdown(request_data, shipping_info))
        
        # Add terms and conditions
        story.extend(self.create_terms_conditions())
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def create_company_header(self):
        """Create company header section"""
        elements = []
        
        # Company name and logo placeholder
        company_header = Paragraph(
            "🏭 SUPPLY CHAIN MANAGEMENT SYSTEM",
            self.company_header_style
        )
        elements.append(company_header)
        
        # Company details
        company_details = [
            ["📧 Email:", "admin@supplychain.com"],
            ["📞 Phone:", "+1 (555) 123-4567"],
            ["🏢 Address:", "123 Business Street, Tech City, TC 12345"],
            ["🌐 Website:", "www.supplychain.com"]
        ]
        
        company_table = Table(company_details, colWidths=[1.5*inch, 4*inch])
        company_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#374151')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(company_table)
        elements.append(Spacer(1, 20))
        
        return elements
    
    def create_invoice_header(self, invoice_number, fulfillment_data):
        """Create invoice header with number and dates"""
        elements = []
        
        # Invoice title
        invoice_title = Paragraph(
            f"📄 INVOICE #{invoice_number or 'INV-' + datetime.now().strftime('%Y%m%d%H%M%S')}",
            self.invoice_title_style
        )
        elements.append(invoice_title)
        
        # Invoice details
        current_date = datetime.now().strftime("%B %d, %Y")
        # Calculate due date safely
        try:
            due_date = datetime.now().replace(day=min(datetime.now().day + 30, 28)).strftime("%B %d, %Y")
        except ValueError:
            # If day is out of range, use the last day of the month
            due_date = datetime.now().replace(day=28).strftime("%B %d, %Y")
        
        invoice_details = [
            ["📅 Invoice Date:", current_date],
            ["📅 Due Date:", due_date],
            ["💰 Payment Terms:", "Net 30 Days"],
            ["📊 Status:", "PAID" if fulfillment_data and fulfillment_data.get('delivered_timestamp') else "PENDING"]
        ]
        
        invoice_table = Table(invoice_details, colWidths=[2*inch, 3.5*inch])
        invoice_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#374151')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f9fafb')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
        ]))
        
        elements.append(invoice_table)
        elements.append(Spacer(1, 20))
        
        return elements
    
    def create_request_info(self, request_data, supplier_data):
        """Create request and supplier information section"""
        elements = []
        
        # Section header
        section_header = Paragraph("📋 REQUEST & SUPPLIER INFORMATION", self.section_header_style)
        elements.append(section_header)
        
        # Request details
        def safe_date_format(date_str, default_date=None):
            try:
                if date_str:
                    return datetime.fromisoformat(date_str.replace('Z', '+00:00')).strftime("%B %d, %Y")
                elif default_date:
                    return default_date.strftime("%B %d, %Y")
                else:
                    return 'N/A'
            except:
                return 'N/A'
        
        request_details = [
            ["📝 Request Number:", request_data.get('request_number', 'N/A')],
            ["📋 Title:", request_data.get('title', 'N/A')],
            ["📅 Created Date:", safe_date_format(request_data.get('created_at'), datetime.now())],
            ["🎯 Priority:", request_data.get('priority', 'N/A').upper()],
            ["📦 Expected Delivery:", safe_date_format(request_data.get('expected_delivery_date'))],
            ["📍 Delivery Address:", request_data.get('delivery_address', 'N/A')],
        ]
        
        # Supplier details
        supplier_details = [
            ["🏢 Supplier Name:", supplier_data.get('name', 'N/A')],
            ["📧 Supplier Email:", supplier_data.get('email', 'N/A')],
            ["📊 Supplier Status:", supplier_data.get('status', 'N/A').upper()],
        ]
        
        # Combine request and supplier details
        all_details = request_details + supplier_details
        
        info_table = Table(all_details, colWidths=[2.5*inch, 3*inch])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#374151')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ]))
        
        elements.append(info_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_fulfillment_timeline(self, fulfillment_data):
        """Create fulfillment timeline section"""
        elements = []
        
        # Section header
        section_header = Paragraph("🚚 FULFILLMENT TIMELINE", self.section_header_style)
        elements.append(section_header)
        
        # Timeline data
        timeline_data = [
            ["Stage", "Status", "Date & Time", "Duration"],
        ]
        
        # Accepted stage
        accepted_time = fulfillment_data.get('accepted_timestamp') or fulfillment_data.get('created_at')
        if accepted_time:
            try:
                accepted_date = datetime.fromisoformat(accepted_time.replace('Z', '+00:00')).strftime("%B %d, %Y %I:%M %p")
                timeline_data.append(["✅ Accepted", "COMPLETED", accepted_date, "-"])
            except:
                timeline_data.append(["✅ Accepted", "COMPLETED", "Date not available", "-"])
        
        # Packing stage
        packing_time = fulfillment_data.get('packing_timestamp')
        if packing_time:
            try:
                packing_date = datetime.fromisoformat(packing_time.replace('Z', '+00:00')).strftime("%B %d, %Y %I:%M %p")
                duration = self.calculate_duration(accepted_time, packing_time) if accepted_time else "-"
                timeline_data.append(["📦 Packing", "COMPLETED", packing_date, duration])
            except:
                timeline_data.append(["📦 Packing", "COMPLETED", "Date not available", "-"])
        else:
            timeline_data.append(["📦 Packing", "PENDING", "Not started", "-"])
        
        # Dispatched stage
        dispatched_time = fulfillment_data.get('dispatched_timestamp')
        if dispatched_time:
            try:
                dispatched_date = datetime.fromisoformat(dispatched_time.replace('Z', '+00:00')).strftime("%B %d, %Y %I:%M %p")
                duration = self.calculate_duration(packing_time, dispatched_time) if packing_time else "-"
                timeline_data.append(["🚚 Dispatched", "COMPLETED", dispatched_date, duration])
            except:
                timeline_data.append(["🚚 Dispatched", "COMPLETED", "Date not available", "-"])
        else:
            timeline_data.append(["🚚 Dispatched", "PENDING", "Not started", "-"])
        
        # Delivered stage
        delivered_time = fulfillment_data.get('delivered_timestamp')
        if delivered_time:
            try:
                delivered_date = datetime.fromisoformat(delivered_time.replace('Z', '+00:00')).strftime("%B %d, %Y %I:%M %p")
                duration = self.calculate_duration(dispatched_time, delivered_time) if dispatched_time else "-"
                timeline_data.append(["🎉 Delivered", "COMPLETED", delivered_date, duration])
            except:
                timeline_data.append(["🎉 Delivered", "COMPLETED", "Date not available", "-"])
        else:
            timeline_data.append(["🎉 Delivered", "PENDING", "Not started", "-"])
        
        timeline_table = Table(timeline_data, colWidths=[1.2*inch, 1.2*inch, 2.2*inch, 1.2*inch])
        timeline_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f9fafb')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e5e7eb')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(timeline_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_items_table(self, request_data):
        """Create items table section"""
        elements = []
        
        # Section header
        section_header = Paragraph("📦 REQUEST ITEMS", self.section_header_style)
        elements.append(section_header)
        
        # Table headers
        items_data = [
            ["Product", "SKU", "Quantity", "Unit Price", "Total Price", "Specifications"]
        ]
        
        # Add items
        items = request_data.get('items', [])
        for item in items:
            items_data.append([
                item.get('product_name', 'N/A'),
                item.get('product_sku', 'N/A'),
                str(item.get('quantity', 0)),
                f"₹{item.get('unit_price', 0):,.2f}",
                f"₹{item.get('total_price', 0):,.2f}",
                item.get('specifications', 'N/A')
            ])
        
        # Add total row
        total_amount = request_data.get('total_amount', 0)
        items_data.append([
            "", "", "", "TOTAL:", f"₹{total_amount:,.2f}", ""
        ])
        
        items_table = Table(items_data, colWidths=[1.5*inch, 0.8*inch, 0.6*inch, 0.8*inch, 0.8*inch, 1.3*inch])
        items_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 1), (0, -2), 'LEFT'),  # Product names left-aligned
            ('ALIGN', (5, 1), (5, -2), 'LEFT'),  # Specifications left-aligned
            ('ALIGN', (2, 1), (4, -1), 'RIGHT'),  # Numbers right-aligned
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('BACKGROUND', (0, 1), (-1, -2), colors.HexColor('#f9fafb')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e5e7eb')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        elements.append(items_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_shipping_info(self, shipping_info):
        """Create shipping information section"""
        elements = []
        
        # Section header
        section_header = Paragraph("🚚 SHIPPING INFORMATION", self.section_header_style)
        elements.append(section_header)
        
        # Shipping details
        shipping_details = [
            ["📍 Supplier Location:", shipping_info.get('supplier_location', 'Unknown')],
            ["📏 Distance:", f"{shipping_info.get('distance_km', 0)} km"],
            ["💰 Shipping Cost:", f"₹{shipping_info.get('shipping_cost', 0):,.2f}"],
            ["🏢 Warehouse:", "Pune, Maharashtra, India"],
            ["📊 Cost Model:", "AI-Powered Distance-Based Pricing"]
        ]
        
        shipping_table = Table(shipping_details, colWidths=[2.5*inch, 3*inch])
        shipping_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#374151')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ]))
        
        elements.append(shipping_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_tax_info(self, tax_breakdown):
        """Create tax information section"""
        elements = []
        
        # Section header
        section_header = Paragraph("🏛️ TAX INFORMATION", self.section_header_style)
        elements.append(section_header)
        
        # Tax details
        tax_type = tax_breakdown.get('tax_type', 'GST')
        supplier_state = tax_breakdown.get('supplier_state', 'Unknown')
        is_interstate = tax_breakdown.get('is_interstate', False)
        
        tax_details = [
            ["📊 Tax Type:", tax_type],
            ["🏢 Supplier State:", supplier_state],
            ["🌐 Transaction Type:", "Interstate" if is_interstate else "Intrastate"],
            ["📋 Tax Rate:", f"{tax_breakdown.get('tax_rate', 0.18) * 100:.0f}%"],
        ]
        
        # Add specific tax components
        if tax_breakdown.get('cgst', 0) > 0:
            tax_details.append(["💰 CGST (9%):", f"₹{tax_breakdown['cgst']:,.2f}"])
        
        if tax_breakdown.get('sgst', 0) > 0:
            tax_details.append(["💰 SGST (9%):", f"₹{tax_breakdown['sgst']:,.2f}"])
        
        if tax_breakdown.get('igst', 0) > 0:
            tax_details.append([f"💰 IGST ({tax_breakdown.get('tax_rate', 0.18) * 100:.0f}%):", f"₹{tax_breakdown['igst']:,.2f}"])
        
        tax_details.append(["💳 Total Tax:", f"₹{tax_breakdown.get('total_tax', 0):,.2f}"])
        
        tax_table = Table(tax_details, colWidths=[2.5*inch, 3*inch])
        tax_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#374151')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
        ]))
        
        elements.append(tax_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_price_breakdown(self, request_data, shipping_info=None):
        """Create price breakdown section"""
        elements = []
        
        # Section header
        section_header = Paragraph("💰 PRICE BREAKDOWN", self.section_header_style)
        elements.append(section_header)
        
        # Price breakdown data
        subtotal = request_data.get('total_amount', 0)
        
        # Calculate shipping cost
        if shipping_info and shipping_info.get('shipping_cost'):
            shipping = shipping_info['shipping_cost']
            shipping_details = f"₹{shipping:,.2f} ({shipping_info.get('distance_km', 0)} km)"
        else:
            shipping = 0
            shipping_details = "₹0.00 (Free shipping)"
        
        # Get tax breakdown from shipping info
        if shipping_info and shipping_info.get('tax_breakdown'):
            tax_breakdown = shipping_info['tax_breakdown']
            tax_display = shipping_info.get('tax_display', [])
            grand_total = shipping_info.get('grand_total', subtotal + shipping)
        else:
            # Fallback to simple GST calculation
            tax_rate = 0.18
            tax_amount = subtotal * tax_rate
            tax_display = [["GST (18%)", f"₹{tax_amount:,.2f}"]]
            grand_total = subtotal + shipping + tax_amount
        
        breakdown_data = [
            ["Description", "Amount"],
            ["Subtotal", f"₹{subtotal:,.2f}"],
        ]
        
        # Add tax breakdown
        for tax_line in tax_display:
            breakdown_data.append(tax_line)
        
        breakdown_data.extend([
            ["Shipping", shipping_details],
            ["", ""],
            ["TOTAL", f"₹{grand_total:,.2f}"]
        ])
        
        breakdown_table = Table(breakdown_data, colWidths=[3*inch, 1.5*inch])
        breakdown_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (0, -2), 'Helvetica'),
            ('FONTNAME', (1, 1), (1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#374151')),
            ('BACKGROUND', (0, 1), (-1, -2), colors.HexColor('#f9fafb')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e5e7eb')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d1d5db')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        
        elements.append(breakdown_table)
        elements.append(Spacer(1, 15))
        
        return elements
    
    def create_terms_conditions(self):
        """Create terms and conditions section"""
        elements = []
        
        # Section header
        section_header = Paragraph("📋 TERMS & CONDITIONS", self.section_header_style)
        elements.append(section_header)
        
        # Terms content
        terms_content = [
            "• Payment is due within 30 days of invoice date",
            "• Late payments may incur additional charges",
            "• Goods are delivered as per agreed specifications",
            "• Returns accepted within 7 days of delivery",
            "• All disputes subject to local jurisdiction",
            "• This is a computer-generated invoice"
        ]
        
        for term in terms_content:
            elements.append(Paragraph(term, self.normal_style))
            elements.append(Spacer(1, 3))
        
        elements.append(Spacer(1, 10))
        
        # Footer
        footer_text = f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')} by Supply Chain Management System"
        footer = Paragraph(footer_text, self.label_style)
        elements.append(footer)
        
        return elements
    
    def calculate_duration(self, start_time, end_time):
        """Calculate duration between two timestamps"""
        try:
            start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            duration = end - start
            
            hours = duration.total_seconds() / 3600
            if hours < 1:
                return f"{int(duration.total_seconds() / 60)}m"
            elif hours < 24:
                return f"{int(hours)}h {int((hours % 1) * 60)}m"
            else:
                days = int(hours / 24)
                remaining_hours = int(hours % 24)
                return f"{days}d {remaining_hours}h"
        except:
            return "-" 