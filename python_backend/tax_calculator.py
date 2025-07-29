import json
import requests
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class TaxBreakdown:
    """Tax breakdown structure"""
    cgst: float = 0.0  # Central GST
    sgst: float = 0.0  # State GST
    igst: float = 0.0  # Integrated GST
    total_tax: float = 0.0
    tax_rate: float = 0.0
    tax_type: str = "GST"
    state_code: str = ""
    state_name: str = ""

class TaxCalculator:
    """Comprehensive tax calculator for Indian supply chain"""
    
    def __init__(self):
        # Warehouse location (Pune, Maharashtra)
        self.warehouse_state = "Maharashtra"
        self.warehouse_state_code = "MH"
        
        # GST rates for different product categories
        self.gst_rates = {
            "electronics": 0.18,
            "machinery": 0.18,
            "automotive": 0.18,
            "construction": 0.18,
            "textiles": 0.12,
            "agriculture": 0.05,
            "food": 0.05,
            "pharmaceuticals": 0.12,
            "default": 0.18
        }
        
        # State codes mapping
        self.state_codes = {
            "Andhra Pradesh": "AP",
            "Arunachal Pradesh": "AR",
            "Assam": "AS",
            "Bihar": "BR",
            "Chhattisgarh": "CG",
            "Goa": "GA",
            "Gujarat": "GJ",
            "Haryana": "HR",
            "Himachal Pradesh": "HP",
            "Jharkhand": "JH",
            "Karnataka": "KA",
            "Kerala": "KL",
            "Madhya Pradesh": "MP",
            "Maharashtra": "MH",
            "Manipur": "MN",
            "Meghalaya": "ML",
            "Mizoram": "MZ",
            "Nagaland": "NL",
            "Odisha": "OD",
            "Punjab": "PB",
            "Rajasthan": "RJ",
            "Sikkim": "SK",
            "Tamil Nadu": "TN",
            "Telangana": "TS",
            "Tripura": "TR",
            "Uttar Pradesh": "UP",
            "Uttarakhand": "UK",
            "West Bengal": "WB",
            "Delhi": "DL",
            "Jammu and Kashmir": "JK",
            "Ladakh": "LA",
            "Chandigarh": "CH",
            "Dadra and Nagar Haveli": "DN",
            "Daman and Diu": "DD",
            "Lakshadweep": "LD",
            "Puducherry": "PY",
            "Andaman and Nicobar Islands": "AN"
        }
        
        # Reverse mapping for state codes to names
        self.state_names = {v: k for k, v in self.state_codes.items()}
    
    def detect_state_from_address(self, address: str) -> Optional[str]:
        """Detect state from address string"""
        if not address:
            return None
        
        address_lower = address.lower()
        
        # Check for state names in address
        for state_name, state_code in self.state_codes.items():
            if state_name.lower() in address_lower:
                return state_name
        
        # Check for state codes in address
        for state_code, state_name in self.state_names.items():
            if state_code.lower() in address_lower:
                return state_name
        
        return None
    
    def get_gst_rate(self, product_category: str = None) -> float:
        """Get applicable GST rate for product category"""
        if product_category and product_category.lower() in self.gst_rates:
            return self.gst_rates[product_category.lower()]
        return self.gst_rates["default"]
    
    def calculate_taxes(self, 
                       subtotal: float, 
                       supplier_address: str, 
                       product_category: str = None,
                       is_interstate: bool = None) -> TaxBreakdown:
        """
        Calculate comprehensive taxes for a transaction
        
        Args:
            subtotal: Base amount before taxes
            supplier_address: Supplier's address for state detection
            product_category: Product category for GST rate
            is_interstate: Whether transaction is interstate (auto-detected if None)
        """
        
        # Detect supplier state
        supplier_state = self.detect_state_from_address(supplier_address)
        supplier_state_code = self.state_codes.get(supplier_state, "")
        
        # Determine if interstate transaction
        if is_interstate is None:
            is_interstate = supplier_state != self.warehouse_state
        
        # Get GST rate
        gst_rate = self.get_gst_rate(product_category)
        total_gst_amount = subtotal * gst_rate
        
        # Calculate tax breakdown
        if is_interstate:
            # Interstate: IGST applies
            igst = total_gst_amount
            cgst = 0.0
            sgst = 0.0
            tax_type = "IGST"
        else:
            # Intrastate: CGST + SGST applies
            igst = 0.0
            cgst = total_gst_amount / 2
            sgst = total_gst_amount / 2
            tax_type = "CGST + SGST"
        
        return TaxBreakdown(
            cgst=cgst,
            sgst=sgst,
            igst=igst,
            total_tax=total_gst_amount,
            tax_rate=gst_rate,
            tax_type=tax_type,
            state_code=supplier_state_code,
            state_name=supplier_state or "Unknown"
        )
    
    def get_tax_summary(self, tax_breakdown: TaxBreakdown) -> Dict:
        """Get formatted tax summary for display"""
        return {
            "tax_type": tax_breakdown.tax_type,
            "tax_rate_percent": f"{tax_breakdown.tax_rate * 100:.0f}%",
            "cgst": tax_breakdown.cgst,
            "sgst": tax_breakdown.sgst,
            "igst": tax_breakdown.igst,
            "total_tax": tax_breakdown.total_tax,
            "supplier_state": tax_breakdown.state_name,
            "is_interstate": tax_breakdown.igst > 0,
            "breakdown": []
        }
    
    def get_tax_breakdown_display(self, tax_breakdown: TaxBreakdown) -> List[List[str]]:
        """Get tax breakdown for table display"""
        breakdown = []
        
        if tax_breakdown.cgst > 0:
            breakdown.append(["CGST (9%)", f"₹{tax_breakdown.cgst:,.2f}"])
        
        if tax_breakdown.sgst > 0:
            breakdown.append(["SGST (9%)", f"₹{tax_breakdown.sgst:,.2f}"])
        
        if tax_breakdown.igst > 0:
            breakdown.append([f"IGST ({tax_breakdown.tax_rate * 100:.0f}%)", f"₹{tax_breakdown.igst:,.2f}"])
        
        return breakdown
    
    def calculate_total_with_taxes(self, 
                                 subtotal: float, 
                                 shipping_cost: float,
                                 supplier_address: str,
                                 product_category: str = None) -> Dict:
        """
        Calculate complete total with all taxes and shipping
        
        Returns:
            Dict with complete breakdown including taxes and shipping
        """
        
        # Calculate taxes on subtotal
        tax_breakdown = self.calculate_taxes(subtotal, supplier_address, product_category)
        
        # Calculate taxes on shipping (if applicable)
        shipping_tax_breakdown = self.calculate_taxes(shipping_cost, supplier_address, product_category)
        
        # Combine taxes
        total_tax = tax_breakdown.total_tax + shipping_tax_breakdown.total_tax
        total_cgst = tax_breakdown.cgst + shipping_tax_breakdown.cgst
        total_sgst = tax_breakdown.sgst + shipping_tax_breakdown.sgst
        total_igst = tax_breakdown.igst + shipping_tax_breakdown.igst
        
        # Calculate final total
        grand_total = subtotal + shipping_cost + total_tax
        
        return {
            "subtotal": subtotal,
            "shipping_cost": shipping_cost,
            "tax_breakdown": {
                "cgst": total_cgst,
                "sgst": total_sgst,
                "igst": total_igst,
                "total_tax": total_tax,
                "tax_rate": tax_breakdown.tax_rate,
                "tax_type": tax_breakdown.tax_type,
                "supplier_state": tax_breakdown.state_name,
                "is_interstate": tax_breakdown.igst > 0
            },
            "grand_total": grand_total,
            "breakdown_display": self.get_tax_breakdown_display(tax_breakdown)
        }

# Global tax calculator instance
tax_calculator = TaxCalculator() 