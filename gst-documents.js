(function attachFactoryFlowGstDocuments(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FactoryFlowGstDocuments = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowGstDocuments() {
  'use strict';

  const GST_RATES = [0, 5, 12, 18, 28];
  const DOCUMENT_TYPES = ['QUOTATION', 'TAX_INVOICE', 'DELIVERY_CHALLAN'];
  const PREFIXES = { QUOTATION: 'QUO', TAX_INVOICE: 'INV', DELIVERY_CHALLAN: 'DC' };

  function list(value) { return Array.isArray(value) ? value : []; }
  function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function validateGstin(value, fieldName = 'GSTIN') {
    const gstin = String(value || '').trim().toUpperCase();
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      throw new Error(fieldName + ' must be a valid 15-character GSTIN format.');
    }
    return gstin;
  }

  function validateProfile(input = {}, current = null) {
    const value = (key) => String(input[key] === undefined ? current && current[key] || '' : input[key] || '').trim();
    const profile = {
      legalName: value('legalName'),
      tradeName: value('tradeName'),
      gstin: validateGstin(value('gstin'), 'Business GSTIN'),
      pan: value('pan').toUpperCase(),
      address: value('address'),
      city: value('city'),
      state: value('state'),
      stateCode: value('stateCode'),
      pincode: value('pincode'),
      email: value('email'),
      phone: value('phone'),
      bankName: value('bankName'),
      bankAccount: value('bankAccount'),
      bankIfsc: value('bankIfsc')
    };
    if (!profile.legalName || profile.legalName.length > 150) throw new Error('Legal business name is required (maximum 150 characters).');
    if (profile.tradeName.length > 150) throw new Error('Trade name must be 150 characters or fewer.');
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(profile.pan)) throw new Error('Enter a valid 10-character PAN.');
    if (profile.pan !== profile.gstin.slice(2, 12)) throw new Error('Business PAN must match the PAN embedded in the GSTIN.');
    if (!profile.address || profile.address.length > 300) throw new Error('Business address is required (maximum 300 characters).');
    if (!profile.city || profile.city.length > 80) throw new Error('Business city is required (maximum 80 characters).');
    if (!profile.state || profile.state.length > 80) throw new Error('Business state is required (maximum 80 characters).');
    if (!/^\d{2}$/.test(profile.stateCode) || profile.stateCode === '00' || profile.stateCode !== profile.gstin.slice(0, 2)) {
      throw new Error('Business state code must be two digits and match the first two digits of the GSTIN.');
    }
    if (!/^\d{6}$/.test(profile.pincode)) throw new Error('Enter a valid six-digit PIN code.');
    if (profile.email && (profile.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))) {
      throw new Error('Enter a valid business email address.');
    }
    if (profile.phone.length > 20) throw new Error('Business phone must be 20 characters or fewer.');
    if (profile.bankAccount.length > 34 || profile.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.bankIfsc)) {
      throw new Error('Enter valid bank account and IFSC details.');
    }
    return profile;
  }

  function financialYear(date) {
    const [year, month] = date.split('-').map(Number);
    const start = month >= 4 ? year : year - 1;
    return String(start) + '-' + String(start + 1).slice(-2);
  }

  function nextDocumentNumber(documents, facilityId, type, date) {
    const fy = financialYear(date);
    const prefix = PREFIXES[type];
    let max = 0;
    list(documents).forEach((document) => {
      if (!document || document.facilityId !== facilityId || document.type !== type || document.financialYear !== fy) return;
      const match = new RegExp('^' + prefix + '/' + fy.replace('-', '-') + '/(\\d{4,})$').exec(String(document.number || ''));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return prefix + '/' + fy + '/' + String(max + 1).padStart(4, '0');
  }

  function validateLineItems(items, isChallan) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
      throw new Error('A document must contain between 1 and 100 line items.');
    }
    return items.map((item, index) => {
      const description = String(item && item.description || '').trim();
      const hsnSac = String(item && item.hsnSac || '').trim();
      const unit = String(item && item.unit || '').trim();
      const quantity = Number(item && item.quantity);
      const unitPrice = Number(item && item.unitPrice);
      const discount = Number(item && item.discount || 0);
      const gstRate = isChallan ? 0 : Number(item && item.gstRate);
      if (!description || description.length > 250) throw new Error('Line ' + (index + 1) + ': description is required (maximum 250 characters).');
      if (!/^(?:\d{4}|\d{6}|\d{8})$/.test(hsnSac)) throw new Error('Line ' + (index + 1) + ': enter a 4, 6 or 8 digit HSN/SAC code.');
      if (!unit || unit.length > 20) throw new Error('Line ' + (index + 1) + ': enter a valid unit (maximum 20 characters).');
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000000) throw new Error('Line ' + (index + 1) + ': quantity must be greater than zero.');
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000000) throw new Error('Line ' + (index + 1) + ': unit price is invalid.');
      if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) throw new Error('Line ' + (index + 1) + ': discount must be between zero and the line value.');
      if (!GST_RATES.includes(gstRate)) throw new Error('Line ' + (index + 1) + ': GST rate must be 0%, 5%, 12%, 18% or 28%.');
      const gross = roundMoney(quantity * unitPrice);
      const taxableValue = roundMoney(gross - discount);
      const taxAmount = isChallan ? 0 : roundMoney(taxableValue * gstRate / 100);
      return {
        description, hsnSac, quantity: roundMoney(quantity), unit, unitPrice: roundMoney(unitPrice),
        grossValue: gross, discount: roundMoney(discount), taxableValue, gstRate,
        cgstRate: isChallan ? 0 : undefined,
        sgstRate: isChallan ? 0 : undefined,
        igstRate: isChallan ? 0 : undefined,
        cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxAmount
      };
    });
  }

  function calculateTax(lines, intraState) {
    let taxableValue = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
    const calculated = lines.map((line) => {
      const cgst = intraState ? roundMoney(line.taxableValue * line.gstRate / 200) : 0;
      const sgst = intraState ? roundMoney(line.taxableValue * line.gstRate / 200) : 0;
      const igst = intraState ? 0 : roundMoney(line.taxableValue * line.gstRate / 100);
      const tax = roundMoney(cgst + sgst + igst);
      taxableValue += line.taxableValue;
      cgstAmount += cgst; sgstAmount += sgst; igstAmount += igst;
      return { ...line, cgstRate: intraState ? line.gstRate / 2 : 0, sgstRate: intraState ? line.gstRate / 2 : 0,
        igstRate: intraState ? 0 : line.gstRate, cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst, taxAmount: tax,
        lineTotal: roundMoney(line.taxableValue + tax) };
    });
    taxableValue = roundMoney(taxableValue);
    cgstAmount = roundMoney(cgstAmount); sgstAmount = roundMoney(sgstAmount); igstAmount = roundMoney(igstAmount);
    const totalTax = roundMoney(cgstAmount + sgstAmount + igstAmount);
    const exactTotal = roundMoney(taxableValue + totalTax);
    const grandTotal = Math.round(exactTotal);
    return {
      lines: calculated, taxableValue, cgstAmount, sgstAmount, igstAmount,
      totalTax, exactTotal, roundOff: roundMoney(grandTotal - exactTotal), grandTotal
    };
  }

  function createDocument(documents, profiles, input = {}, context = {}) {
    if (!Array.isArray(documents)) throw new TypeError('GST documents must be stored in an array.');
    const facilityId = String(context.facilityId || '');
    if (!facilityId) throw new Error('An active facility is required to issue a GST document.');
    const type = String(input.type || '').trim().toUpperCase();
    if (!DOCUMENT_TYPES.includes(type)) throw new Error('Choose a supported GST document type.');
    const documentDate = String(input.documentDate || '').trim();
    if (!validDate(documentDate)) throw new Error('Document date must be a valid YYYY-MM-DD date.');
    const profile = list(profiles).find((item) => item && item.facilityId === facilityId);
    if (!profile) throw new Error('Configure the facility GST profile before creating documents.');
    const customerName = String(input.customerName || '').trim();
    const customerAddress = String(input.customerAddress || '').trim();
    const placeOfSupplyState = String(input.placeOfSupplyState || '').trim();
    const placeOfSupplyStateCode = String(input.placeOfSupplyStateCode || '').trim();
    const buyerGstinRaw = String(input.customerGstin || '').trim();
    const buyerGstin = buyerGstinRaw ? validateGstin(buyerGstinRaw, 'Customer GSTIN') : '';
    if (!customerName || customerName.length > 150) throw new Error('Customer name is required (maximum 150 characters).');
    if (!customerAddress || customerAddress.length > 300) throw new Error('Customer address is required (maximum 300 characters).');
    if (!placeOfSupplyState || placeOfSupplyState.length > 80 || !/^\d{2}$/.test(placeOfSupplyStateCode) || placeOfSupplyStateCode === '00') {
      throw new Error('Enter a valid place-of-supply state and two-digit state code.');
    }
    if (buyerGstin && buyerGstin.slice(0, 2) !== placeOfSupplyStateCode) {
      throw new Error('Customer GSTIN state code must match the place of supply.');
    }
    const dueDate = String(input.dueDate || '').trim();
    if (type === 'TAX_INVOICE' && (!validDate(dueDate) || dueDate < documentDate)) {
      throw new Error('Tax invoice due date must be valid and on or after the invoice date.');
    }
    if (dueDate && !validDate(dueDate)) throw new Error('Due date must be a valid YYYY-MM-DD date.');
    const reference = String(input.reference || '').trim();
    const notes = String(input.notes || '').trim();
    if (reference.length > 120 || notes.length > 1200) throw new Error('Reference or notes exceed the supported length.');
    const isChallan = type === 'DELIVERY_CHALLAN';
    const intraState = profile.stateCode === placeOfSupplyStateCode;
    const rawLines = validateLineItems(input.lines, isChallan);
    const totals = calculateTax(rawLines, intraState);
    const now = new Date().toISOString();
    const document = {
      id: 'GSTDOC-' + String(documents.filter((item) => item && item.facilityId === facilityId).length + 1).padStart(5, '0'),
      facilityId,
      type,
      number: nextDocumentNumber(documents, facilityId, type, documentDate),
      financialYear: financialYear(documentDate),
      documentDate,
      dueDate: type === 'TAX_INVOICE' ? dueDate : '',
      seller: { ...profile },
      customer: { name: customerName, gstin: buyerGstin, address: customerAddress, state: placeOfSupplyState, stateCode: placeOfSupplyStateCode },
      placeOfSupplyState,
      placeOfSupplyStateCode,
      supplyType: intraState ? 'INTRA_STATE' : 'INTER_STATE',
      reference,
      notes,
      lines: isChallan ? rawLines.map((line) => ({ ...line, lineTotal: line.taxableValue })) : totals.lines,
      taxableValue: totals.taxableValue,
      cgstAmount: isChallan ? 0 : totals.cgstAmount,
      sgstAmount: isChallan ? 0 : totals.sgstAmount,
      igstAmount: isChallan ? 0 : totals.igstAmount,
      totalTax: isChallan ? 0 : totals.totalTax,
      exactTotal: isChallan ? totals.taxableValue : totals.exactTotal,
      roundOff: isChallan ? 0 : totals.roundOff,
      grandTotal: isChallan ? 0 : totals.grandTotal,
      declaredValue: isChallan ? totals.taxableValue : null,
      status: type === 'QUOTATION' ? 'Issued' : 'Issued',
      createdBy: context.userId || '',
      createdByName: context.userName || '',
      createdAt: now
    };
    documents.push(document);
    return document;
  }

  return {
    GST_RATES,
    DOCUMENT_TYPES,
    validDate,
    validateGstin,
    validateProfile,
    financialYear,
    nextDocumentNumber,
    validateLineItems,
    calculateTax,
    createDocument
  };
});
