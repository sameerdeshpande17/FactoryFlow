(function attachFactoryFlowInventory(root, factory) {
  const inventory = factory();
  if (typeof module === 'object' && module.exports) module.exports = inventory;
  if (root) root.FactoryFlowInventory = inventory;
})(typeof globalThis === 'undefined' ? this : globalThis, function createFactoryFlowInventory() {
  'use strict';

  const unitAliases = {
    kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
    g: 'g', gram: 'g', grams: 'g',
    mg: 'mg', milligram: 'mg', milligrams: 'mg',
    l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
    ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
    sheet: 'sheets', sheets: 'sheets',
    roll: 'rolls', rolls: 'rolls',
    pc: 'pieces', pcs: 'pieces', piece: 'pieces', pieces: 'pieces',
    unit: 'units', units: 'units',
    m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
    box: 'boxes', boxes: 'boxes',
    bag: 'bags', bags: 'bags'
  };

  function normalizeUnit(unit) {
    const cleaned = String(unit == null ? '' : unit).trim().toLowerCase().replace(/\.+$/, '');
    return unitAliases[cleaned] || cleaned;
  }

  function parseQuantity(value) {
    const match = /^\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([a-zA-Z][a-zA-Z.]*)\s*$/.exec(String(value == null ? '' : value));
    if (!match) return null;
    const quantity = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    const unitLabel = match[2].replace(/\.+$/, '');
    return { quantity, unit: normalizeUnit(unitLabel), unitLabel };
  }

  function formatQuantity(quantity) {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(quantity);
  }

  function normalizedItemName(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase();
  }

  function ensureStockMetadata(materials) {
    if (!Array.isArray(materials)) throw new TypeError('Materials must be an array.');
    materials.forEach((material) => {
      const parsed = parseQuantity(material.onHand);
      if (!Number.isFinite(Number(material.stock))) material.stock = 50;
      if (!Number.isFinite(Number(material.capacity)) || Number(material.capacity) <= 0) {
        const ratio = Math.max(Number(material.stock) / 100, 0.01);
        material.capacity = parsed ? Math.max(parsed.quantity, 1) / ratio : 1;
      }
      if (!Number.isFinite(Number(material.reorderLevel))) material.reorderLevel = Number(material.capacity) * 0.30;
      if (!Number.isFinite(Number(material.criticalLevel))) material.criticalLevel = Number(material.capacity) * 0.15;
    });
    return materials;
  }

  function statusForStock(stock) {
    if (stock <= 15) return 'Critical';
    if (stock <= 30) return 'Low stock';
    return 'In stock';
  }

  function categoryForItem(itemName) {
    const name = String(itemName || '').toLowerCase();
    if (/ink|dye|pigment/.test(name)) return 'Ink';
    if (/film|bopp|polymer|plastic/.test(name)) return 'Film';
    if (/adhesive|glue/.test(name)) return 'Adhesive';
    if (/board|carton|card/.test(name)) return 'Board';
    if (/paper|kraft/.test(name)) return 'Paper';
    return 'Other';
  }

  function nextSku(materials) {
    let max = 0;
    materials.forEach((material) => {
      const match = /^RM-(\d+)$/i.exec(String(material.sku || ''));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return 'RM-' + String(max + 1).padStart(4, '0');
  }

  function receiveIntoStock(materials, itemName, rawQuantity, rawUnit) {
    if (!Array.isArray(materials)) throw new TypeError('Materials must be an array.');
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantity received must be a number greater than zero.');
    }

    const unitLabel = String(rawUnit == null ? '' : rawUnit).trim().replace(/\s+/g, ' ');
    const unit = normalizeUnit(unitLabel);
    if (!unit) throw new Error('Enter a unit such as kg, sheets, or rolls.');

    const name = String(itemName == null ? '' : itemName).trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('The purchase order must have a material name.');

    const matchingMaterial = materials.find((item) => normalizedItemName(item.item) === normalizedItemName(name));
    if (matchingMaterial) {
      const current = parseQuantity(matchingMaterial.onHand);
      if (!current) throw new Error('Current stock for ' + matchingMaterial.item + ' has an invalid quantity. Fix it before receiving more material.');
      if (current.unit !== unit) {
        throw new Error('Unit mismatch for ' + matchingMaterial.item + ': stock is recorded in ' + current.unitLabel + ', but this receipt uses ' + unitLabel + '. Use the same unit or correct the stock record first.');
      }

      ensureStockMetadata(materials);
      const previousOnHand = matchingMaterial.onHand;
      const total = current.quantity + quantity;
      const capacity = Number(matchingMaterial.capacity);
      const stock = Math.max(0, Math.min(100, Math.round((total / capacity) * 100)));
      matchingMaterial.onHand = formatQuantity(total) + ' ' + current.unitLabel;
      matchingMaterial.stock = stock;
      matchingMaterial.status = statusForStock(stock);

      return { material: matchingMaterial, created: false, previousOnHand, addedQuantity: quantity };
    }

    const newMaterial = {
      sku: nextSku(materials),
      item: name,
      category: categoryForItem(name),
      location: 'Receiving',
      onHand: formatQuantity(quantity) + ' ' + unitLabel,
      capacity: quantity * 2,
      reorderLevel: quantity * 0.60,
      criticalLevel: quantity * 0.30,
      stock: 50,
      status: 'In stock'
    };
    materials.push(newMaterial);
    return { material: newMaterial, created: true, previousOnHand: null, addedQuantity: quantity };
  }

  return {
    normalizeUnit,
    parseQuantity,
    ensureStockMetadata,
    receiveIntoStock,
    statusForStock,
    formatQuantity
  };
});
